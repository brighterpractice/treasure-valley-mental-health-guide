const SUPABASE_URL = 'https://mkdkdinjbjxeexiwromi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wDh7HgAGgkfrYuOBvJ0CQg_u-OWKVzt';
const ORIGIN = 'https://tvmentalhealthguide.org';

const STATIC_PATHS = [
  '/',
  '/find-counselor.html',
  '/resources.html',
  '/about.html',
  '/editorial-policy.html',
  '/directory-standards.html',
  '/privacy.html',
  '/for-providers',
  '/ptsd.html',
  '/trauma.html',
  '/emdr.html',
  '/anxiety.html',
  '/depression.html',
  '/grief.html',
  '/relationships.html',
  '/psychiatry-medication.html',
  '/telehealth.html',
  '/choosing-a-counselor.html',
  '/lower-cost-care.html',
  '/community-assistance.html',
  '/domestic-violence-safety.html',
  '/substance-use.html',
  '/crisis-help.html'
];

function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
}

function entry(url,lastmod,changefreq='monthly',priority='0.7') {
  return `  <url>
    <loc>${xmlEscape(url)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export async function onRequestGet() {
  const lastmod = '2026-09-19';
  const entries = STATIC_PATHS.map(path => {
    if (path === '/') return entry(ORIGIN+'/',lastmod,'weekly','1.0');
    if (path === '/find-counselor.html') return entry(ORIGIN+path,lastmod,'daily','0.9');
    if (path === '/resources.html') return entry(ORIGIN+path,lastmod,'weekly','0.9');
    return entry(ORIGIN+path,lastmod,'monthly','0.7');
  });

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/list_directory_profiles_v2`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ page_size: 200, page_offset: 0 })
    });
    if (response.ok) {
      const providers = await response.json();
      for (const provider of providers || []) {
        if (!provider?.public_slug) continue;
        const modified = provider.last_verified_at
          ? new Date(provider.last_verified_at).toISOString().slice(0,10)
          : lastmod;
        entries.push(entry(`${ORIGIN}/providers/${provider.public_slug}/`, modified, 'weekly', '0.8'));
      }
    }
  } catch {}

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=900',
      'x-content-type-options': 'nosniff'
    }
  });
}
