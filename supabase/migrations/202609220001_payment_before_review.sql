-- Provider workflow v2: save draft -> pay -> admin review -> publish.
begin;

alter table public.provider_publication
  drop constraint if exists provider_publication_status_check;

alter table public.provider_publication
  add column if not exists review_requested_at timestamptz;

alter table public.provider_publication
  add constraint provider_publication_status_check
  check (status in (
    'draft',
    'submitted',
    'approved_pending_payment',
    'payment_pending',
    'paid_pending_review',
    'changes_requested',
    'published',
    'suspended'
  ));

alter table public.tv_admin_users
  add column if not exists notification_email text;

update public.tv_admin_users a
set notification_email = u.email
from auth.users u
where u.id = a.user_id
  and a.notification_email is null;

alter table public.tv_admin_notifications
  add column if not exists external_event_id text,
  add column if not exists email_sent_at timestamptz;

create unique index if not exists tv_admin_notifications_external_event_uidx
  on public.tv_admin_notifications(external_event_id)
  where external_event_id is not null;

-- Review is no longer triggered by the provider's Save/Submit action.
drop trigger if exists tv_notify_submission on public.provider_publication;

-- Keep the legacy submit RPC harmless for stale clients. It validates the
-- required profile fields but does not send anything to the admin queue.
create or replace function public.submit_provider_profile()
returns void
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to continue'; end if;

  perform 1
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id=p.id
  where p.owner_user_id=auth.uid()
    and pp.status in ('draft','submitted','payment_pending')
    and char_length(trim(p.first_name))>0
    and char_length(trim(p.last_name))>0
    and char_length(trim(p.credentials))>0
    and char_length(trim(p.primary_city))>0
    and char_length(trim(p.short_bio))>0;

  if not found then
    raise exception 'Complete your name, credentials, city and bio before payment.';
  end if;
end;
$$;
revoke all on function public.submit_provider_profile() from public,anon,authenticated;
grant execute on function public.submit_provider_profile() to authenticated;

-- Billing is available before admin review. The server-side checkout endpoint
-- still validates required profile fields before creating a Square link.
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
         (
           pp.status in ('draft','submitted','approved_pending_payment','payment_pending')
           and coalesce(ps.status,'pending') not in ('active','grace_period')
         )
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id=p.id
  left join public.provider_subscriptions ps on ps.provider_id=p.id
  where p.owner_user_id=auth.uid()
  limit 1;
$$;
revoke all on function public.provider_billing_summary() from public,anon,authenticated;
grant execute on function public.provider_billing_summary() to authenticated;

-- Admin queue now contains providers who have already paid and are waiting for
-- content review. Keep the existing RPC name so older admin clients fail safe.
drop function if exists public.admin_list_submissions();
create function public.admin_list_submissions()
returns table (
  id uuid,
  owner_user_id uuid,
  first_name text,
  last_name text,
  credentials text,
  practice_name text,
  short_bio text,
  primary_city text,
  years_in_practice integer,
  provider_gender text,
  license_state text,
  license_number text,
  website_url text,
  video_url text,
  client_portal_url text,
  show_website_qr boolean,
  show_portal_qr boolean,
  availability text,
  visit_types text[],
  populations text[],
  insurance text[],
  specialties text[],
  services text[],
  approaches text[],
  requested_plan text,
  plan text,
  status text,
  submitted_at timestamptz
)
language sql stable security definer set search_path=''
as $$
  select p.id,p.owner_user_id,p.first_name,p.last_name,p.credentials,p.practice_name,
    p.short_bio,p.primary_city,p.years_in_practice,p.provider_gender,p.license_state,
    p.license_number,p.website_url,p.video_url,p.client_portal_url,p.show_website_qr,
    p.show_portal_qr,p.availability,p.visit_types,p.populations,p.insurance,
    p.specialties,p.services,p.approaches,p.requested_plan,pp.plan,pp.status,
    coalesce(pp.review_requested_at,ps.last_payment_at,pp.submitted_at)
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id=p.id
  left join public.provider_subscriptions ps on ps.provider_id=p.id
  where public.tv_is_admin()
    and pp.status='paid_pending_review'
    and ps.status in ('active','grace_period')
  order by coalesce(pp.review_requested_at,ps.last_payment_at,pp.submitted_at) asc nulls last;
$$;
revoke all on function public.admin_list_submissions() from public,anon,authenticated;
grant execute on function public.admin_list_submissions() to authenticated;

-- Approval now publishes an already-paid listing.
create or replace function public.admin_approve_provider(target_provider_id uuid)
returns void
language plpgsql security definer set search_path=''
as $$
begin
  if not public.tv_is_admin() then raise exception 'Administrator access required'; end if;

  update public.provider_publication
  set status='published',
      published_at=coalesce(published_at,now()),
      last_verified_at=now()
  where provider_id=target_provider_id
    and status='paid_pending_review';

  if not found then raise exception 'Profile is no longer awaiting review'; end if;

  update public.tv_admin_notifications
  set read_at=coalesce(read_at,now())
  where provider_id=target_provider_id
    and read_at is null
    and kind in ('provider_paid_pending_review','provider_changes_resubmitted');
end;
$$;
revoke all on function public.admin_approve_provider(uuid) from public,anon,authenticated;
grant execute on function public.admin_approve_provider(uuid) to authenticated;

-- Requesting changes keeps the paid entitlement active, but the listing stays hidden.
create or replace function public.admin_request_provider_changes(target_provider_id uuid)
returns void
language plpgsql security definer set search_path=''
as $$
begin
  if not public.tv_is_admin() then raise exception 'Administrator access required'; end if;

  update public.provider_publication
  set status='changes_requested'
  where provider_id=target_provider_id
    and status='paid_pending_review';

  if not found then raise exception 'Profile is no longer awaiting review'; end if;

  update public.tv_admin_notifications
  set read_at=coalesce(read_at,now())
  where provider_id=target_provider_id
    and read_at is null
    and kind in ('provider_paid_pending_review','provider_changes_resubmitted');
end;
$$;
revoke all on function public.admin_request_provider_changes(uuid) from public,anon,authenticated;
grant execute on function public.admin_request_provider_changes(uuid) to authenticated;

-- A paid provider can resubmit after requested edits without paying again.
create or replace function public.provider_resubmit_paid_profile()
returns void
language plpgsql security definer set search_path=''
as $$
declare target_provider_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to continue'; end if;

  select p.id into target_provider_id
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id=p.id
  join public.provider_subscriptions ps on ps.provider_id=p.id
  where p.owner_user_id=auth.uid()
    and pp.status='changes_requested'
    and ps.status in ('active','grace_period')
    and ps.current_period_end>now()
    and char_length(trim(p.first_name))>0
    and char_length(trim(p.last_name))>0
    and char_length(trim(p.credentials))>0
    and char_length(trim(p.primary_city))>0
    and char_length(trim(p.short_bio))>0
  limit 1;

  if target_provider_id is null then
    raise exception 'Complete the required profile fields before resubmitting.';
  end if;

  update public.provider_publication
  set status='paid_pending_review',review_requested_at=now(),submitted_at=now()
  where provider_id=target_provider_id;

  insert into public.tv_admin_notifications(kind,provider_id)
  values('provider_changes_resubmitted',target_provider_id);
end;
$$;
revoke all on function public.provider_resubmit_paid_profile() from public,anon,authenticated;
grant execute on function public.provider_resubmit_paid_profile() to authenticated;

-- Payment activates the paid entitlement, but initial purchases stay hidden until
-- an administrator reviews the profile. Renewals of an already-published listing
-- remain published. Suspended listings are never republished by payment.
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
declare current_publication_status text;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  if target_plan not in ('basic','advanced') then raise exception 'Plan must be basic or advanced'; end if;
  if target_billing_mode not in ('one_time','auto_renew') then raise exception 'Billing mode must be one_time or auto_renew'; end if;
  if target_period_end<=target_period_start then raise exception 'Billing period end must be after start'; end if;

  select status into current_publication_status
  from public.provider_publication
  where provider_id=target_provider_id
  for update;

  if current_publication_status is null then raise exception 'Provider publication record not found'; end if;

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
        square_subscription_id=coalesce(excluded.square_subscription_id,public.provider_subscriptions.square_subscription_id),
        square_order_id=excluded.square_order_id,
        square_payment_id=excluded.square_payment_id,last_payment_at=now(),updated_at=now();

  if current_publication_status='published' then
    update public.provider_publication
    set plan=target_plan,status='published'
    where provider_id=target_provider_id;
  elsif current_publication_status='suspended' then
    update public.provider_publication
    set plan=target_plan,status='suspended'
    where provider_id=target_provider_id;
  else
    update public.provider_publication
    set plan=target_plan,status='paid_pending_review',review_requested_at=now(),submitted_at=now()
    where provider_id=target_provider_id;

    insert into public.tv_admin_notifications(kind,provider_id,external_event_id)
    values('provider_paid_pending_review',target_provider_id,target_external_event_id)
    on conflict(external_event_id) where external_event_id is not null do nothing;
  end if;

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

-- Manual payment follows the same paid-then-review rule for first publication.
create or replace function public.admin_record_provider_payment(
  target_provider_id uuid,
  target_billing_mode text,
  target_paid_through timestamptz
)
returns void language plpgsql security definer set search_path=''
as $$
declare selected_plan text; amount_due integer; current_status text;
begin
  if not public.tv_is_admin() then raise exception 'Administrator access required'; end if;
  if target_billing_mode not in ('one_time','auto_renew') then raise exception 'Billing mode must be one_time or auto_renew'; end if;
  if target_paid_through<=now() then raise exception 'Paid-through date must be in the future'; end if;

  select pp.plan,pp.status into selected_plan,current_status
  from public.provider_publication pp
  where pp.provider_id=target_provider_id;

  if selected_plan is null then raise exception 'Provider publication record not found'; end if;
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
        cancel_at_period_end=false,grace_until=null,payment_source='manual',last_payment_at=now(),updated_at=now();

  if current_status not in ('published','suspended') then
    update public.provider_publication
    set status='paid_pending_review',review_requested_at=now(),submitted_at=now()
    where provider_id=target_provider_id;
    insert into public.tv_admin_notifications(kind,provider_id)
    values('provider_paid_pending_review',target_provider_id);
  end if;

  insert into public.provider_billing_events(provider_id,event_type,amount_cents,currency,details)
  values(target_provider_id,'manual_payment_recorded',amount_due,'USD',
    jsonb_build_object('plan',selected_plan,'billing_mode',target_billing_mode,'paid_through',target_paid_through));
end;
$$;
revoke all on function public.admin_record_provider_payment(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_record_provider_payment(uuid,text,timestamptz) to authenticated;

-- Server-side email alert worker needs only these tables.
grant select on public.tv_admin_users to service_role;
grant select,update on public.tv_admin_notifications to service_role;

notify pgrst,'reload schema';
commit;
