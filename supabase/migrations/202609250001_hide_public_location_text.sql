create or replace function public.list_directory_profiles_v2(
  page_size integer default 100,
  page_offset integer default 0
)
returns table(
  id uuid,
  public_slug text,
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
  office_address text,
  office_latitude double precision,
  office_longitude double precision,
  availability text,
  visit_types text[],
  populations text[],
  specialties text[],
  approaches text[],
  services text[],
  insurance text[],
  plan text,
  last_verified_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,p.public_slug,p.first_name,p.last_name,p.credentials,p.practice_name,p.short_bio,
    p.primary_city,p.years_in_practice,p.provider_gender,p.license_state,p.license_number,
    p.website_url,null::text as office_address,p.office_latitude,p.office_longitude,
    p.availability,p.visit_types,p.populations,p.specialties,p.approaches,p.services,
    p.insurance,pp.plan,pp.last_verified_at
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id=p.id
  where pp.status='published'
    and p.public_slug is not null
  order by lower(p.last_name),lower(p.first_name),p.id
  limit greatest(1,least(coalesce(page_size,100),200))
  offset greatest(coalesce(page_offset,0),0);
$$;

revoke execute on function public.list_directory_profiles_v2(integer,integer) from public;
grant execute on function public.list_directory_profiles_v2(integer,integer) to anon, authenticated, service_role;

create or replace function public.get_directory_profile_by_slug(target_slug text)
returns table(
  id uuid,
  public_slug text,
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
  office_address text,
  office_latitude double precision,
  office_longitude double precision,
  availability text,
  visit_types text[],
  populations text[],
  specialties text[],
  approaches text[],
  services text[],
  insurance text[],
  plan text,
  last_verified_at timestamptz,
  updated_at timestamptz,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.public_slug,
    p.first_name,
    p.last_name,
    p.credentials,
    p.practice_name,
    p.short_bio,
    p.primary_city,
    p.years_in_practice,
    p.provider_gender,
    p.license_state,
    p.license_number,
    p.website_url,
    case when pp.plan='advanced' then p.video_url else '' end,
    case when pp.plan='advanced' then p.client_portal_url else '' end,
    case when pp.plan='advanced' then p.show_website_qr else false end,
    case when pp.plan='advanced' then p.show_portal_qr else false end,
    null::text as office_address,
    p.office_latitude,
    p.office_longitude,
    p.availability,
    p.visit_types,
    p.populations,
    p.specialties,
    p.approaches,
    p.services,
    p.insurance,
    pp.plan,
    pp.last_verified_at,
    p.updated_at,
    pp.published_at
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id=p.id
  where p.public_slug = lower(btrim(target_slug))
    and pp.status='published'
  limit 1;
$$;

revoke execute on function public.get_directory_profile_by_slug(text) from public;
grant execute on function public.get_directory_profile_by_slug(text) to anon, authenticated, service_role;
