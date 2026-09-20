-- Allow incomplete provider drafts to be saved.
-- Required identity/profile fields remain enforced by submit_provider_profile().
begin;

alter table public.provider_profiles
  drop constraint if exists provider_profiles_first_name_check,
  drop constraint if exists provider_profiles_last_name_check;

alter table public.provider_profiles
  add constraint provider_profiles_first_name_check
    check (char_length(first_name) <= 80),
  add constraint provider_profiles_last_name_check
    check (char_length(last_name) <= 80);

commit;
