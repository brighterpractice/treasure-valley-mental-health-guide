alter table public.provider_profiles
  add column if not exists public_slug text;

alter table public.provider_profiles
  drop constraint if exists provider_profiles_public_slug_format;

alter table public.provider_profiles
  add constraint provider_profiles_public_slug_format
  check (
    public_slug is null
    or public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  );

create unique index if not exists provider_profiles_public_slug_uidx
  on public.provider_profiles(public_slug)
  where public_slug is not null;

create or replace function public.assign_provider_public_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_slug text;
  candidate text;
begin
  if nullif(btrim(new.public_slug), '') is not null then
    return new;
  end if;

  if nullif(btrim(new.first_name), '') is null
     or nullif(btrim(new.last_name), '') is null
     or nullif(btrim(new.primary_city), '') is null then
    new.public_slug := null;
    return new;
  end if;

  base_slug := trim(both '-' from regexp_replace(
    lower(concat_ws('-', new.first_name, new.last_name, new.primary_city, 'id')),
    '[^a-z0-9]+',
    '-',
    'g'
  ));

  candidate := base_slug;

  if exists (
    select 1
    from public.provider_profiles p
    where p.public_slug = candidate
      and p.id <> new.id
  ) then
    candidate := base_slug || '-' || left(replace(new.id::text, '-', ''), 8);
  end if;

  new.public_slug := candidate;
  return new;
end;
$$;

drop trigger if exists provider_profiles_assign_public_slug
  on public.provider_profiles;

create trigger provider_profiles_assign_public_slug
before insert or update of first_name, last_name, primary_city, public_slug
on public.provider_profiles
for each row
execute function public.assign_provider_public_slug();

with prepared as (
  select
    p.id,
    trim(both '-' from regexp_replace(
      lower(concat_ws('-', p.first_name, p.last_name, p.primary_city, 'id')),
      '[^a-z0-9]+',
      '-',
      'g'
    )) as base_slug,
    row_number() over (
      partition by trim(both '-' from regexp_replace(
        lower(concat_ws('-', p.first_name, p.last_name, p.primary_city, 'id')),
        '[^a-z0-9]+',
        '-',
        'g'
      ))
      order by p.created_at, p.id
    ) as rn
  from public.provider_profiles p
  where p.public_slug is null
    and nullif(btrim(p.first_name), '') is not null
    and nullif(btrim(p.last_name), '') is not null
    and nullif(btrim(p.primary_city), '') is not null
)
update public.provider_profiles p
set public_slug = case
  when prepared.rn = 1 then prepared.base_slug
  else prepared.base_slug || '-' || left(replace(p.id::text, '-', ''), 8)
end
from prepared
where p.id = prepared.id;

grant select (public_slug) on public.provider_profiles to authenticated;

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
    p.website_url,p.office_address,p.office_latitude,p.office_longitude,
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
    p.office_address,
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
