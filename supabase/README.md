# Supabase setup

Project: https://mkdkdinjbjxeexiwromi.supabase.co

The configured publishable key is safe for browser delivery. Never add database passwords, secret keys or service-role keys to the static website or Git.

## Initial database setup

Apply `migrations/202609190001_provider_foundation.sql` once using the Supabase integration or the SQL Editor for this project. The migration is transactional and intentionally fails if its tables already exist; use tracked follow-up migrations for changes.

The old `notes/supabase-schema.sql` is superseded: its broad owner policy allowed owners to change their own plan and publication state. Do not run that prototype schema.

This foundation supports one editable provider profile per account, separate administrator-controlled publication and plan records, authenticated submission for review, and a public directory projection excluding owner IDs. All tables use RLS, with explicit grants for the project's disabled automatic exposure setting. Published profile edits appear without a second submission; suspension remains administrator-controlled.

Provider sign-in UI, media upload policies, billing/webhooks and privacy-preserving analytics remain to be implemented. No demo data is seeded and no emails are sent by this migration.

Before enabling account registration in the website, configure Authentication URL Configuration for the actual hosting origin and confirmation callback. Enable confirmed email signup and configure production email delivery. This step will be completed alongside the auth UI and Cloudflare deployment.

## Verification after migration

Anonymous reads of provider_profiles must be denied. The list_directory_profiles RPC should return an empty array until an administrator publishes a profile. Authenticated users can read/edit only their own profile, cannot alter owner/id fields, and cannot write provider_publication or give themselves a paid plan. Test with two separate users before enabling public registration.

## Applied and verified — 2026-09-19

Both migrations were applied to the intended project through the connected Supabase integration. The public directory RPC returned HTTP 200 and an empty array using the site's publishable key.

Transactional tests passed for authenticated profile creation/editing, owner-only reads, cross-owner write isolation, immutable ownership, protected plan/publication fields, complete-profile submission, and published-only public reads. Anonymous raw table access and submission calls were denied. All temporary auth users and profiles were rolled back; the directory remains empty.

The security advisor identified client execute privileges on the platform's automatic-RLS event trigger; migration 002 revokes those. The directory read RPC is intentionally callable by visitors, and the submit RPC is intentionally callable by authenticated providers. Both use fixed search paths, fixed projections or ownership checks, and explicit execute grants. These intentional SECURITY DEFINER entrypoints may remain advisory notices; they were covered by the access tests.
