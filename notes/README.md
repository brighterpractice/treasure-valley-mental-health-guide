# Treasure Valley Mental Health Guide — Product Prototype

Standalone prototype for a community mental-health resource and self-service local counselor directory. Public branding is **Treasure Valley Mental Health Guide**; the planned short domain is **TVMentalHealthGuide.org**, with the `.com` optionally redirecting.

## Open these first
- `index.html` — public resource hub + counselor search/matching
- `for-providers.html` — provider-facing pricing and onboarding (`/for-providers`)
- `dashboard.html` — self-service provider portal prototype
- `referral.html` — professional referral-link concept

## Provider plans
### Basic — $12/year
Core searchable profile, headshot, bio, specialties, approaches, populations, insurance/payment, visit type, availability, website/contact information, primary location, self-service editing, and last-verified date.

### Advanced — $49/year
Everything in Basic plus expanded content, extra photos, video embed, multiple locations, QR code, direct scheduling link, and provider-facing analytics. Analytics include profile views, unique visitors, outbound clicks, traffic source, and aggregated structured search intent such as specialty, modality, city, insurance, and visit type.

## Ranking/sorting rules
- Default public directory sort: **last name A–Z**.
- Optional sorts: distance, relevance to selected filters, accepting-new-clients status, years in practice.
- Listing plan does **not** influence organic placement.
- Matching uses structured provider data rather than keyword stuffing.

## Self-service architecture
- Supabase Auth for provider login.
- Postgres/Supabase for provider data.
- Supabase Storage for headshots and additional Advanced-plan photos.
- Row-level security so providers can edit only their own profile.
- Initial publish workflow: draft → submitted → published.
- Periodic verification reminders refresh the public last-verified date.

See `supabase-schema.sql` for the prototype database/RLS design.

## Payment architecture
The intended flow reuses the existing Brighter Sites Square integration rather than creating a second client-side payment implementation. Provider chooses a plan → TVMHG calls a server-side Brighter Sites payment endpoint → Square-hosted checkout → verified Square webhook → Supabase subscription entitlement update.

See `payment-integration.md`.

## Analytics privacy
Do not expose individual visitor identities, individual search histories, raw sensitive free-text queries, or tiny cohorts. Normalize search intent into structured categories and show categories only after a minimum-count threshold (prototype uses 5).

## Prototype disclaimer
Most provider profiles in the public demo are fictional layout/matching data. The Bright Hope Therapy example uses information supplied for prototype development and should not be treated as a live verified listing.
