# Treasure Valley Mental Health Guide

A warm, local directory for finding counselors and mental health resources across Idaho's Treasure Valley.

## Current stack

- Static HTML/CSS/JavaScript public site
- Cloudflare Pages for hosting
- Supabase for provider authentication, profiles, publication workflow, and future privacy-conscious analytics
- GitHub for source control and deployment history

## Local structure

- `dist/` — deployable Cloudflare Pages output
- `supabase/migrations/` — tracked database migrations
- `notes/` — product and integration notes

The public publishable Supabase key in `dist/supabase-config.js` is intentionally browser-safe. Never commit database passwords, secret keys, service-role keys, or `.env` files.

## Supabase project

The provider foundation migration is applied to the project configured in `dist/supabase-config.js`. It uses explicit Data API grants, RLS, owner-only profile access, administrator-controlled publication status and plan, and a published-only directory RPC. The database currently contains no provider records.

## Deployment

Cloudflare Pages should use the `dist` directory as its build output. A static deployment requires no build command. Connect this repository after its dedicated GitHub repository is created.
