# Square provider checkout setup

The provider billing code supports both annual payment choices:

- Basic one-year payment: $12
- Advanced one-year payment: $49
- Basic annual auto-renew
- Advanced annual auto-renew

The browser never receives a Square access token or Supabase service-role key. Provider identity is derived from the signed-in Supabase session, and the server determines the provider plan and amount from the approved publication record rather than trusting browser-supplied prices.

## Cloudflare Pages variables and secrets

Configure these for the Treasure Valley Mental Health Guide Pages project:

```text
SUPABASE_URL=https://mkdkdinjbjxeexiwromi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Supabase service-role secret>

SQUARE_ENVIRONMENT=sandbox
SQUARE_ACCESS_TOKEN=<Square sandbox access token>
SQUARE_LOCATION_ID=<Square sandbox location ID>

SQUARE_BASIC_PLAN_VARIATION_ID=<Square annual Basic subscription plan variation ID>
SQUARE_ADVANCED_PLAN_VARIATION_ID=<Square annual Advanced subscription plan variation ID>

SQUARE_WEBHOOK_SIGNATURE_KEY=<Square webhook signature key>
SQUARE_WEBHOOK_NOTIFICATION_URL=https://tvmentalhealthguide.org/api/payments/square-webhook
```

Use `SQUARE_ENVIRONMENT=production` and production Square credentials only after the sandbox flow has passed end to end.

## Square catalog setup for auto-renew

Create two annual subscription plan variations in Square:

1. TVMHG Basic Annual — $12 every year.
2. TVMHG Advanced Annual — $49 every year.

The IDs placed in `SQUARE_BASIC_PLAN_VARIATION_ID` and `SQUARE_ADVANCED_PLAN_VARIATION_ID` must be the **subscription plan variation IDs**, not the parent subscription plan IDs.

The one-year-only flow does not use these variation IDs. It creates a normal hosted Square payment link for the approved amount.

## Square webhook

Create a Square webhook subscription pointing exactly to:

```text
https://tvmentalhealthguide.org/api/payments/square-webhook
```

Subscribe to at least:

- `payment.created`
- `payment.updated`

Copy the webhook signature key into `SQUARE_WEBHOOK_SIGNATURE_KEY`.

The value of `SQUARE_WEBHOOK_NOTIFICATION_URL` must exactly match the URL registered in Square because Square includes that URL when calculating the webhook signature.

## Preview webhook testing

For the Cloudflare Pages preview branch `feature/square-provider-checkout`, configure the same sandbox variables in the **Preview** environment. Use the stable branch alias rather than an individual deployment URL:

```text
SQUARE_WEBHOOK_NOTIFICATION_URL=https://feature-square-provider-checkout.treasure-valley-mental-health-guide.pages.dev/api/payments/square-webhook
```

During preview testing, the Square Sandbox webhook subscription must use that exact same notification URL. After the feature is merged to production, switch both Square and Cloudflare Production back to:

```text
https://tvmentalhealthguide.org/api/payments/square-webhook
```

## Publication behavior

The checkout endpoint requires all of the following:

- a valid signed-in Supabase provider session;
- a provider profile owned by that user;
- publication status `approved_pending_payment`;
- an approved Basic or Advanced plan.

The server chooses the price from the approved plan:

- Basic: 1200 cents;
- Advanced: 4900 cents.

A successful browser return from Square does **not** publish the provider. The Square webhook must report a completed payment with the expected USD amount. Only then does the server call `billing_activate_provider`, which activates the annual entitlement and publishes the listing.

## Sandbox verification

Run this sequence before switching Square to production:

1. Create or use a provider account.
2. Submit the profile.
3. Approve it in admin so status becomes `approved_pending_payment`.
4. Choose **Pay for one year only** and complete a sandbox payment.
5. Confirm the provider becomes active/published and has a paid-through date one year out.
6. Reset/use another test provider.
7. Choose **Automatically renew annually** and complete the subscription checkout.
8. Confirm the first completed payment activates/publishes the provider.
9. Confirm the billing row records Square customer/order/payment IDs where Square supplies them.
10. Replay the same webhook event and confirm the event ID prevents a second activation.
11. Test an invalid webhook signature and confirm it is rejected.
12. Test a mismatched amount and confirm it does not activate the provider.

## Current boundary

The webhook can map future recurring payments by the Square customer ID saved from the first completed payment. The existing billing table also has a `square_subscription_id` field reserved for richer subscription lifecycle handling (for example explicit subscription cancellation/status webhooks) in the next billing step.
