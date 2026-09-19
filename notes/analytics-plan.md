# Analytics & Attribution Plan — Prototype

## Goal

Measure how visitors discover the Treasure Valley Mental Health Guide, what resources/searches they use, and which provider profiles or external websites they visit—without treating sensitive mental-health search text as ordinary marketing data.

## Separate properties

- `TVMentalHealthGuide.org` should be a separate analytics property/site from Bright Hope Therapy.
- Bright Hope Therapy should also remain a separate property.
- Brighter Sites Analytics can aggregate both properties at the owner/admin level while preserving source-site identity.

## Acquisition fields

Safe, ordinary attribution fields:

- first-touch source / medium / campaign
- referring hostname
- landing path
- partner referral code, e.g. `st-lukes-card-a`
- UTM parameters
- session ID / anonymous visitor ID
- device category and coarse technical metadata

Avoid storing:

- client/patient names
- street address
- diagnosis or inferred diagnosis
- free-text clinical disclosures
- referral notes containing health information
- raw search text when it could reveal sensitive mental-health information

For directory search analytics, prefer normalized categories such as `Trauma`, `Anxiety`, `EMDR`, `Adults`, `Meridian`, rather than keeping arbitrary free-text queries indefinitely.

## Event model

### Acquisition / navigation

- `landing_view`
- `resource_view`
- `resource_to_directory`
- `professional_referral_landing`

### Directory interaction

- `directory_search`
- `filter_changed`
- `sort_changed`
- `zero_results`
- `provider_profile_view`
- `provider_outbound_click`

### Provider acquisition

- `provider_listing_info_view`
- `provider_signup_started`
- `provider_signup_completed`
- `provider_profile_verified`
- `provider_profile_updated`

## Funnel examples

### Consumer funnel

`Google Organic → EMDR Resource → Find a Counselor → Bright Hope Profile → Bright Hope Website`

### Professional referral funnel

`Provider QR → Referral Landing → Directory → Provider Profile → Provider Website`

### Brighter Sites funnel

`Provider Directory Profile → For Providers → Brighter Sites attribution link → Brighter Sites inquiry`

## Dashboard cards

- Visitors by acquisition source
- Organic vs referral vs social vs direct
- Top resource pages
- Directory searches by normalized category
- Most-used filters
- Provider profile views
- Provider outbound clicks
- Resource-assisted provider visits
- Referral partner visits by code
- Zero-result searches / unmet demand
- Provider signup and renewal counts

## Important design principle

Do **not** treat “most profile views” as “best counselor.” It is an engagement metric, not a quality score, and should not feed the organic relevance algorithm.
