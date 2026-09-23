# Provider review workflow

## Production flow

1. Provider creates an account and confirms email.
2. Provider builds the profile and can save drafts as often as needed.
3. Saving a profile does **not** create an administrator review request.
4. Provider chooses Basic ($12/year) or Advanced ($49/year) and a billing preference.
5. Provider completes Square-hosted checkout.
6. The verified Square webhook activates the paid entitlement but keeps the listing private with `provider_publication.status = 'paid_pending_review'`.
7. A row is added to `tv_admin_notifications` and an administrator review email is attempted.
8. Administrator reviews the paid profile at `/admin`.
9. `Approve & publish` changes the listing to `published`.
10. `Request changes` changes the listing to `changes_requested`; paid access remains active and the listing remains private.
11. A paid provider can save changes and resubmit for review without paying again.

A renewal payment for an already-published listing keeps the listing published. A payment never automatically republishes a suspended listing.

## Admin security

`/admin` is hidden until the authenticated user passes `tv_is_admin()`. Non-admin provider accounts are redirected to `/dashboard?admin=denied`.

The browser check is only a UX guard. Actual admin data/actions remain protected by Supabase RLS/security-definer RPC checks against `tv_admin_users`.

## Review email delivery

The review queue is always recorded in Supabase even if email delivery is unavailable. Email delivery uses Resend from the Cloudflare Pages Functions runtime.

Add these variables to the Cloudflare Pages project in both Production and any Preview environment used for payment testing:

- `RESEND_API_KEY` — **Secret**. Resend API key.
- `ADMIN_ALERT_FROM_EMAIL` — sender accepted by Resend, for example `Treasure Valley Mental Health Guide <notifications@tvmentalhealthguide.org>` after the domain is verified with Resend.
- `PUBLIC_SITE_URL` — optional text value. Use `https://tvmentalhealthguide.org`. If omitted, that production URL is used automatically.

The administrator recipient address is stored in `tv_admin_users.notification_email`. The current migration fills it from the administrator's Supabase Auth email.

Email failure never reverses or blocks a successful Square payment. The pending review remains visible in `/admin` even if the email provider is down.
