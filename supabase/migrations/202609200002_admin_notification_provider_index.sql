-- Cover admin notification provider foreign key for review/admin queries.
create index if not exists tv_admin_notifications_provider_id_idx
  on public.tv_admin_notifications(provider_id);
