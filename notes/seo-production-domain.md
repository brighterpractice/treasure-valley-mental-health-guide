# Production SEO activation

The public site is intentionally not canonicalized to the temporary Cloudflare Pages hostname.

## Planned production host
The current product notes reference `TVMentalHealthGuide.org`. Confirm that this is the actual connected production domain before activating canonical URLs.

## When the production domain is connected
1. Add absolute `<link rel="canonical">` tags to every public page.
2. Add absolute `og:url` values.
3. Add a production social-share image and absolute `og:image` / `twitter:image` URLs.
4. Generate `dist/sitemap.xml` using the production origin.
5. Add `Sitemap: https://<production-domain>/sitemap.xml` to `dist/robots.txt`.
6. Redirect the `*.pages.dev` hostname and any alternate domains to the production host where practical.
7. Add the production domain to Google Search Console and Bing Webmaster Tools.
8. Validate structured data, mobile rendering, Core Web Vitals, redirects, 404s, and sitemap fetches.

## Public pages to include in the initial sitemap
- /
- /find-counselor.html
- /resources.html
- /about.html
- /editorial-policy.html
- /directory-standards.html
- /privacy.html
- /providers.html
- /referral.html
- /ptsd.html
- /trauma.html
- /emdr.html
- /anxiety.html
- /depression.html
- /grief.html
- /relationships.html
- /psychiatry-medication.html
- /telehealth.html
- /choosing-a-counselor.html
- /lower-cost-care.html
- /community-assistance.html
- /domestic-violence-safety.html
- /substance-use.html
- /crisis-help.html

Provider profile URLs should be added only after permanent, crawlable provider slugs are implemented. Do not add provider-login, dashboard, or admin pages to the sitemap.
