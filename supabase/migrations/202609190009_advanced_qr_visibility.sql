-- Let Advanced providers choose whether website and portal QR codes appear publicly.
begin;

alter table public.provider_profiles
  add column if not exists show_website_qr boolean not null default false,
  add column if not exists show_portal_qr boolean not null default false;

grant insert (show_website_qr, show_portal_qr) on public.provider_profiles to authenticated;
grant update (show_website_qr, show_portal_qr) on public.provider_profiles to authenticated;

drop function if exists public.get_directory_profile(uuid);
create function public.get_directory_profile(target_provider_id uuid)
returns table (
  id uuid, first_name text, last_name text, credentials text, practice_name text,
  short_bio text, primary_city text, years_in_practice integer, provider_gender text,
  license_state text, license_number text, website_url text, video_url text,
  client_portal_url text, show_website_qr boolean, show_portal_qr boolean,
  availability text, visit_types text[], populations text[], specialties text[],
  approaches text[], services text[], insurance text[], plan text,
  last_verified_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id,p.first_name,p.last_name,p.credentials,p.practice_name,p.short_bio,
    p.primary_city,p.years_in_practice,p.provider_gender,p.license_state,p.license_number,
    p.website_url,p.video_url,p.client_portal_url,p.show_website_qr,p.show_portal_qr,
    p.availability,p.visit_types,p.populations,p.specialties,p.approaches,p.services,
    p.insurance,pp.plan,pp.last_verified_at
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
  video_url text, client_portal_url text, show_website_qr boolean, show_portal_qr boolean,
  availability text, visit_types text[], populations text[], insurance text[],
  specialties text[], services text[], approaches text[], status text,
  submitted_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id,p.owner_user_id,p.first_name,p.last_name,p.credentials,p.practice_name,
    p.short_bio,p.primary_city,p.years_in_practice,p.provider_gender,p.license_state,
    p.license_number,p.website_url,p.video_url,p.client_portal_url,p.show_website_qr,
    p.show_portal_qr,p.availability,p.visit_types,p.populations,p.insurance,
    p.specialties,p.services,p.approaches,pp.status,pp.submitted_at
  from public.provider_profiles p
  join public.provider_publication pp on pp.provider_id=p.id
  where public.tv_is_admin() and pp.status='submitted'
  order by pp.submitted_at asc;
$$;

revoke all on function public.admin_list_submissions() from public, anon, authenticated;
grant execute on function public.admin_list_submissions() to authenticated;

notify pgrst, 'reload schema';
commit;
