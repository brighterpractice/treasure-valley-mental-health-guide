begin;

drop policy if exists "Provider owners read billing" on public.provider_subscriptions;

create policy "Provider owners read billing"
on public.provider_subscriptions
for select
to authenticated
using (
  (select public.tv_is_admin())
  or exists (
    select 1
    from public.provider_profiles p
    where p.id = provider_subscriptions.provider_id
      and p.owner_user_id = (select auth.uid())
  )
);

commit;