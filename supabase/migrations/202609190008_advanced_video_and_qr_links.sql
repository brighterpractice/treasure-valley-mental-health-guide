-- Advanced profile video and client-portal links.
begin;

alter table public.provider_profiles
  add column if not exists video_url text not null default ''
    check (video_url = '' or (video_url ~ '^https://' and char_length(video_url) <= 2048)),
  add column if not exists client_portal_url text not null default ''
    check (client_portal_url = '' or (client_portal_url ~ '^https://' and char_length(client_portal_url) <= 2048));

grant insert (video_url, client_portal_url) on public.provider_profiles to authenticated;
grant update (video_url, client_portal_url) on public.provider_profiles to authenticated;

drop function if exists public.get_directory_profile(uuid);
create function public.get_directory_profile(target_provider_id uuid)
returns table (
  id uuid, first_name text, last_name text, credentials text, practice_name text,
  short_bio text, primary_city text, years_in_practice integer, provider_gender text,
  license_state text, license_number text, website_url text, video_url text,
  client_portal_url text, availability text, visit_types text[], populations text[],
  specialties text[], approaches text[], services text[], insurance text[], plan text,
  last_verified_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id,p.first_name,p.last_name,p.credentials,p.practice_name,p.short_bio,
    p.primary_city,p.years_in_practice,p.provider_gender,p.license_state,p.license_number,
    p.website_url,p.video_url,p.client_portal_url,p.availability,p.visit_types,p.populations,
    p.specialties,p.approaches,p.services,p.insurance,pp.plan,pp.last_verified_at
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id = p.id
  where p.id = target_provider_id
    and pp.status = 'published'
    and pp.plan = 'advanced';
$$;

revoke all on function public.get_directory_profile(uuid) from public, anon, authenticated;
grant execute on function public.get_directory_profile(uuid) to anon, authenticated;

drop function if exists public.admin_list_submissions();
create function public.admin_list_submissions()
returns table (
  id uuid, owner_user_id uuid, first_name text, last_name text, credentials text,
  practice_name text, short_bio text, primary_city text, years_in_practice integer,
  provider_gender text, license_state text, license_number text, website_url text,
  video_url text, client_portal_url text, availability text, visit_types text[],
  populations text[], insurance text[], specialties text[], services text[],
  approaches text[], status text, submitted_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id,p.owner_user_id,p.first_name,p.last_name,p.credentials,p.practice_name,
    p.short_bio,p.primary_city,p.years_in_practice,p.provider_gender,p.license_state,
    p.license_number,p.website_url,p.video_url,p.client_portal_url,p.availability,
    p.visit_types,p.populations,p.insurance,p.specialties,p.services,p.approaches,
    pp.status,pp.submitted_at
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id=p.id
  where public.tv_is_admin() and pp.status='submitted'
  order by pp.submitted_at asc;
$$;

revoke all on function public.admin_list_submissions() from public, anon, authenticated;
grant execute on function public.admin_list_submissions() to authenticated;

notify pgrst, 'reload schema';
commit;
