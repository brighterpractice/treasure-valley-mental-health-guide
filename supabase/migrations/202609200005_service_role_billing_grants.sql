-- Grant the backend service role the minimum table privileges required by
-- Cloudflare Pages checkout and Square webhook reconciliation.
begin;

grant select on table
  public.provider_profiles,
  public.provider_publication
to service_role;

grant select, insert, update on table
  public.provider_subscriptions
to service_role;

grant select, insert on table
  public.provider_billing_events
to service_role;

grant usage, select on sequence
  public.provider_billing_events_id_seq
to service_role;

commit;
