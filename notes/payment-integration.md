# Brighter Sites / Square payment handoff

## Goal
Reuse the existing Square setup behind Brighter Sites while keeping Treasure Valley Mental Health Guide as a separate public brand/domain.

## Product identifiers
- `tvmhg_basic_annual` — $12/year
- `tvmhg_advanced_annual` — $49/year

## Recommended flow
1. Provider signs in to TV Mental Health Guide using Supabase Auth.
2. Provider selects Basic or Advanced.
3. TVMHG calls a server-side Brighter Sites payment endpoint with provider ID, product ID, and success/cancel URLs.
4. Brighter Sites creates a Square checkout/subscription session using server-held Square credentials.
5. Browser is redirected to Square-hosted checkout.
6. Square sends a webhook to the Brighter Sites payment service.
7. The server verifies the webhook signature and maps the Square customer/order/subscription back to the TVMHG provider ID.
8. The server updates `provider_subscriptions` using the Supabase service role.
9. TVMHG reads the resulting entitlement and unlocks Advanced features when appropriate.

## Suggested API contract
`POST /api/payments/checkout`

Request:
```json
{
  "product": "tvmhg_advanced_annual",
  "externalAccountId": "<provider_uuid>",
  "successUrl": "https://tvmhguide.org/provider/billing?checkout=success",
  "cancelUrl": "https://tvmhguide.org/provider/billing?checkout=cancel"
}
```

Response:
```json
{
  "checkoutUrl": "https://square.link/..."
}
```

## Important boundaries
- Never expose Square access tokens in browser code.
- Do not trust a browser redirect as proof of payment; use verified Square webhooks.
- Keep billing identifiers separate from public profile data.
- If TVMHG later becomes a separate legal entity, revisit merchant-account/accounting architecture.
