-- Expose provider plan to the public directory and add an Advanced-only full profile RPC.
begin;

drop function if exists public.list_directory_profiles(integer, integer);
create function public.list_directory_profiles(page_size integer default 100, page_offset integer default 0)
returns table (
  id uuid, first_name text, last_name text, credentials text, practice_name text,
  short_bio text, primary_city text, years_in_practice integer, provider_gender text,
  license_state text, license_number text, website_url text, availability text,
  visit_types text[], populations text[], specialties text[], approaches text[],
  services text[], insurance text[], plan text, last_verified_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id,p.first_name,p.last_name,p.credentials,p.practice_name,p.short_bio,
    p.primary_city,p.years_in_practice,p.provider_gender,p.license_state,p.license_number,
    p.website_url,p.availability,p.visit_types,p.populations,p.specialties,p.approaches,
    p.services,p.insurance,pp.plan,pp.last_verified_at
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id = p.id
  where pp.status = 'published'
  order by lower(p.last_name), lower(p.first_name), p.id
  limit greatest(1, least(coalesce(page_size,100),200))
  offset greatest(coalesce(page_offset,0),0);
$$;

revoke all on function public.list_directory_profiles(integer,integer) from public, anon, authenticated;
grant execute on function public.list_directory_profiles(integer,integer) to anon, authenticated;

create or replace function public.get_directory_profile(target_provider_id uuid)
returns table (
  id uuid, first_name text, last_name text, credentials text, practice_name text,
  short_bio text, primary_city text, years_in_practice integer, provider_gender text,
  license_state text, license_number text, website_url text, availability text,
  visit_types text[], populations text[], specialties text[], approaches text[],
  services text[], insurance text[], plan text, last_verified_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id,p.first_name,p.last_name,p.credentials,p.practice_name,p.short_bio,
    p.primary_city,p.years_in_practice,p.provider_gender,p.license_state,p.license_number,
    p.website_url,p.availability,p.visit_types,p.populations,p.specialties,p.approaches,
    p.services,p.insurance,pp.plan,pp.last_verified_at
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id = p.id
  where p.id = target_provider_id
    and pp.status = 'published'
    and pp.plan = 'advanced';
$$;

revoke all on function public.get_directory_profile(uuid) from public, anon, authenticated;
grant execute on function public.get_directory_profile(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
