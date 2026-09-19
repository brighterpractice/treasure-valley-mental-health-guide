-- Expand admin review payload to include the provider fields collected in the profile editor.
begin;

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
  website_url text,
  availability text,
  visit_types text[],
  populations text[],
  insurance text[],
  specialties text[],
  services text[],
  approaches text[],
  status text,
  submitted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.owner_user_id,
    p.first_name,
    p.last_name,
    p.credentials,
    p.practice_name,
    p.short_bio,
    p.primary_city,
    p.years_in_practice,
    p.provider_gender,
    p.website_url,
    p.availability,
    p.visit_types,
    p.populations,
    p.insurance,
    p.specialties,
    p.services,
    p.approaches,
    pp.status,
    pp.submitted_at
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id = p.id
  where public.tv_is_admin()
    and pp.status = 'submitted'
  order by pp.submitted_at asc;
$$;

revoke all on function public.admin_list_submissions() from public, anon, authenticated;
grant execute on function public.admin_list_submissions() to authenticated;

notify pgrst, 'reload schema';
commit;
