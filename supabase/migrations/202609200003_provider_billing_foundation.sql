-- Provider billing foundation: approval gating, annual access, optional auto-renewal.
begin;

alter table public.provider_publication
  drop constraint if exists provider_publication_status_check;

alter table public.provider_publication
  add constraint provider_publication_status_check
  check (status in ('draft','submitted','approved_pending_payment','published','suspended'));

create table if not exists public.provider_subscriptions (
  provider_id uuid primary key references public.provider_profiles(id) on delete cascade,
  plan text not null check (plan in ('basic','advanced')),
  billing_mode text check (billing_mode is null or billing_mode in ('one_time','auto_renew')),
  status text not null default 'pending'
    check (status in ('pending','active','past_due','grace_period','canceled','expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  grace_until timestamptz,
  payment_source text check (payment_source is null or payment_source in ('square','manual')),
  square_customer_id text,
  square_subscription_id text,
  square_order_id text,
  square_payment_id text,
  last_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_start is null or current_period_end is null or current_period_end > current_period_start)
);

create unique index if not exists provider_subscriptions_square_subscription_uidx
  on public.provider_subscriptions(square_subscription_id)
  where square_subscription_id is not null;
create unique index if not exists provider_subscriptions_square_payment_uidx
  on public.provider_subscriptions(square_payment_id)
  where square_payment_id is not null;
create index if not exists provider_subscriptions_status_period_idx
  on public.provider_subscriptions(status,current_period_end);

alter table public.provider_subscriptions enable row level security;
revoke all on public.provider_subscriptions from public,anon,authenticated;
grant select on public.provider_subscriptions to authenticated;
drop policy if exists "Provider owners read billing" on public.provider_subscriptions;
create policy "Provider owners read billing"
on public.provider_subscriptions for select to authenticated
using (
  public.tv_is_admin()
  or exists (
    select 1 from public.provider_profiles p
    where p.id=provider_subscriptions.provider_id
      and p.owner_user_id=auth.uid()
  )
);

create table if not exists public.provider_billing_events (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 80),
  external_event_id text,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'USD' check (char_length(currency)=3),
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists provider_billing_events_external_uidx
  on public.provider_billing_events(external_event_id)
  where external_event_id is not null;
create index if not exists provider_billing_events_provider_time_idx
  on public.provider_billing_events(provider_id,occurred_at desc);

alter table public.provider_billing_events enable row level security;
revoke all on public.provider_billing_events from public,anon,authenticated;
grant select on public.provider_billing_events to authenticated;
drop policy if exists "Admins read billing events" on public.provider_billing_events;
create policy "Admins read billing events"
on public.provider_billing_events for select to authenticated
using (public.tv_is_admin());

create or replace function public.provider_billing_summary()
returns table (
  provider_id uuid,
  requested_plan text,
  publication_plan text,
  publication_status text,
  billing_plan text,
  billing_mode text,
  billing_status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  grace_until timestamptz,
  requires_payment boolean
)
language sql stable security definer set search_path=''
as $$
  select p.id,p.requested_plan,pp.plan,pp.status,ps.plan,ps.billing_mode,ps.status,
         ps.current_period_end,coalesce(ps.cancel_at_period_end,false),ps.grace_until,
         (pp.status='approved_pending_payment')
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id=p.id
  left join public.provider_subscriptions ps on ps.provider_id=p.id
  where p.owner_user_id=auth.uid()
  limit 1;
$$;
revoke all on function public.provider_billing_summary() from public,anon,authenticated;
grant execute on function public.provider_billing_summary() to authenticated;

create or replace function public.admin_approve_provider(target_provider_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare selected_plan text;
begin
  if not public.tv_is_admin() then raise exception 'Administrator access required'; end if;

  update public.provider_publication
     set status='approved_pending_payment',last_verified_at=now()
   where provider_id=target_provider_id and status='submitted'
   returning plan into selected_plan;

  if not found then raise exception 'Submission is no longer awaiting review'; end if;

  insert into public.provider_subscriptions(provider_id,plan,billing_mode,status,cancel_at_period_end,updated_at)
  values(target_provider_id,selected_plan,null,'pending',false,now())
  on conflict(provider_id) do update
    set plan=excluded.plan,billing_mode=null,status='pending',
        cancel_at_period_end=false,grace_until=null,updated_at=now();
end;
$$;
revoke all on function public.admin_approve_provider(uuid) from public,anon,authenticated;
grant execute on function public.admin_approve_provider(uuid) to authenticated;

create or replace function public.admin_record_provider_payment(
  target_provider_id uuid,
  target_billing_mode text,
  target_paid_through timestamptz
)
returns void language plpgsql security definer set search_path=''
as $$
declare selected_plan text; amount_due integer;
begin
  if not public.tv_is_admin() then raise exception 'Administrator access required'; end if;
  if target_billing_mode not in ('one_time','auto_renew') then raise exception 'Billing mode must be one_time or auto_renew'; end if;
  if target_paid_through <= now() then raise exception 'Paid-through date must be in the future'; end if;

  select pp.plan into selected_plan
  from public.provider_publication pp
  where pp.provider_id=target_provider_id and pp.status='approved_pending_payment';

  if selected_plan is null then raise exception 'Provider is not awaiting payment'; end if;
  amount_due:=case when selected_plan='advanced' then 4900 else 1200 end;

  insert into public.provider_subscriptions(
    provider_id,plan,billing_mode,status,current_period_start,current_period_end,
    cancel_at_period_end,grace_until,payment_source,last_payment_at,updated_at
  ) values(
    target_provider_id,selected_plan,target_billing_mode,'active',now(),target_paid_through,
    false,null,'manual',now(),now()
  )
  on conflict(provider_id) do update
    set plan=excluded.plan,billing_mode=excluded.billing_mode,status='active',
        current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
        cancel_at_period_end=false,grace_until=null,payment_source='manual',
        last_payment_at=now(),updated_at=now();

  update public.provider_publication
     set status='published',published_at=coalesce(published_at,now()),last_verified_at=now()
   where provider_id=target_provider_id;

  insert into public.provider_billing_events(provider_id,event_type,amount_cents,currency,details)
  values(target_provider_id,'manual_payment_recorded',amount_due,'USD',
    jsonb_build_object('plan',selected_plan,'billing_mode',target_billing_mode,'paid_through',target_paid_through));
end;
$$;
revoke all on function public.admin_record_provider_payment(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_record_provider_payment(uuid,text,timestamptz) to authenticated;

create or replace function public.billing_activate_provider(
  target_provider_id uuid,
  target_plan text,
  target_billing_mode text,
  target_period_start timestamptz,
  target_period_end timestamptz,
  target_square_customer_id text default null,
  target_square_subscription_id text default null,
  target_square_order_id text default null,
  target_square_payment_id text default null,
  target_external_event_id text default null,
  target_amount_cents integer default null
)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  if target_plan not in ('basic','advanced') then raise exception 'Plan must be basic or advanced'; end if;
  if target_billing_mode not in ('one_time','auto_renew') then raise exception 'Billing mode must be one_time or auto_renew'; end if;
  if target_period_end<=target_period_start then raise exception 'Billing period end must be after start'; end if;

  insert into public.provider_subscriptions(
    provider_id,plan,billing_mode,status,current_period_start,current_period_end,
    cancel_at_period_end,grace_until,payment_source,square_customer_id,
    square_subscription_id,square_order_id,square_payment_id,last_payment_at,updated_at
  ) values(
    target_provider_id,target_plan,target_billing_mode,'active',target_period_start,target_period_end,
    false,null,'square',target_square_customer_id,target_square_subscription_id,
    target_square_order_id,target_square_payment_id,now(),now()
  )
  on conflict(provider_id) do update
    set plan=excluded.plan,billing_mode=excluded.billing_mode,status='active',
        current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
        cancel_at_period_end=false,grace_until=null,payment_source='square',
        square_customer_id=coalesce(excluded.square_customer_id,public.provider_subscriptions.square_customer_id),
        square_subscription_id=excluded.square_subscription_id,square_order_id=excluded.square_order_id,
        square_payment_id=excluded.square_payment_id,last_payment_at=now(),updated_at=now();

  update public.provider_publication
     set plan=target_plan,status='published',published_at=coalesce(published_at,now()),last_verified_at=now()
   where provider_id=target_provider_id;
  if not found then raise exception 'Provider publication record not found'; end if;

  insert into public.provider_billing_events(provider_id,event_type,external_event_id,amount_cents,currency,details)
  values(target_provider_id,'square_payment_activated',target_external_event_id,target_amount_cents,'USD',
    jsonb_build_object('plan',target_plan,'billing_mode',target_billing_mode,'period_start',target_period_start,
      'period_end',target_period_end,'square_order_id',target_square_order_id,
      'square_payment_id',target_square_payment_id,'square_subscription_id',target_square_subscription_id))
  on conflict(external_event_id) where external_event_id is not null do nothing;
end;
$$;
revoke all on function public.billing_activate_provider(uuid,text,text,timestamptz,timestamptz,text,text,text,text,text,integer)
from public,anon,authenticated;
grant execute on function public.billing_activate_provider(uuid,text,text,timestamptz,timestamptz,text,text,text,text,text,integer)
to service_role;

notify pgrst,'reload schema';
commit;
