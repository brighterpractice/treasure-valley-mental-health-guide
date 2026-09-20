-- Provider-requested plan + admin-only entitlement assignment for beta/manual billing.
begin;

alter table public.provider_profiles
  add column if not exists requested_plan text not null default 'basic'
  check (requested_plan in ('basic','advanced'));

grant insert (requested_plan) on public.provider_profiles to authenticated;
grant update (requested_plan) on public.provider_profiles to authenticated;

drop function if exists public.admin_list_submissions();
create function public.admin_list_submissions()
returns table (
  id uuid, owner_user_id uuid, first_name text, last_name text, credentials text,
  practice_name text, short_bio text, primary_city text, years_in_practice integer,
  provider_gender text, license_state text, license_number text, website_url text,
  video_url text, client_portal_url text, show_website_qr boolean, show_portal_qr boolean,
  availability text, visit_types text[], populations text[], insurance text[],
  specialties text[], services text[], approaches text[], requested_plan text, plan text,
  status text, submitted_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id,p.owner_user_id,p.first_name,p.last_name,p.credentials,p.practice_name,
    p.short_bio,p.primary_city,p.years_in_practice,p.provider_gender,p.license_state,
    p.license_number,p.website_url,p.video_url,p.client_portal_url,p.show_website_qr,
    p.show_portal_qr,p.availability,p.visit_types,p.populations,p.insurance,
    p.specialties,p.services,p.approaches,p.requested_plan,pp.plan,pp.status,pp.submitted_at
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id=p.id
  where public.tv_is_admin() and pp.status='submitted'
  order by pp.submitted_at asc;
$$;

revoke all on function public.admin_list_submissions() from public, anon, authenticated;
grant execute on function public.admin_list_submissions() to authenticated;

create or replace function public.admin_set_provider_plan(
  target_provider_id uuid,
  target_plan text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.tv_is_admin() then
    raise exception 'Administrator access required';
  end if;
  if target_plan not in ('basic','advanced') then
    raise exception 'Plan must be basic or advanced';
  end if;

  update public.provider_publication
     set plan = target_plan
   where provider_id = target_provider_id;

  if not found then
    raise exception 'Provider publication record not found';
  end if;
end;
$$;

revoke all on function public.admin_set_provider_plan(uuid,text) from public, anon, authenticated;
grant execute on function public.admin_set_provider_plan(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
