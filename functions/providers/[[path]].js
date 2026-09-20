const SUPABASE_URL = 'https://mkdkdinjbjxeexiwromi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wDh7HgAGgkfrYuOBvJ0CQg_u-OWKVzt';
const ORIGIN = 'https://tvmentalhealthguide.org';

function esc(value='') {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function cleanUrl(value='') {
  try {
    const u = new URL(String(value));
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
  } catch { return ''; }
}
function initials(first,last) {
  return `${String(first||'').charAt(0)}${String(last||'').charAt(0)}`.toUpperCase() || 'TV';
}
function list(values) {
  return Array.isArray(values) && values.length ? values.map(esc).join(', ') : 'Not specified';
}
function tags(values) {
  return Array.isArray(values) && values.length ? values.map(v=>`<span>${esc(v)}</span>`).join('') : '<span>Not specified</span>';
}
function verified(value) {
  if (!value) return 'Published profile';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Published profile' : `Verified ${d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
}
function youtubeEmbed(value='') {
  try {
    const u = new URL(value);
    let id='';
    if (u.hostname === 'youtu.be') id=u.pathname.slice(1).split('/')[0];
    else if (u.hostname.endsWith('youtube.com')) {
      if (u.pathname === '/watch') id=u.searchParams.get('v') || '';
      else {
        const parts=u.pathname.split('/').filter(Boolean);
        if (['embed','shorts'].includes(parts[0])) id=parts[1] || '';
      }
    }
    return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : '';
  } catch { return ''; }
}
function metaDescription(p) {
  const base = String(p.short_bio || `${p.first_name} ${p.last_name} is a mental health provider in ${p.primary_city}, Idaho.`).replace(/\s+/g,' ').trim();
  return base.length > 155 ? base.slice(0,152).trimEnd() + '…' : base;
}
function notFound() {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Provider Not Found | Treasure Valley Mental Health Guide</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/align-theme.css"><link rel="stylesheet" href="/warm-theme.css"></head><body class="warm-site"><main><section class="resource-hero"><div class="shell"><p class="eyebrow">Provider profile</p><h1>This provider profile is not available.</h1><p>The listing may have moved or may no longer be published.</p><a class="button primary" href="/find-counselor">Return to counselor directory</a></div></section></main></body></html>`,{status:404,headers:{'content-type':'text/html; charset=utf-8','x-robots-tag':'noindex, follow'}});
}

function render(p) {
  const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  const credentials = p.credentials ? `, ${p.credentials}` : '';
  const title = `${fullName}${credentials} in ${p.primary_city}, Idaho | Treasure Valley Mental Health Guide`;
  const description = metaDescription(p);
  const canonical = `${ORIGIN}/providers/${p.public_slug}`;
  const website = cleanUrl(p.website_url);
  const portal = p.plan === 'advanced' ? cleanUrl(p.client_portal_url) : '';
  const video = p.plan === 'advanced' ? youtubeEmbed(p.video_url) : '';
  const updated = p.updated_at ? new Date(p.updated_at).toISOString() : undefined;
  const published = p.published_at ? new Date(p.published_at).toISOString() : undefined;
  const knows = [...new Set([...(p.specialties||[]),...(p.approaches||[])])];

  const jsonLd = {
    '@context':'https://schema.org',
    '@graph':[
      {
        '@type':'ProfilePage',
        '@id':canonical+'#profile',
        url:canonical,
        name:title,
        description,
        dateCreated:published,
        dateModified:updated,
        isPartOf:{'@type':'WebSite',name:'Treasure Valley Mental Health Guide',url:ORIGIN+'/'},
        mainEntity:{
          '@type':'Person',
          '@id':canonical+'#provider',
          name:fullName,
          honorificSuffix:p.credentials || undefined,
          url:canonical,
          sameAs:website ? [website] : undefined,
          worksFor:p.practice_name ? {'@type':'Organization',name:p.practice_name} : undefined,
          homeLocation:{'@type':'Place',name:`${p.primary_city}, Idaho`},
          knowsAbout:knows.length ? knows : undefined
        }
      },
      {
        '@type':'BreadcrumbList',
        itemListElement:[
          {'@type':'ListItem',position:1,name:'Home',item:ORIGIN+'/'},
          {'@type':'ListItem',position:2,name:'Find a Counselor',item:ORIGIN+'/find-counselor'},
          {'@type':'ListItem',position:3,name:fullName,item:canonical}
        ]
      }
    ]
  };
  const safeJson = JSON.stringify(jsonLd).replace(/</g,'\\u003c');
  const clientData = JSON.stringify({
    id:p.id,
    websiteUrl:website,
    portalUrl:portal,
    showWebsiteQr:Boolean(p.plan==='advanced' && p.show_website_qr && website),
    showPortalQr:Boolean(p.plan==='advanced' && p.show_portal_qr && portal)
  }).replace(/</g,'\\u003c');

  const websiteButton = website ? `<a class="button primary" data-provider-event="website_click" href="${esc(website)}" target="_blank" rel="noopener noreferrer">Visit provider website ↗</a>` : '';
  const portalButton = portal ? `<a class="button secondary" data-provider-event="portal_click" href="${esc(portal)}" target="_blank" rel="noopener noreferrer">Client / scheduling portal ↗</a>` : '';
  const license = p.license_number ? `<div class="advanced-profile-detail"><span>State license</span><strong>${esc(p.license_state || 'State')} · ${esc(p.license_number)}</strong></div>` : '';
  const videoCard = video ? `<article class="advanced-profile-card advanced-profile-video-card"><p class="eyebrow">Meet the provider</p><h2>A personal introduction.</h2><div class="advanced-video-wrap"><iframe src="${esc(video)}" title="Video introduction from ${esc(fullName)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div></article>` : '';

  const qrItems = [];
  if (p.plan==='advanced' && p.show_website_qr && website) qrItems.push(`<a class="public-qr-item" data-provider-event="website_click" href="${esc(website)}" target="_blank" rel="noopener noreferrer"><canvas id="publicWebsiteQr" width="190" height="190" aria-label="QR code for provider website"></canvas><strong>Practice website</strong><span>Scan or tap to visit</span></a>`);
  if (p.plan==='advanced' && p.show_portal_qr && portal) qrItems.push(`<a class="public-qr-item" data-provider-event="portal_click" href="${esc(portal)}" target="_blank" rel="noopener noreferrer"><canvas id="publicPortalQr" width="190" height="190" aria-label="QR code for client or scheduling portal"></canvas><strong>Client / scheduling portal</strong><span>Scan or tap to visit</span></a>`);
  const qrCard = qrItems.length ? `<article class="advanced-profile-card public-qr-card"><p class="eyebrow">Quick access</p><h3>Scan to connect.</h3><div class="public-qr-grid">${qrItems.join('')}</div></article>` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="canonical" href="${esc(canonical)}">
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:site_name" content="Treasure Valley Mental Health Guide">
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${ORIGIN}/assets/river-path.webp">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${ORIGIN}/assets/river-path.webp">
<meta name="theme-color" content="#0d2946">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/align-theme.css">
<link rel="stylesheet" href="/warm-theme.css">
<script type="application/ld+json">${safeJson}</script>
</head>
<body class="warm-site advanced-profile-page">
<header class="align-header"><div class="shell align-nav-shell">
<a class="align-brand" href="/" aria-label="Treasure Valley Mental Health Guide home"><span class="align-brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M8 35 20 15l8 12 5-8 7 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 38h30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></span><span class="align-brand-copy"><strong>Treasure Valley</strong><small>Mental Health Guide</small></span></a>
<button class="menu-button align-menu-button" id="menuButton" type="button" aria-expanded="false" aria-controls="primaryNav">Menu</button><nav class="align-primary-nav" id="primaryNav" aria-label="Primary navigation"><details class="nav-dropdown"><summary>Resources</summary><div class="nav-dropdown-menu"><a class="nav-dropdown-all" href="/resources"><strong>All resources</strong><span>Browse the full mental health resource library</span></a><a href="/resources#mental-health-topics"><strong>Mental Health Topics</strong><span>PTSD, trauma, anxiety, depression, grief & more</span></a><a href="/resources#treatment-options"><strong>Treatment Options</strong><span>EMDR, psychiatry, couples counseling & telehealth</span></a><a href="/resources#getting-care"><strong>Getting Care</strong><span>Choosing a counselor and lower-cost options</span></a><a href="/resources#crisis-community-help"><strong>Crisis & Community Help</strong><span>Urgent support, safety and practical assistance</span></a></div></details><a href="/find-counselor">Find a counselor</a><a href="/for-providers">For providers</a></nav>
</div></header>
<div class="crisis-strip" role="note"><div class="shell">Need immediate help? <a href="tel:988">Call 988</a> or <a href="sms:988">text 988</a>. If there is immediate danger, call 911.</div></div>
<main><section class="advanced-profile-hero"><div class="shell">
<a class="advanced-profile-back" href="/find-counselor">← Back to counselor directory</a>
<div class="advanced-profile-shell">
<section class="advanced-profile-intro">
<div class="advanced-profile-avatar">${esc(initials(p.first_name,p.last_name))}</div>
<div class="advanced-profile-heading"><div class="eyebrow">Published provider profile</div><h1>${esc(fullName)}${esc(credentials)}</h1><p>${esc(p.practice_name || 'Independent practice')} · ${esc(p.primary_city || 'Treasure Valley')}</p><div class="advanced-profile-chips"><span>${esc(p.availability || 'Not specified')}</span>${(p.visit_types||[]).map(v=>`<span>${esc(v)}</span>`).join('')}</div></div>
<aside class="advanced-profile-contact"><span class="advanced-profile-plan">${p.plan==='advanced'?'Advanced profile':'Provider profile'}</span><strong>${esc(p.practice_name || fullName)}</strong><small>${esc(p.primary_city || '')}</small>${websiteButton}${portalButton}<a class="button secondary" href="/find-counselor">Back to directory</a></aside>
</section>
<section class="advanced-profile-grid">
<div class="advanced-profile-main">
<article class="advanced-profile-card advanced-profile-about"><p class="eyebrow">About</p><h2>A little more about this provider.</h2><p class="advanced-profile-bio">${esc(p.short_bio || 'No bio has been added yet.')}</p></article>
${videoCard}
<article class="advanced-profile-card"><p class="eyebrow">Areas of support</p><div class="advanced-profile-tag-group">${tags(p.specialties)}</div></article>
<article class="advanced-profile-card"><p class="eyebrow">Services & approaches</p><div class="advanced-profile-two-col"><div><h3>Services</h3><p>${list(p.services)}</p></div><div><h3>Modalities / approaches</h3><p>${list(p.approaches)}</p></div></div></article>
<article class="advanced-profile-card"><p class="eyebrow">Who they work with</p><div class="advanced-profile-tag-group">${tags(p.populations)}</div></article>
</div>
<aside class="advanced-profile-sidebar">
<article class="advanced-profile-card"><p class="eyebrow">At a glance</p><div class="advanced-profile-detail"><span>Availability</span><strong>${esc(p.availability || 'Not specified')}</strong></div><div class="advanced-profile-detail"><span>Visits</span><strong>${list(p.visit_types)}</strong></div><div class="advanced-profile-detail"><span>Insurance / payment</span><strong>${list(p.insurance)}</strong></div><div class="advanced-profile-detail"><span>Provider gender</span><strong>${esc(p.provider_gender || 'Not specified')}</strong></div><div class="advanced-profile-detail"><span>Years in practice</span><strong>${p.years_in_practice ?? 'Not specified'}</strong></div>${license}<div class="advanced-profile-detail"><span>Verification</span><strong>${esc(verified(p.last_verified_at))}</strong></div></article>
${qrCard}
<div class="profile-disclaimer"><strong>Directory notice:</strong> This guide provides directory information, not medical advice or an endorsement of any provider. Confirm credentials, availability, insurance, fees, and fit directly with the provider before beginning care.</div>
</aside>
</section>
</div></div></section></main>
<footer class="align-footer"><div class="shell align-footer-grid"><div><strong>Treasure Valley Mental Health Guide</strong><small>Local counselor directory</small></div><div><span class="footer-label">Guide</span><a href="/find-counselor">Find a counselor</a><a href="/resources">Resources</a></div><div><span class="footer-label">Trust</span><a href="/about">About</a><a href="/directory-standards">Directory standards</a><a href="/privacy">Privacy</a></div><div><span class="footer-label">Directory principle</span><small>Paid plans change profile features, not organic ranking.</small></div></div></footer>
<script>window.TV_PROVIDER_PAGE=${clientData};</script>
<script src="/supabase-config.js"></script>
<script type="module" src="/provider-page.js"></script>
<script src="/resources-nav.js" defer></script>
</body></html>`;
}

export async function onRequestGet(context) {
  const raw=context.params.path;
  const parts=(Array.isArray(raw)?raw:String(raw||'').split('/')).filter(Boolean);
  if (parts.length === 0) {
    return Response.redirect(ORIGIN + '/for-providers', 301);
  }
  if (parts.length !== 1) return notFound();
  const slug=String(parts[0]).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return notFound();

  let response;
  try {
    response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_directory_profile_by_slug`,{
      method:'POST',
      headers:{
        apikey:SUPABASE_KEY,
        Authorization:`Bearer ${SUPABASE_KEY}`,
        'content-type':'application/json'
      },
      body:JSON.stringify({target_slug:slug})
    });
  } catch {
    return new Response('Provider directory temporarily unavailable',{status:503,headers:{'content-type':'text/plain; charset=utf-8','retry-after':'60','x-robots-tag':'noindex'}});
  }
  if (!response.ok) return new Response('Provider directory temporarily unavailable',{status:503,headers:{'content-type':'text/plain; charset=utf-8','retry-after':'60','x-robots-tag':'noindex'}});
  const rows=await response.json();
  const provider=Array.isArray(rows)?rows[0]:null;
  if (!provider) return notFound();

  return new Response(render(provider),{
    status:200,
    headers:{
      'content-type':'text/html; charset=utf-8',
      'cache-control':'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      'x-content-type-options':'nosniff',
      'referrer-policy':'strict-origin-when-cross-origin'
    }
  });
}
