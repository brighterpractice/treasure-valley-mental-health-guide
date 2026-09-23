create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.tv_is_admin() then
    raise exception 'Administrator access required';
  end if;

  select jsonb_build_object(
    'total_providers', count(p.id),
    'awaiting_review', count(p.id) filter (where pp.status = 'paid_pending_review'),
    'active_providers', count(p.id) filter (where pp.status = 'published'),
    'paid_hidden', count(p.id) filter (
      where ps.status in ('active','grace_period')
        and coalesce(pp.status,'draft') <> 'published'
    ),
    'changes_requested', count(p.id) filter (where pp.status = 'changes_requested'),
    'suspended', count(p.id) filter (where pp.status = 'suspended'),
    'expiring_30_days', count(p.id) filter (
      where ps.status in ('active','grace_period')
        and ps.current_period_end is not null
        and ps.current_period_end >= now()
        and ps.current_period_end < now() + interval '30 days'
    ),
    'past_due', count(p.id) filter (where ps.status in ('past_due','grace_period')),
    'annual_revenue_cents', coalesce(sum(
      case
        when ps.status in ('active','grace_period') and ps.plan = 'advanced' then 4900
        when ps.status in ('active','grace_period') and ps.plan = 'basic' then 1200
        else 0
      end
    ),0),
    'unread_notifications', (
      select count(*) from public.tv_admin_notifications n where n.read_at is null
    )
  )
  into result
  from public.provider_profiles p
  left join public.provider_publication pp on pp.provider_id = p.id
  left join public.provider_subscriptions ps on ps.provider_id = p.id;

  return result;
end;
$$;

create or replace function public.admin_list_providers()
returns table(
  id uuid,
  email text,
  first_name text,
  last_name text,
  credentials text,
  practice_name text,
  primary_city text,
  public_slug text,
  requested_plan text,
  plan text,
  publication_status text,
  billing_status text,
  billing_mode text,
  current_period_end timestamptz,
  last_payment_at timestamptz,
  profile_updated_at timestamptz,
  published_at timestamptz,
  review_requested_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    u.email::text,
    p.first_name,
    p.last_name,
    p.credentials,
    p.practice_name,
    p.primary_city,
    p.public_slug,
    p.requested_plan,
    coalesce(ps.plan, pp.plan, p.requested_plan, 'basic') as plan,
    coalesce(pp.status, 'draft') as publication_status,
    coalesce(ps.status, 'unpaid') as billing_status,
    ps.billing_mode,
    ps.current_period_end,
    ps.last_payment_at,
    p.updated_at as profile_updated_at,
    pp.published_at,
    pp.review_requested_at
  from public.provider_profiles p
  join auth.users u on u.id = p.owner_user_id
  left join public.provider_publication pp on pp.provider_id = p.id
  left join public.provider_subscriptions ps on ps.provider_id = p.id
  where public.tv_is_admin()
  order by p.updated_at desc;
$$;

create or replace function public.admin_list_notifications()
returns table(
  id bigint,
  kind text,
  provider_id uuid,
  provider_name text,
  practice_name text,
  created_at timestamptz,
  read_at timestamptz,
  email_sent_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id,
    n.kind,
    n.provider_id,
    nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '') as provider_name,
    p.practice_name,
    n.created_at,
    n.read_at,
    n.email_sent_at
  from public.tv_admin_notifications n
  left join public.provider_profiles p on p.id = n.provider_id
  where public.tv_is_admin()
  order by n.created_at desc
  limit 200;
$$;

create or replace function public.admin_mark_notification_read(target_notification_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.tv_is_admin() then
    raise exception 'Administrator access required';
  end if;

  update public.tv_admin_notifications
  set read_at = coalesce(read_at, now())
  where id = target_notification_id;
end;
$$;

create or replace function public.admin_suspend_provider(target_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.tv_is_admin() then
    raise exception 'Administrator access required';
  end if;

  update public.provider_publication
  set status = 'suspended'
  where provider_id = target_provider_id
    and status = 'published';

  if not found then
    raise exception 'Only a published listing can be suspended';
  end if;
end;
$$;

create or replace function public.admin_reactivate_provider(target_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.tv_is_admin() then
    raise exception 'Administrator access required';
  end if;

  if not exists (
    select 1
    from public.provider_subscriptions ps
    where ps.provider_id = target_provider_id
      and ps.status in ('active','grace_period')
      and (ps.current_period_end is null or ps.current_period_end > now())
  ) then
    raise exception 'Provider does not have active paid access';
  end if;

  update public.provider_publication
  set status = 'published',
      published_at = coalesce(published_at, now()),
      last_verified_at = now()
  where provider_id = target_provider_id
    and status = 'suspended';

  if not found then
    raise exception 'Only a suspended listing can be reactivated';
  end if;
end;
$$;

revoke all on function public.admin_dashboard_summary() from public;
revoke all on function public.admin_list_providers() from public;
revoke all on function public.admin_list_notifications() from public;
revoke all on function public.admin_mark_notification_read(bigint) from public;
revoke all on function public.admin_suspend_provider(uuid) from public;
revoke all on function public.admin_reactivate_provider(uuid) from public;

grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.admin_list_providers() to authenticated;
grant execute on function public.admin_list_notifications() to authenticated;
grant execute on function public.admin_mark_notification_read(bigint) to authenticated;
grant execute on function public.admin_suspend_provider(uuid) to authenticated;
grant execute on function public.admin_reactivate_provider(uuid) to authenticated;
