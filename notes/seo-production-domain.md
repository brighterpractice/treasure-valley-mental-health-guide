# Production SEO domain configuration

## Canonical production domain
Confirmed production origin:

`https://tvmentalhealthguide.org`

The site also owns:

`https://tvmentalhealthguide.com`

The `.com` domain should redirect permanently to the matching path on the `.org` domain.

## Redirect behavior to configure in Cloudflare

Use permanent 301 redirects that preserve the path and query string:

- `tvmentalhealthguide.com/*` → `https://tvmentalhealthguide.org/<same-path>`
- `www.tvmentalhealthguide.com/*` → `https://tvmentalhealthguide.org/<same-path>`
- `www.tvmentalhealthguide.org/*` → `https://tvmentalhealthguide.org/<same-path>`
- the temporary `*.pages.dev` hostname → `https://tvmentalhealthguide.org/<same-path>`

Do not serve duplicate indexable copies of the site from those alternate hosts.

## Production SEO now in the repository

- Absolute canonical URLs on indexable public pages
- Absolute `og:url` values
- Large social-preview metadata using the site hero image
- `dist/sitemap.xml` using the `.org` origin
- `Sitemap: https://tvmentalhealthguide.org/sitemap.xml` in `robots.txt`
- JSON-LD for the homepage, directory, resource hub, health resource pages, provider sales page, and trust pages
- Private provider/admin pages protected with `noindex`
- UUID-based Advanced provider pages remain `noindex,follow` until permanent provider slugs are implemented
- Referral attribution page remains `noindex,follow`

## Initial sitemap scope

The sitemap contains the public guide, counselor search, resources hub, trust pages, provider information page, and the current mental-health/resource library.

It intentionally excludes:
- provider login
- provider dashboard
- admin review
- referral attribution page
- UUID-based provider profile URLs

## Remaining launch tasks

1. Attach `tvmentalhealthguide.org` as the production custom domain for the Pages project.
2. Attach `tvmentalhealthguide.com` and configure the 301 redirect to `.org`.
3. Redirect `www` aliases to the apex `.org`.
4. Redirect or otherwise prevent indexing of the temporary Pages hostname.
5. Verify HTTPS and redirect chains after DNS/custom-domain activation.
6. Submit `https://tvmentalhealthguide.org/sitemap.xml` to Google Search Console and Bing Webmaster Tools.
7. Validate structured data and social previews on the live production domain.
8. Run Lighthouse/Core Web Vitals against the live deployment.
9. Implement permanent provider slugs before provider profile pages are indexed.
10. Replace the current public-geocoder dependency with a production-ready geocoding arrangement and update the Privacy page if the data flow changes.
