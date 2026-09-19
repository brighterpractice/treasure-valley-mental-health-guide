-- Treasure Valley Mental Health Guide — initial provider foundation.
-- Run once in the new project's SQL Editor, or apply as a migration.
-- Uses explicit grants because automatic table exposure is disabled.
-- No sample profiles, clinical records, or visitor search history are inserted.
begin;

create table public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  credentials text not null default '' check (char_length(credentials) <= 120),
  practice_name text not null default '' check (char_length(practice_name) <= 160),
  short_bio text not null default '' check (char_length(short_bio) <= 1500),
  primary_city text not null default '' check (char_length(primary_city) <= 100),
  years_in_practice integer check (years_in_practice between 0 and 80),
  provider_gender text not null default '' check (char_length(provider_gender) <= 80),
  website_url text not null default '' check (website_url = '' or (website_url ~ '^https://' and char_length(website_url) <= 2048)),
  availability text not null default 'Not specified' check (availability in ('Not specified','Accepting new clients','Waitlist','Not accepting new clients')),
  visit_types text[] not null default '{}' check (cardinality(visit_types) <= 5),
  populations text[] not null default '{}' check (cardinality(populations) <= 15),
  specialties text[] not null default '{}' check (cardinality(specialties) <= 30),
  approaches text[] not null default '{}' check (cardinality(approaches) <= 30),
  insurance text[] not null default '{}' check (cardinality(insurance) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- These fields are deliberately separate from the provider-editable profile.
-- Only an administrator / trusted server may publish, verify or award a plan.
create table public.provider_publication (
  provider_id uuid primary key references public.provider_profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','submitted','published','suspended')),
  plan text not null default 'basic' check (plan in ('basic','advanced')),
  submitted_at timestamptz,
  last_verified_at timestamptz,
  published_at timestamptz
);

alter table public.provider_profiles enable row level security;
alter table public.provider_publication enable row level security;
revoke all on public.provider_profiles, public.provider_publication from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.provider_profiles, public.provider_publication to authenticated;
grant insert (first_name,last_name,credentials,practice_name,short_bio,primary_city,years_in_practice,provider_gender,website_url,availability,visit_types,populations,specialties,approaches,insurance)
  on public.provider_profiles to authenticated;
grant update (first_name,last_name,credentials,practice_name,short_bio,primary_city,years_in_practice,provider_gender,website_url,availability,visit_types,populations,specialties,approaches,insurance)
  on public.provider_profiles to authenticated;

create policy "Providers read their own profile" on public.provider_profiles
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "Providers create their own profile" on public.provider_profiles
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy "Providers edit their own profile" on public.provider_profiles
  for update to authenticated using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));
create policy "Providers read their own publication status" on public.provider_publication
  for select to authenticated using (exists (
    select 1 from public.provider_profiles p where p.id = provider_id and p.owner_user_id = (select auth.uid())
  ));

create function public.tv_profile_updated() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function public.tv_profile_updated() from public, anon, authenticated;
create trigger tv_profile_updated before update on public.provider_profiles
  for each row execute function public.tv_profile_updated();

create function public.tv_profile_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.provider_publication(provider_id) values(new.id);
  return new;
end;
$$;
revoke all on function public.tv_profile_created() from public, anon, authenticated;
create trigger tv_profile_created after insert on public.provider_profiles
  for each row execute function public.tv_profile_created();

create function public.submit_provider_profile() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to submit a profile'; end if;
  update public.provider_publication pp set status = 'submitted', submitted_at = now()
    from public.provider_profiles p
    where p.id = pp.provider_id and p.owner_user_id = auth.uid()
      and pp.status in ('draft','submitted')
      and char_length(trim(p.first_name)) > 0 and char_length(trim(p.last_name)) > 0
      and char_length(trim(p.credentials)) > 0 and char_length(trim(p.primary_city)) > 0
      and char_length(trim(p.short_bio)) > 0;
  if not found then raise exception 'Complete your name, credentials, city and bio before submitting. Published or suspended profiles cannot be submitted.'; end if;
end;
$$;
revoke all on function public.submit_provider_profile() from public, anon, authenticated;
grant execute on function public.submit_provider_profile() to authenticated;

-- Explicit public projection: no owner account IDs or unpublished profiles.
-- Payment does not influence ordering. Pagination is bounded.
create function public.list_directory_profiles(page_size integer default 100, page_offset integer default 0)
returns table (
  id uuid, first_name text, last_name text, credentials text, practice_name text,
  short_bio text, primary_city text, years_in_practice integer, provider_gender text,
  website_url text, availability text, visit_types text[], populations text[],
  specialties text[], approaches text[], insurance text[], last_verified_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id,p.first_name,p.last_name,p.credentials,p.practice_name,p.short_bio,
    p.primary_city,p.years_in_practice,p.provider_gender,p.website_url,p.availability,
    p.visit_types,p.populations,p.specialties,p.approaches,p.insurance,pp.last_verified_at
  from public.provider_profiles p join public.provider_publication pp on pp.provider_id = p.id
  where pp.status = 'published'
  order by lower(p.last_name), lower(p.first_name), p.id
  limit greatest(1, least(coalesce(page_size,100),200)) offset greatest(coalesce(page_offset,0),0);
$$;
revoke all on function public.list_directory_profiles(integer,integer) from public, anon, authenticated;
grant execute on function public.list_directory_profiles(integer,integer) to anon, authenticated;

create index provider_profiles_alphabetical on public.provider_profiles (lower(last_name),lower(first_name),id);
create index provider_publication_status on public.provider_publication (status);
notify pgrst, 'reload schema';
commit;
