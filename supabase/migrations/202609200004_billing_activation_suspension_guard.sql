-- Prevent Square payment activation from automatically republishing an administratively suspended provider.
begin;

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
declare publication_status_before text;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  if target_plan not in ('basic','advanced') then raise exception 'Plan must be basic or advanced'; end if;
  if target_billing_mode not in ('one_time','auto_renew') then raise exception 'Billing mode must be one_time or auto_renew'; end if;
  if target_period_end<=target_period_start then raise exception 'Billing period end must be after start'; end if;

  select pp.status
    into publication_status_before
    from public.provider_publication pp
   where pp.provider_id=target_provider_id
   for update;

  if publication_status_before is null then
    raise exception 'Provider publication record not found';
  end if;

  if publication_status_before not in ('approved_pending_payment','published','suspended') then
    raise exception 'Provider publication state % cannot be activated from billing', publication_status_before;
  end if;

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
        square_order_id=coalesce(excluded.square_order_id,public.provider_subscriptions.square_order_id),
        square_payment_id=coalesce(excluded.square_payment_id,public.provider_subscriptions.square_payment_id),
        last_payment_at=now(),updated_at=now();

  if publication_status_before='approved_pending_payment' then
    update public.provider_publication
       set plan=target_plan,
           status='published',
           published_at=coalesce(published_at,now()),
           last_verified_at=now()
     where provider_id=target_provider_id;
  elsif publication_status_before='published' then
    update public.provider_publication
       set plan=target_plan,
           last_verified_at=now()
     where provider_id=target_provider_id;
  end if;
  -- Intentionally do not modify provider_publication when status='suspended'.

  insert into public.provider_billing_events(provider_id,event_type,external_event_id,amount_cents,currency,details)
  values(target_provider_id,'square_payment_activated',target_external_event_id,target_amount_cents,'USD',
    jsonb_build_object(
      'plan',target_plan,
      'billing_mode',target_billing_mode,
      'period_start',target_period_start,
      'period_end',target_period_end,
      'square_order_id',target_square_order_id,
      'square_payment_id',target_square_payment_id,
      'square_subscription_id',target_square_subscription_id,
      'publication_status_before',publication_status_before,
      'publication_status_after',
        case when publication_status_before='approved_pending_payment' then 'published' else publication_status_before end
    ))
  on conflict(external_event_id) where external_event_id is not null do nothing;
end;
$$;

revoke all on function public.billing_activate_provider(uuid,text,text,timestamptz,timestamptz,text,text,text,text,text,integer)
from public,anon,authenticated;
grant execute on function public.billing_activate_provider(uuid,text,text,timestamptz,timestamptz,text,text,text,text,text,integer)
to service_role;

notify pgrst,'reload schema';
commit;
