import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cfg = window.TV_GUIDE_SUPABASE;
const supabase = cfg?.url && cfg?.publishableKey
  ? createClient(cfg.url, cfg.publishableKey)
  : null;

let providers = [];
let directoryMode = 'loading';
let userChoseSort = false;

const state = {
  specialties: new Set(),
  originCoords: null,
  radius: 5,
  city: '',
  population: '',
  gender: '',
  visit: '',
  availability: '',
  insurance: '',
  approach: '',
  search: '',
  sort: 'az'
};

const cityCoordinates = {
  Meridian: [43.6121, -116.3915],
  Boise: [43.6150, -116.2023],
  Eagle: [43.6954, -116.3540],
  Nampa: [43.5407, -116.5635],
  Kuna: [43.4918, -116.4201],
  Star: [43.6921, -116.4935],
  Caldwell: [43.6629, -116.6874]
};

const els = {
  results: document.getElementById('results'),
  count: document.getElementById('resultsCount'),
  summary: document.getElementById('matchSummary'),
  search: document.getElementById('searchText'),
  address: document.getElementById('addressFilter'),
  radius: document.getElementById('radiusFilter'),
  applyAddress: document.getElementById('applyAddressFilter'),
  addressStatus: document.getElementById('addressStatus'),
  city: document.getElementById('cityFilter'),
  population: document.getElementById('populationFilter'),
  gender: document.getElementById('genderFilter'),
  visit: document.getElementById('visitFilter'),
  availability: document.getElementById('availabilityFilter'),
  insurance: document.getElementById('insuranceFilter'),
  approach: document.getElementById('approachFilter'),
  sort: document.getElementById('sortSelect'),
  profileDialog: document.getElementById('profileDialog'),
  profileDialogContent: document.getElementById('profileDialogContent')
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'
  }[ch]));
}

function normalizeVisitTypes(values = []) {
  const out = new Set();
  for (const value of values || []) {
    if (value === 'In-person & telehealth') {
      out.add('In-person');
      out.add('Telehealth');
    } else if (value) out.add(value);
  }
  return [...out];
}

function mapDirectoryProfile(row) {
  return {
    id: String(row.id),
    publicSlug: row.public_slug || '',
    name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    credentials: row.credentials || '',
    practice: row.practice_name || 'Independent practice',
    city: row.primary_city || '',
    gender: row.provider_gender || '',
    licenseState: row.license_state || '',
    licenseNumber: row.license_number || '',
    specialties: Array.isArray(row.specialties) ? row.specialties : [],
    approaches: Array.isArray(row.approaches) ? row.approaches : [],
    services: Array.isArray(row.services) ? row.services : [],
    populations: Array.isArray(row.populations) ? row.populations : [],
    insurance: Array.isArray(row.insurance) ? row.insurance : [],
    visits: normalizeVisitTypes(row.visit_types),
    availability: row.availability || 'Not specified',
    years: Number.isFinite(row.years_in_practice) ? row.years_in_practice : null,
    bio: row.short_bio || '',
    website: row.website_url || '',
    latitude: Number.isFinite(row.office_latitude) ? row.office_latitude : null,
    longitude: Number.isFinite(row.office_longitude) ? row.office_longitude : null,
    verifiedLabel: formatVerifiedDate(row.last_verified_at),
    plan: row.plan || 'basic',
    isDemo: false
  };
}

function formatVerifiedDate(value) {
  if (!value) return 'Published profile';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Published profile';
  return `Verified ${date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`;
}

function initials(name) {
  return String(name || '').split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function lastName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return (parts[parts.length - 1] || '').toLowerCase();
}

function compareAlphabetical(a, b) {
  return lastName(a.provider.name).localeCompare(lastName(b.provider.name)) || a.provider.name.localeCompare(b.provider.name);
}

function milesBetweenCoords(a, b) {
  if (!a || !b) return null;
  const rad = d => d * Math.PI / 180;
  const R = 3958.8;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const lat1 = rad(a[0]);
  const lat2 = rad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function providerCoords(provider) {
  if (Number.isFinite(provider.latitude) && Number.isFinite(provider.longitude)) {
    return [provider.latitude, provider.longitude];
  }
  if (provider.isDemo && cityCoordinates[provider.city]) return cityCoordinates[provider.city];
  return null;
}

function containsValue(values, wanted) {
  const query = String(wanted || '').trim().toLowerCase();
  if (!query) return true;
  return (values || []).some(value => {
    const candidate = String(value || '').trim().toLowerCase();
    return candidate === query || candidate.includes(query) || query.includes(candidate);
  });
}

function providerSearchText(provider) {
  return [
    provider.name, provider.practice, provider.city, provider.gender, provider.availability,
    ...provider.specialties, ...provider.approaches, ...provider.services,
    ...provider.populations, ...provider.insurance, ...provider.visits, provider.bio
  ].join(' ').toLowerCase();
}

function addCriterion(criteria, label, matched, category) {
  criteria.push({ label, matched: Boolean(matched), category });
}

function calculateMatch(provider) {
  const criteria = [];
  const text = providerSearchText(provider);

  if (state.search) {
    const terms = state.search.toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean);
    const matchedTerms = terms.filter(term => text.includes(term));
    addCriterion(criteria, `Support: ${state.search}`, terms.length > 0 && matchedTerms.length === terms.length, 'support');
  }

  for (const specialty of state.specialties) {
    addCriterion(criteria, specialty, containsValue([...provider.specialties, ...provider.approaches], specialty), 'support');
  }

  if (state.originCoords) {
    const distance = milesBetweenCoords(state.originCoords, providerCoords(provider));
    const matched = distance !== null && distance <= state.radius;
    addCriterion(criteria, `Within ${state.radius} mile${state.radius === 1 ? '' : 's'}`, matched, 'distance');
  }

  if (state.city) addCriterion(criteria, state.city, provider.city.toLowerCase() === state.city.toLowerCase(), 'location');
  if (state.population) addCriterion(criteria, state.population, containsValue(provider.populations, state.population), 'population');
  if (state.gender) addCriterion(criteria, `${state.gender} provider`, provider.gender.toLowerCase() === state.gender.toLowerCase(), 'gender');
  if (state.visit) addCriterion(criteria, state.visit, containsValue(provider.visits, state.visit), 'visit');
  if (state.availability) addCriterion(criteria, state.availability, provider.availability.toLowerCase() === state.availability.toLowerCase(), 'availability');
  if (state.insurance) addCriterion(criteria, state.insurance, containsValue(provider.insurance, state.insurance), 'insurance');
  if (state.approach) addCriterion(criteria, state.approach, containsValue(provider.approaches, state.approach), 'approach');

  const matched = criteria.filter(item => item.matched);
  const unmatched = criteria.filter(item => !item.matched);
  const total = criteria.length;
  const count = matched.length;
  const relevance = total ? Math.round((count / total) * 100) : 0;
  return { criteria, matched, unmatched, count, total, relevance };
}

function hasPreferences() {
  return Boolean(
    state.search || state.originCoords || state.city || state.population || state.gender ||
    state.visit || state.availability || state.insurance || state.approach || state.specialties.size
  );
}

function matchTier(match) {
  if (!match.total) return 'none';
  const missing = match.total - match.count;
  if (missing === 0) return 'exact';
  if (missing <= 2) return 'close';
  return 'other';
}

function tierLabel(tier) {
  if (tier === 'exact') return 'Matches all selected preferences';
  if (tier === 'close') return 'Close matches';
  if (tier === 'other') return 'Other providers to consider';
  return '';
}

function matchLabel(match) {
  if (!match.total) return 'Profile available';
  if (match.count === match.total) return `Matches all ${match.total}`;
  return `Matches ${match.count} of ${match.total}`;
}

function sortRows(rows) {
  if (hasPreferences() && !userChoseSort) {
    state.sort = 'relevance';
    els.sort.value = 'relevance';
  }

  if (state.sort === 'relevance') {
    rows.sort((a, b) => b.match.relevance - a.match.relevance || b.match.count - a.match.count || compareAlphabetical(a, b));
  } else if (state.sort === 'distance') {
    rows.sort((a, b) => {
      const da = state.originCoords ? milesBetweenCoords(state.originCoords, providerCoords(a.provider)) : null;
      const db = state.originCoords ? milesBetweenCoords(state.originCoords, providerCoords(b.provider)) : null;
      return (da ?? Number.POSITIVE_INFINITY) - (db ?? Number.POSITIVE_INFINITY) || compareAlphabetical(a, b);
    });
  } else if (state.sort === 'availability') {
    rows.sort((a, b) => Number(b.provider.availability === 'Accepting new clients') - Number(a.provider.availability === 'Accepting new clients') || compareAlphabetical(a, b));
  } else if (state.sort === 'experience') {
    rows.sort((a, b) => (b.provider.years ?? -1) - (a.provider.years ?? -1) || compareAlphabetical(a, b));
  } else {
    rows.sort(compareAlphabetical);
  }
}

function criterionTags(match) {
  if (!match.total) return '';
  const good = match.matched.slice(0, 4)
    .map(item => `<span class="match-tag matched">✓ ${escapeHtml(item.label)}</span>`).join('');
  const missing = match.unmatched.slice(0, 3)
    .map(item => `<span class="match-tag not-matched">Not matched: ${escapeHtml(item.label)}</span>`).join('');
  const more = match.unmatched.length > 3
    ? `<span class="match-tag not-matched">+${match.unmatched.length - 3} more not matched</span>`
    : '';
  return `${good}${missing}${more}`;
}

function render() {
  const active = hasPreferences();
  const rows = providers.map(provider => ({ provider, match: calculateMatch(provider) }));
  sortRows(rows);

  els.count.textContent = `${rows.length} provider${rows.length === 1 ? '' : 's'}`;
  els.summary.textContent = active
    ? ' ranked by how many of your selected preferences are listed on each profile'
    : ' in this guide';

  if (!rows.length) {
    if (directoryMode === 'error') {
      els.results.innerHTML = '<div class="no-results"><h3>The provider directory could not be loaded.</h3><p>Please refresh the page and try again.</p></div>';
    } else {
      els.results.innerHTML = '<div class="no-results"><h3>No provider profiles are published yet.</h3><p>Approved providers will appear here automatically.</p></div>';
    }
    return;
  }

  let currentTier = null;
  let html = '';
  for (const { provider, match } of rows) {
    const tier = active ? matchTier(match) : 'none';
    if (active && state.sort === 'relevance' && tier !== currentTier) {
      currentTier = tier;
      html += `<div class="match-tier-heading"><strong>${tierLabel(tier)}</strong><span>${tier === 'exact' ? 'Every selected preference is listed on these profiles.' : tier === 'close' ? 'These profiles are missing one or two of your selected preferences.' : 'These providers remain visible even though several preferences are not matched.'}</span></div>`;
    }

    const distance = state.originCoords ? milesBetweenCoords(state.originCoords, providerCoords(provider)) : null;
    const distanceLine = distance !== null
      ? `<span class="distance-pill">${distance < 0.1 ? '&lt;0.1' : distance.toFixed(1)} mi away</span>`
      : '';
    const tags = active
      ? criterionTags(match)
      : provider.specialties.slice(0, 3).map(t => `<span class="match-tag">${escapeHtml(t)}</span>`).join('');

    html += `
      <article class="provider-card">
        <div class="provider-avatar">${escapeHtml(initials(provider.name))}</div>
        <div>
          <h3>${escapeHtml(provider.name)}${provider.credentials ? `, ${escapeHtml(provider.credentials)}` : ''}</h3>
          <div class="provider-meta">${escapeHtml(provider.practice)} · ${escapeHtml(provider.city)}${provider.years !== null ? ` · ${provider.years} year${provider.years === 1 ? '' : 's'} in practice` : ''}</div>
          <div class="match-tags">${distanceLine}${tags}</div>
          ${active && match.unmatched.length ? '<div class="match-disclaimer">“Not matched” means the selected preference is not listed as a match on this provider profile; confirm details directly with the provider.</div>' : ''}
        </div>
        <div class="provider-side">
          <div class="match-strength">${escapeHtml(matchLabel(match))}</div>
          <button class="card-link" data-profile="${escapeHtml(provider.id)}">View profile</button>
          <div class="verified">${escapeHtml(provider.verifiedLabel)}</div>
        </div>
      </article>`;
  }
  els.results.innerHTML = html;
  document.querySelectorAll('[data-profile]').forEach(btn => btn.addEventListener('click', () => openProfile(btn.dataset.profile)));
}

function openProfile(id) {
  const p = providers.find(provider => provider.id === id);
  if (!p) return;
  recordProviderEvent(p, 'profile_view');
  els.profileDialogContent.innerHTML = `
    <div class="dialog-hero">
      <div class="provider-avatar">${escapeHtml(initials(p.name))}</div>
      <div><div class="eyebrow">Published provider profile</div><h2>${escapeHtml(p.name)}${p.credentials ? `, ${escapeHtml(p.credentials)}` : ''}</h2><p>${escapeHtml(p.practice)} · ${escapeHtml(p.city)}</p></div>
    </div>
    <p>${escapeHtml(p.bio)}</p>
    <div class="profile-detail-grid">
      <div><span>Specialties</span><strong>${p.specialties.length ? p.specialties.map(escapeHtml).join(', ') : 'Not specified'}</strong></div>
      <div><span>Approaches</span><strong>${p.approaches.length ? p.approaches.map(escapeHtml).join(', ') : 'Not specified'}</strong></div>
      <div><span>Services</span><strong>${p.services.length ? p.services.map(escapeHtml).join(', ') : 'Not specified'}</strong></div>
      <div><span>Works with</span><strong>${p.populations.length ? p.populations.map(escapeHtml).join(', ') : 'Not specified'}</strong></div>
      <div><span>Visits</span><strong>${p.visits.length ? p.visits.map(escapeHtml).join(', ') : 'Not specified'}</strong></div>
      <div><span>Insurance / payment</span><strong>${p.insurance.length ? p.insurance.map(escapeHtml).join(', ') : 'Not specified'}</strong></div>
      <div><span>Availability</span><strong>${escapeHtml(p.availability)}</strong></div>
      <div><span>Provider gender</span><strong>${p.gender ? escapeHtml(p.gender) : 'Not specified'}</strong></div>
      ${p.licenseNumber ? `<div><span>State license</span><strong>${escapeHtml(p.licenseState || 'State')} · ${escapeHtml(p.licenseNumber)}</strong></div>` : ''}
      <div><span>Verification</span><strong>${escapeHtml(p.verifiedLabel)}</strong></div>
    </div>
    <div class="profile-dialog-actions">
      ${p.website ? `<a class="button secondary" data-provider-website href="${escapeHtml(p.website)}" target="_blank" rel="noopener noreferrer">Visit provider website ↗</a>` : ''}
      ${p.publicSlug ? `<a class="button primary" href="/providers/${encodeURIComponent(p.publicSlug)}">View profile →</a>` : ''}
    </div>`;
  els.profileDialog.querySelector('[data-provider-website]')?.addEventListener('click', () => recordProviderEvent(p, 'website_click'));
  els.profileDialog.showModal();
}

async function geocodeVisitorLocation(value) {
  const locationValue = String(value || '').trim();
  if (!locationValue) return null;
  const response = await fetch('/api/geocode', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ address: locationValue })
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || 'Location lookup failed');
  if (!result?.found) return null;
  const lat = Number(result.lat);
  const lng = Number(result.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

function visitorKey() {
  const keyName = 'tvmh_anonymous_visitor';
  let value = localStorage.getItem(keyName);
  if (!value) {
    value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(keyName, value);
  }
  return value;
}

async function recordProviderEvent(provider, eventKind) {
  if (!supabase || !provider || provider.isDemo) return;
  try {
    await supabase.rpc('record_provider_event', {
      target_provider_id: provider.id,
      event_kind: eventKind,
      anonymous_visitor_key: visitorKey(),
      specialty_values: [...state.specialties],
      approach_values: state.approach ? [state.approach] : [],
      city_value: state.city || '',
      visit_value: state.visit || '',
      insurance_value: state.insurance || '',
      source_value: 'directory_search'
    });
  } catch (error) {
    console.warn('Directory analytics event could not be recorded', error);
  }
}

function markPreferenceChanged() {
  if (!userChoseSort) {
    state.sort = 'relevance';
    els.sort.value = 'relevance';
  }
  render();
}

function bindSelect(el, key) {
  el?.addEventListener('change', () => {
    state[key] = el.value;
    markPreferenceChanged();
  });
}

function addUpdateButton() {
  if (document.getElementById('applySearchPreferences')) return;
  const details = document.querySelector('.more-filters');
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'applySearchPreferences';
  button.className = 'button primary directory-update-results';
  button.textContent = 'Update results';
  button.addEventListener('click', () => {
    state.search = els.search?.value.trim() || '';
    state.city = els.city?.value || '';
    state.population = els.population?.value || '';
    state.gender = els.gender?.value || '';
    state.visit = els.visit?.value || '';
    state.availability = els.availability?.value || '';
    state.insurance = els.insurance?.value || '';
    state.approach = els.approach?.value || '';
    if (!userChoseSort) {
      state.sort = 'relevance';
      els.sort.value = 'relevance';
    }
    render();
    document.querySelector('.results-toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  details?.insertAdjacentElement('afterend', button);
}

function addMatchStyles() {
  if (document.getElementById('directoryMatchStyles')) return;
  const style = document.createElement('style');
  style.id = 'directoryMatchStyles';
  style.textContent = `
    .directory-update-results{width:100%;margin:14px 0 4px}
    .match-tier-heading{display:flex;flex-direction:column;gap:3px;margin:18px 0 8px;padding:10px 12px;border-left:3px solid #6c91ad;background:rgba(255,255,255,.56);border-radius:7px}
    .match-tier-heading strong{color:#173652;font-size:.96rem}.match-tier-heading span{color:#647789;font-size:.8rem}
    .match-tag.not-matched{background:#f5f1eb;color:#725f50;border-color:#ded4c8}
    .match-disclaimer{margin-top:7px;color:#71808e;font-size:.72rem;line-height:1.35}
    .match-strength{white-space:nowrap}
  `;
  document.head.append(style);
}

async function loadProviders() {
  els.count.textContent = 'Loading…';
  els.summary.textContent = '';
  els.results.innerHTML = '<div class="no-results"><h3>Loading provider profiles…</h3></div>';
  if (!supabase) {
    directoryMode = 'error';
    providers = [];
    render();
    return;
  }

  const { data, error } = await supabase.rpc('list_directory_profiles_v2', { page_size: 200, page_offset: 0 });
  if (error) {
    console.error('Unable to load published provider profiles:', error);
    directoryMode = 'error';
    providers = [];
    render();
    return;
  }

  providers = (data || []).map(mapDirectoryProfile);
  directoryMode = 'live';
  const note = document.querySelector('.preview-note');
  if (note) note.textContent = providers.length ? 'Published provider profiles.' : 'No provider profiles are published yet.';
  render();
}

bindSelect(els.city, 'city');
bindSelect(els.population, 'population');
bindSelect(els.gender, 'gender');
bindSelect(els.visit, 'visit');
bindSelect(els.availability, 'availability');
bindSelect(els.insurance, 'insurance');
bindSelect(els.approach, 'approach');

els.sort?.addEventListener('change', () => {
  userChoseSort = true;
  state.sort = els.sort.value;
  render();
});

els.radius?.addEventListener('change', () => {
  state.radius = Number(els.radius.value) || 5;
  if (state.originCoords) markPreferenceChanged();
});

els.applyAddress?.addEventListener('click', async () => {
  const value = els.address?.value.trim() || '';
  if (!value) {
    state.originCoords = null;
    els.addressStatus.textContent = 'Enter a street address, ZIP code, or city to use distance as a preference.';
    render();
    return;
  }
  els.applyAddress.disabled = true;
  els.addressStatus.textContent = 'Locating…';
  try {
    const coords = await geocodeVisitorLocation(value);
    if (!coords) {
      state.originCoords = null;
      els.addressStatus.textContent = 'We could not locate that place. Try adding city, state, or ZIP.';
      render();
      return;
    }
    state.originCoords = coords;
    state.radius = Number(els.radius?.value) || 5;
    els.addressStatus.textContent = `Distance is now a preference: within ${state.radius} mile${state.radius === 1 ? '' : 's'}. Providers outside that range will still appear lower in the results.`;
    markPreferenceChanged();
  } catch (error) {
    console.error(error);
    state.originCoords = null;
    els.addressStatus.textContent = 'Location lookup is temporarily unavailable.';
  } finally {
    els.applyAddress.disabled = false;
  }
});

els.address?.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    els.applyAddress?.click();
  }
});

let searchTimer = null;
els.search?.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = els.search.value.trim();
    markPreferenceChanged();
  }, 180);
});

document.querySelectorAll('.filter-chip').forEach(chip => chip.addEventListener('click', () => {
  const value = chip.dataset.value;
  if (state.specialties.has(value)) {
    state.specialties.delete(value);
    chip.classList.remove('active');
  } else {
    state.specialties.add(value);
    chip.classList.add('active');
  }
  markPreferenceChanged();
}));

document.getElementById('clearFilters')?.addEventListener('click', () => {
  state.specialties.clear();
  state.originCoords = null;
  state.radius = 5;
  state.city = state.population = state.gender = state.visit = state.availability = state.insurance = state.approach = state.search = '';
  state.sort = 'az';
  userChoseSort = false;
  [els.address, els.city, els.population, els.gender, els.visit, els.availability, els.insurance, els.approach, els.search]
    .filter(Boolean).forEach(el => { el.value = ''; });
  if (els.radius) els.radius.value = '5';
  if (els.sort) els.sort.value = 'az';
  if (els.addressStatus) els.addressStatus.textContent = 'Your typed location is used only for this search and is not shown to providers.';
  document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
  render();
});

document.getElementById('closeDialog')?.addEventListener('click', () => els.profileDialog?.close());
document.getElementById('menuButton')?.addEventListener('click', () => {
  const nav = document.getElementById('primaryNav');
  const open = nav?.classList.toggle('open');
  document.getElementById('menuButton')?.setAttribute('aria-expanded', String(Boolean(open)));
});

document.querySelectorAll('#primaryNav a').forEach(a => a.addEventListener('click', () => document.getElementById('primaryNav')?.classList.remove('open')));

const initialQuery = new URLSearchParams(location.search).get('q') || '';
if (initialQuery && els.search) {
  els.search.value = initialQuery;
  state.search = initialQuery.trim();
}

addMatchStyles();
addUpdateButton();
loadProviders();
