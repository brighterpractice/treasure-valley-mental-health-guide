-- Add provider-entered services and custom modality/approach support.
begin;

alter table public.provider_profiles
  add column if not exists services text[] not null default '{}'
  check (cardinality(services) <= 30);

grant insert (services) on public.provider_profiles to authenticated;
grant update (services) on public.provider_profiles to authenticated;

drop function public.list_directory_profiles(integer,integer);
create function public.list_directory_profiles(page_size integer default 100, page_offset integer default 0)
returns table (
  id uuid, first_name text, last_name text, credentials text, practice_name text,
  short_bio text, primary_city text, years_in_practice integer, provider_gender text,
  website_url text, availability text, visit_types text[], populations text[],
  specialties text[], approaches text[], services text[], insurance text[], last_verified_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id,p.first_name,p.last_name,p.credentials,p.practice_name,p.short_bio,
    p.primary_city,p.years_in_practice,p.provider_gender,p.website_url,p.availability,
    p.visit_types,p.populations,p.specialties,p.approaches,p.services,p.insurance,pp.last_verified_at
  from public.provider_profiles p join public.provider_publication pp on pp.provider_id = p.id
  where pp.status = 'published'
  order by lower(p.last_name), lower(p.first_name), p.id
  limit greatest(1, least(coalesce(page_size,100),200)) offset greatest(coalesce(page_offset,0),0);
$$;
revoke all on function public.list_directory_profiles(integer,integer) from public, anon, authenticated;
grant execute on function public.list_directory_profiles(integer,integer) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
