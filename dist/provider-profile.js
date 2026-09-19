import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cfg = window.TV_GUIDE_SUPABASE;
const supabase = cfg?.url && cfg?.publishableKey ? createClient(cfg.url, cfg.publishableKey) : null;
const target = document.getElementById('profilePage');
const id = new URLSearchParams(location.search).get('id') || '';

const demoAdvancedProfiles = {
  'demo-bright-hope': {
    id: 'demo-bright-hope',
    plan: 'advanced',
    first_name: 'Lisa',
    last_name: 'Bright',
    credentials: 'LCPC',
    practice_name: 'Bright Hope Therapy',
    short_bio: 'Individual counseling for adults with an emphasis on trauma, anxiety, life transitions, and holistic wellness. EMDR trained.',
    primary_city: 'Meridian',
    years_in_practice: 8,
    provider_gender: 'Female',
    license_state: 'Idaho',
    license_number: '',
    website_url: '',
    video_url: '',
    client_portal_url: '',
    availability: 'Accepting new clients',
    visit_types: ['In-person', 'Telehealth'],
    populations: ['Adults'],
    specialties: ['Anxiety', 'Trauma', 'Life Transitions'],
    approaches: ['EMDR', 'Person-centered'],
    services: ['Individual counseling'],
    insurance: ['Self-pay', 'Blue Cross of Idaho'],
    last_verified_at: null,
    demo: true
  }
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function initials(first, last) {
  return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase() || 'TV';
}
function list(values, fallback = 'Not specified') {
  return Array.isArray(values) && values.length ? values.map(esc).join(', ') : fallback;
}
function verified(value, demo) {
  if (demo) return 'Demo profile';
  if (!value) return 'Published profile';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Published profile' : `Verified ${date.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}`;
}

function youtubeEmbedUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./i, '').replace(/^m\./i, '').toLowerCase();
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else if (/^\/(shorts|embed)\//.test(url.pathname)) id = url.pathname.split('/').filter(Boolean)[1] || '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : '';
  } catch {
    return '';
  }
}

function renderProfile(p) {
  const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  document.title = `${fullName || 'Provider'} | Treasure Valley Mental Health Guide`;
  const website = p.website_url ? `<a class="button primary" href="${esc(p.website_url)}" target="_blank" rel="noopener noreferrer">Visit provider website ↗</a>` : '';
  const clientPortal = p.client_portal_url ? `<a class="button secondary" href="${esc(p.client_portal_url)}" target="_blank" rel="noopener noreferrer">Client portal ↗</a>` : '';
  const videoEmbed = youtubeEmbedUrl(p.video_url);
  const license = p.license_number
    ? `<div class="advanced-profile-detail"><span>State license</span><strong>${esc(p.license_state || 'State')} · ${esc(p.license_number)}</strong></div>`
    : '';

  target.className = 'advanced-profile-shell';
  target.innerHTML = `
    <section class="advanced-profile-intro">
      <div class="advanced-profile-avatar">${initials(p.first_name,p.last_name)}</div>
      <div class="advanced-profile-heading">
        <div class="eyebrow">${p.demo ? 'Advanced demo profile' : 'Advanced provider profile'}</div>
        <h1>${esc(fullName)}${p.credentials ? `, ${esc(p.credentials)}` : ''}</h1>
        <p>${esc(p.practice_name || 'Independent practice')} · ${esc(p.primary_city || 'Treasure Valley')}</p>
        <div class="advanced-profile-chips">
          <span>${esc(p.availability || 'Not specified')}</span>
          ${(p.visit_types || []).map(v => `<span>${esc(v)}</span>`).join('')}
        </div>
      </div>
      <aside class="advanced-profile-contact">
        <span class="advanced-profile-plan">Advanced profile</span>
        <strong>${esc(p.practice_name || fullName)}</strong>
        <small>${esc(p.primary_city || '')}</small>
        ${website}
        ${clientPortal}
        <a class="button secondary" href="index.html#find">Back to directory</a>
      </aside>
    </section>

    <section class="advanced-profile-grid">
      <div class="advanced-profile-main">
        <article class="advanced-profile-card advanced-profile-about">
          <p class="eyebrow">About</p>
          <h2>A little more about this provider.</h2>
          <p class="advanced-profile-bio">${esc(p.short_bio || 'No bio has been added yet.')}</p>
        </article>

        ${videoEmbed ? `<article class="advanced-profile-card advanced-profile-video-card">
          <p class="eyebrow">Meet the provider</p>
          <h2>A personal introduction.</h2>
          <div class="advanced-video-wrap"><iframe src="${esc(videoEmbed)}" title="Video introduction from ${esc(fullName)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
        </article>` : ''}

        <article class="advanced-profile-card">
          <p class="eyebrow">Areas of support</p>
          <div class="advanced-profile-tag-group">${(p.specialties || []).map(v => `<span>${esc(v)}</span>`).join('') || '<span>Not specified</span>'}</div>
        </article>

        <article class="advanced-profile-card">
          <p class="eyebrow">Services & approaches</p>
          <div class="advanced-profile-two-col">
            <div><h3>Services</h3><p>${list(p.services)}</p></div>
            <div><h3>Modalities / approaches</h3><p>${list(p.approaches)}</p></div>
          </div>
        </article>

        <article class="advanced-profile-card">
          <p class="eyebrow">Who they work with</p>
          <div class="advanced-profile-tag-group">${(p.populations || []).map(v => `<span>${esc(v)}</span>`).join('') || '<span>Not specified</span>'}</div>
        </article>
      </div>

      <aside class="advanced-profile-sidebar">
        <article class="advanced-profile-card">
          <p class="eyebrow">At a glance</p>
          <div class="advanced-profile-detail"><span>Availability</span><strong>${esc(p.availability || 'Not specified')}</strong></div>
          <div class="advanced-profile-detail"><span>Visits</span><strong>${list(p.visit_types)}</strong></div>
          <div class="advanced-profile-detail"><span>Insurance / payment</span><strong>${list(p.insurance)}</strong></div>
          <div class="advanced-profile-detail"><span>Provider gender</span><strong>${esc(p.provider_gender || 'Not specified')}</strong></div>
          <div class="advanced-profile-detail"><span>Years in practice</span><strong>${p.years_in_practice ?? 'Not specified'}</strong></div>
          ${license}
          <div class="advanced-profile-detail"><span>Verification</span><strong>${esc(verified(p.last_verified_at,p.demo))}</strong></div>
        </article>

        <article class="advanced-profile-card advanced-profile-media-preview">
          <p class="eyebrow">Advanced profile space</p>
          <h3>Room for a richer introduction.</h3>
          <p>Additional office photos and locations can appear here as those Advanced features are connected.</p>
        </article>
      </aside>
    </section>
  `;
}

function showUnavailable() {
  target.className = 'advanced-profile-shell';
  target.innerHTML = `<div class="advanced-profile-card advanced-profile-unavailable"><p class="eyebrow">Profile unavailable</p><h1>This expanded profile is not available.</h1><p>The provider may use a Basic listing, the profile may no longer be published, or the link may be invalid.</p><a class="button primary" href="index.html#find">Return to the directory</a></div>`;
}

async function load() {
  if (demoAdvancedProfiles[id]) {
    renderProfile(demoAdvancedProfiles[id]);
    return;
  }
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) {
    showUnavailable();
    return;
  }
  const { data, error } = await supabase.rpc('get_directory_profile', { target_provider_id: id });
  if (error || !data?.length) {
    if (error) console.error(error);
    showUnavailable();
    return;
  }
  renderProfile(data[0]);
}

load();