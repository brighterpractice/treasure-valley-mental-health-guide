import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cfg = window.TV_GUIDE_SUPABASE;
const supabase = cfg?.url && cfg?.publishableKey
  ? createClient(cfg.url, cfg.publishableKey)
  : null;

let providers = [];
let directoryMode = 'loading';

const demoProviders = [
  {
    id: 'demo-bright-hope',
    name: 'Lisa Bright',
    credentials: 'LCPC',
    practice: 'Bright Hope Therapy',
    city: 'Meridian',
    gender: 'Female',
    specialties: ['Anxiety', 'Trauma', 'Life Transitions'],
    approaches: ['EMDR', 'Person-centered'],
    services: ['Individual counseling'],
    populations: ['Adults'],
    insurance: ['Self-pay', 'Blue Cross of Idaho'],
    visits: ['In-person', 'Telehealth'],
    availability: 'Accepting new clients',
    years: 8,
    bio: 'Individual counseling for adults with an emphasis on trauma, anxiety, life transitions, and holistic wellness. EMDR trained.',
    website: '',
    verifiedLabel: 'Demo profile',
    isDemo: true
  },
  {
    id: 'demo-riverbend',
    name: 'Morgan Reed',
    credentials: 'LCSW',
    practice: 'Riverbend Counseling',
    city: 'Boise',
    gender: 'Female',
    specialties: ['Anxiety', 'Grief', 'Relationships'],
    approaches: ['CBT', 'ACT'],
    services: ['Individual counseling', 'Couples counseling'],
    populations: ['Adults', 'Couples'],
    insurance: ['Regence', 'Aetna', 'Self-pay'],
    visits: ['In-person', 'Telehealth'],
    availability: 'Accepting new clients',
    years: 12,
    bio: 'Prototype provider focused on anxiety, grief, relationship stress, and adult life changes.',
    website: '',
    verifiedLabel: 'Demo profile',
    isDemo: true
  },
  {
    id: 'demo-foothills',
    name: 'Daniel Cho',
    credentials: 'LMFT',
    practice: 'Foothills Family Counseling',
    city: 'Eagle',
    gender: 'Male',
    specialties: ['Relationships', 'Life Transitions'],
    approaches: ['CBT', 'Person-centered'],
    services: ['Couples counseling', 'Family counseling'],
    populations: ['Adults', 'Couples', 'Families'],
    insurance: ['Blue Cross of Idaho', 'PacificSource', 'Self-pay'],
    visits: ['In-person'],
    availability: 'Waitlist',
    years: 16,
    bio: 'Prototype provider serving adults, couples, and families around relationship concerns and major life transitions.',
    website: '',
    verifiedLabel: 'Demo profile',
    isDemo: true
  },
  {
    id: 'demo-sagebrush',
    name: 'Elena Torres',
    credentials: 'LPC',
    practice: 'Sagebrush Counseling Collective',
    city: 'Nampa',
    gender: 'Female',
    specialties: ['Trauma', 'Anxiety', 'OCD'],
    approaches: ['EMDR', 'CBT'],
    services: ['Individual counseling'],
    populations: ['Adults', 'Teens'],
    insurance: ['PacificSource', 'Self-pay'],
    visits: ['In-person', 'Telehealth'],
    availability: 'Accepting new clients',
    years: 6,
    bio: 'Prototype provider working with trauma, anxiety, and OCD concerns in adults and teens.',
    website: '',
    verifiedLabel: 'Demo profile',
    isDemo: true
  },
  {
    id: 'demo-westbench',
    name: 'Avery Johnson',
    credentials: 'LCSW',
    practice: 'West Bench Counseling',
    city: 'Boise',
    gender: 'Nonbinary',
    specialties: ['Anxiety', 'Life Transitions', 'Grief'],
    approaches: ['ACT', 'DBT-informed'],
    services: ['Individual counseling'],
    populations: ['Adults', 'Teens'],
    insurance: ['Aetna', 'Regence', 'Self-pay'],
    visits: ['Telehealth'],
    availability: 'Accepting new clients',
    years: 9,
    bio: 'Prototype provider offering telehealth support for anxiety, grief, and life transitions.',
    website: '',
    verifiedLabel: 'Demo profile',
    isDemo: true
  },
  {
    id: 'demo-canyon-path',
    name: 'Rachel Nguyen',
    credentials: 'LCPC',
    practice: 'Canyon Path Therapy',
    city: 'Caldwell',
    gender: 'Female',
    specialties: ['Trauma', 'Grief'],
    approaches: ['EMDR', 'DBT-informed'],
    services: ['Individual counseling'],
    populations: ['Adults'],
    insurance: ['Blue Cross of Idaho', 'Self-pay'],
    visits: ['In-person', 'Telehealth'],
    availability: 'Waitlist',
    years: 11,
    bio: 'Prototype provider focused on adult trauma recovery, grief, and coping skills.',
    website: '',
    verifiedLabel: 'Demo profile',
    isDemo: true
  }
];


function normalizeVisitTypes(values = []) {
  const normalized = new Set();
  for (const value of values || []) {
    if (value === 'In-person & telehealth') {
      normalized.add('In-person');
      normalized.add('Telehealth');
    } else if (value) {
      normalized.add(value);
    }
  }
  return [...normalized];
}

function formatVerifiedDate(value) {
  if (!value) return 'Published profile';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Published profile';
  return `Verified ${date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`;
}

function mapDirectoryProfile(row) {
  return {
    id: String(row.id),
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
    verifiedLabel: formatVerifiedDate(row.last_verified_at),
    isDemo: false
  };
}

async function loadProviders() {
  els.count.textContent = 'Loading…';
  els.summary.textContent = '';
  els.results.innerHTML = '<div class="no-results"><h3>Loading provider profiles…</h3></div>';

  const note = document.querySelector('.preview-note');

  if (!supabase) {
    directoryMode = 'error';
    providers = [...demoProviders];
    if (note) note.textContent = 'Demo profiles are shown while the live provider directory is temporarily unavailable.';
    render();
    return;
  }

  const { data, error } = await supabase.rpc('list_directory_profiles', {
    page_size: 200,
    page_offset: 0
  });

  if (error) {
    console.error('Unable to load published provider profiles:', error);
    directoryMode = 'error';
    providers = [...demoProviders];
    if (note) note.textContent = 'Demo profiles are shown while the live provider directory is temporarily unavailable.';
    render();
    return;
  }

  const publishedProviders = (data || []).map(mapDirectoryProfile);
  providers = [...demoProviders, ...publishedProviders];
  directoryMode = 'live';
  if (note) {
    note.textContent = publishedProviders.length
      ? 'Published provider profiles appear alongside clearly labeled demo profiles during development.'
      : 'Demo profiles are shown while no provider profiles are published yet.';
  }
  render();
}

const state = {
  specialties: new Set(),
  origin: '', city: '', population: '', gender: '', visit: '', availability: '', insurance: '', approach: '', search: '', sort: 'az'
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

function lastName(name) {
  const parts = String(name).trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

function compareAlphabetical(a, b) {
  return lastName(a.provider.name).localeCompare(lastName(b.provider.name)) || a.provider.name.localeCompare(b.provider.name);
}

function milesBetweenCities(fromCity, toCity) {
  const a = cityCoordinates[fromCity];
  const b = cityCoordinates[toCity];
  if (!a || !b) return null;
  const rad = d => d * Math.PI / 180;
  const R = 3958.8;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const lat1 = rad(a[0]);
  const lat2 = rad(b[0]);
  const h = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const synonyms = {
  ptsd: 'Trauma', trauma: 'Trauma', traumatic: 'Trauma', emdr: 'EMDR',
  anxious: 'Anxiety', anxiety: 'Anxiety', panic: 'Anxiety',
  grief: 'Grief', grieving: 'Grief', loss: 'Grief',
  divorce: 'Life Transitions', transition: 'Life Transitions', transitions: 'Life Transitions',
  relationship: 'Relationships', relationships: 'Relationships', couples: 'Relationships',
  ocd: 'OCD'
};

const els = {
  results: document.getElementById('results'),
  count: document.getElementById('resultsCount'),
  summary: document.getElementById('matchSummary'),
  search: document.getElementById('searchText'),
  origin: document.getElementById('originFilter'),
  city: document.getElementById('cityFilter'),
  population: document.getElementById('populationFilter'),
  gender: document.getElementById('genderFilter'),
  visit: document.getElementById('visitFilter'),
  availability: document.getElementById('availabilityFilter'),
  insurance: document.getElementById('insuranceFilter'),
  approach: document.getElementById('approachFilter'),
  sort: document.getElementById('sortSelect'),
  profileDialog: document.getElementById('profileDialog'),
  profileDialogContent: document.getElementById('profileDialogContent'),
};

function initials(name) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('');
}

function normalizedSearchTerms(text) {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  const mapped = new Set();
  words.forEach(w => {
    if (synonyms[w]) mapped.add(synonyms[w]);
    else mapped.add(w);
  });
  return [...mapped];
}

function calculateMatch(provider) {
  let score = 0;
  let possible = 0;
  const matched = [];
  const unmatched = [];

  const searchTerms = normalizedSearchTerms(state.search);
  const desiredClinical = new Set([...state.specialties, ...searchTerms.filter(t => ['Trauma','Anxiety','Grief','Life Transitions','Relationships','OCD','EMDR'].includes(t))]);
  const rawTerms = searchTerms.filter(t => typeof t === 'string' && !['Trauma','Anxiety','Grief','Life Transitions','Relationships','OCD','EMDR'].includes(t));

  if (desiredClinical.size || rawTerms.length) {
    possible += 35;
    const providerText = `${provider.name} ${provider.practice} ${provider.city} ${provider.specialties.join(' ')} ${provider.approaches.join(' ')} ${provider.services.join(' ')} ${provider.populations.join(' ')} ${provider.insurance.join(' ')} ${provider.bio}`.toLowerCase();
    const clinicalHits = [...desiredClinical].filter(t => provider.specialties.includes(t) || provider.approaches.includes(t));
    const rawHits = rawTerms.filter(t => providerText.includes(t));
    const requestedCount = Math.max(1, desiredClinical.size + rawTerms.length);
    const fraction = Math.min(1, (clinicalHits.length + rawHits.length) / requestedCount);
    score += 35 * fraction;
    [...desiredClinical].forEach(t => (provider.specialties.includes(t) || provider.approaches.includes(t) ? matched : unmatched).push(t));
  }

  if (state.city) {
    possible += 20;
    if (provider.city === state.city) { score += 20; matched.push(state.city); }
    else unmatched.push(state.city);
  }
  if (state.insurance) {
    possible += 15;
    if (provider.insurance.includes(state.insurance)) { score += 15; matched.push(state.insurance); }
    else unmatched.push(state.insurance);
  }
  if (state.population) {
    possible += 10;
    if (provider.populations.includes(state.population)) { score += 10; matched.push(state.population); }
    else unmatched.push(state.population);
  }
  if (state.approach) {
    possible += 10;
    if (provider.approaches.includes(state.approach)) { score += 10; matched.push(state.approach); }
    else unmatched.push(state.approach);
  }

  const accessSelections = [state.visit, state.availability, state.gender].filter(Boolean);
  if (accessSelections.length) {
    possible += 10;
    let hits = 0;
    accessSelections.forEach(item => {
      const yes = provider.visits.includes(item) || provider.availability === item || provider.gender === item;
      if (yes) { hits++; matched.push(item); } else unmatched.push(item);
    });
    score += 10 * (hits / accessSelections.length);
  }

  const relevance = possible ? Math.round((score / possible) * 100) : 50;
  return { score, possible, relevance, matched: [...new Set(matched)], unmatched: [...new Set(unmatched)] };
}

function providerPassesHardFilters(provider) {
  // Gender is treated as a preference rather than a hard exclusion in scoring.
  if (state.city && provider.city !== state.city) return false;
  if (state.population && !provider.populations.includes(state.population)) return false;
  if (state.visit && !provider.visits.includes(state.visit)) return false;
  if (state.availability && provider.availability !== state.availability) return false;
  if (state.insurance && !provider.insurance.includes(state.insurance)) return false;
  if (state.approach && !provider.approaches.includes(state.approach)) return false;
  for (const specialty of state.specialties) if (!provider.specialties.includes(specialty)) return false;
  return true;
}

function matchLabel(relevance, hasFilters) {
  if (!hasFilters) return 'Profile available';
  if (relevance >= 90) return 'Very close match';
  if (relevance >= 70) return 'Strong match';
  if (relevance >= 50) return 'Possible match';
  return 'Partial match';
}

function render() {
  const hasFilters = Boolean(state.search || state.city || state.population || state.gender || state.visit || state.availability || state.insurance || state.approach || state.specialties.size);
  let rows = providers
    .filter(providerPassesHardFilters)
    .map(provider => ({ provider, match: calculateMatch(provider) }));

  if (state.search) {
    rows = rows.filter(({ provider, match }) => {
      const text = `${provider.name} ${provider.practice} ${provider.city} ${provider.specialties.join(' ')} ${provider.approaches.join(' ')} ${provider.services.join(' ')} ${provider.populations.join(' ')} ${provider.insurance.join(' ')} ${provider.bio}`.toLowerCase();
      const terms = normalizedSearchTerms(state.search);
      return match.matched.length > 0 || terms.some(term => text.includes(String(term).toLowerCase()));
    });
  }

  if (state.sort === 'az') rows.sort(compareAlphabetical);
  if (state.sort === 'distance') {
    if (state.origin) {
      rows.sort((a,b) => {
        const da = milesBetweenCities(state.origin, a.provider.city) ?? Number.POSITIVE_INFINITY;
        const db = milesBetweenCities(state.origin, b.provider.city) ?? Number.POSITIVE_INFINITY;
        return da - db || compareAlphabetical(a,b);
      });
    } else {
      rows.sort(compareAlphabetical);
    }
  }
  if (state.sort === 'relevance') rows.sort((a,b) => b.match.relevance - a.match.relevance || compareAlphabetical(a,b));
  if (state.sort === 'experience') rows.sort((a,b) => b.provider.years - a.provider.years || compareAlphabetical(a,b));
  if (state.sort === 'availability') rows.sort((a,b) => Number(b.provider.availability === 'Accepting new clients') - Number(a.provider.availability === 'Accepting new clients') || compareAlphabetical(a,b));

  els.count.textContent = `${rows.length} provider${rows.length === 1 ? '' : 's'}`;
  els.summary.textContent = hasFilters ? ' matching your selections' : ' in this guide';

  if (!rows.length) {
    if (directoryMode === 'error') {
      els.results.innerHTML = '<div class="no-results"><h3>The provider directory could not be loaded.</h3><p>Please refresh the page and try again.</p></div>';
    } else if (!providers.length) {
      els.results.innerHTML = '<div class="no-results"><h3>No provider profiles are published yet.</h3><p>Approved providers will appear here automatically.</p></div>';
    } else {
      els.results.innerHTML = '<div class="no-results"><h3>No provider profiles match every selected filter.</h3><p>Try removing one or two filters to broaden your search.</p></div>';
    }
    return;
  }

  els.results.innerHTML = rows.map(({provider, match}) => {
    const tags = hasFilters && match.matched.length
      ? match.matched.slice(0, 5).map(t => `<span class="match-tag matched">✓ ${escapeHtml(t)}</span>`).join('')
      : provider.specialties.slice(0, 3).map(t => `<span class="match-tag">${escapeHtml(t)}</span>`).join('');
    const distance = state.origin ? milesBetweenCities(state.origin, provider.city) : null;
    const distanceLine = distance !== null ? `<span class="distance-pill">≈ ${distance < 1 ? '&lt;1' : distance.toFixed(1)} mi from ${escapeHtml(state.origin)}</span>` : '';
    return `
      <article class="provider-card">
        <div class="provider-avatar">${initials(provider.name)}</div>
        <div>
          <h3>${escapeHtml(provider.name)}, ${escapeHtml(provider.credentials)}</h3>
          <div class="provider-meta">${escapeHtml(provider.practice)} · ${escapeHtml(provider.city)}${provider.years !== null ? ` · ${provider.years} year${provider.years === 1 ? '' : 's'} in practice` : ''}</div>
          <div class="match-tags">${distanceLine}${tags}</div>
        </div>
        <div class="provider-side">
          <div class="match-strength">${matchLabel(match.relevance, hasFilters)}</div>
          <button class="card-link" data-profile="${provider.id}">View profile</button>
          <div class="verified">${escapeHtml(provider.verifiedLabel)}</div>
        </div>
      </article>`;
  }).join('');

  document.querySelectorAll('[data-profile]').forEach(btn => btn.addEventListener('click', () => openProfile(btn.dataset.profile)));
}

function openProfile(id) {
  const p = providers.find(x => x.id === id);
  if (!p) return;
  els.profileDialogContent.innerHTML = `
    <div class="dialog-hero">
      <div class="provider-avatar">${initials(p.name)}</div>
      <div><div class="eyebrow">${p.isDemo ? 'Demo profile' : 'Published provider profile'}</div><h2>${escapeHtml(p.name)}${p.credentials ? `, ${escapeHtml(p.credentials)}` : ''}</h2><p>${escapeHtml(p.practice)} · ${escapeHtml(p.city)}</p></div>
    </div>
    <p>${escapeHtml(p.bio)}</p>
    <div class="profile-detail-grid">
      <div><span>Specialties</span><strong>${p.specialties.length ? p.specialties.map(escapeHtml).join(', ') : 'Not specified'}</strong></div>
      <div><span>Approaches</span><strong>${p.approaches.length ? p.approaches.map(escapeHtml).join(', ') : 'Not specified'}</strong></div>
      <div><span>Services</span><strong>${p.services.length ? p.services.map(escapeHtml).join(', ') : 'Not specified'}</strong></div>
      <div><span>Works with</span><strong>${p.populations.length ? p.populations.map(escapeHtml).join(', ') : 'Not specified'}</strong></div>
      <div><span>Visits</span><strong>${p.visits.length ? p.visits.map(escapeHtml).join(', ') : 'Not specified'}</strong></div>
      <div><span>Payment</span><strong>${p.insurance.length ? p.insurance.map(escapeHtml).join(', ') : 'Not specified'}</strong></div>
      <div><span>Availability</span><strong>${escapeHtml(p.availability)}</strong></div>
      <div><span>Provider gender</span><strong>${p.gender ? escapeHtml(p.gender) : 'Not specified'}</strong></div>
      ${p.licenseNumber ? `<div><span>State license</span><strong>${escapeHtml(p.licenseState || 'State license')} · ${escapeHtml(p.licenseNumber)}</strong></div>` : ''}
      <div><span>Verification</span><strong>${escapeHtml(p.verifiedLabel)}</strong></div>
    </div>
    ${p.website ? `<p><a class="button secondary" href="${escapeHtml(p.website)}" target="_blank" rel="noopener noreferrer">Visit provider website ↗</a></p>` : ''}`;
  els.profileDialog.showModal();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
}

function bindSelect(el, key) {
  el.addEventListener('change', () => { state[key] = el.value; render(); });
}
bindSelect(els.origin, 'origin'); bindSelect(els.city, 'city'); bindSelect(els.population, 'population'); bindSelect(els.gender, 'gender'); bindSelect(els.visit, 'visit'); bindSelect(els.availability, 'availability'); bindSelect(els.insurance, 'insurance'); bindSelect(els.approach, 'approach'); bindSelect(els.sort, 'sort');
els.search.addEventListener('input', () => { state.search = els.search.value.trim(); render(); });

document.querySelectorAll('.filter-chip').forEach(chip => chip.addEventListener('click', () => {
  const value = chip.dataset.value;
  if (state.specialties.has(value)) { state.specialties.delete(value); chip.classList.remove('active'); }
  else { state.specialties.add(value); chip.classList.add('active'); }
  render();
}));

document.getElementById('clearFilters').addEventListener('click', () => {
  state.specialties.clear();
  ['origin','city','population','gender','visit','availability','insurance','approach','search'].forEach(k => state[k] = '');
  state.sort = 'az';
  [els.origin, els.city, els.population, els.gender, els.visit, els.availability, els.insurance, els.approach, els.search].forEach(el => el.value = '');
  els.sort.value = 'az';
  document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
  render();
});

document.getElementById('closeDialog').addEventListener('click', () => els.profileDialog.close());
document.getElementById('providerInterestButton')?.addEventListener('click', () => document.getElementById('providerDialog')?.showModal());
document.getElementById('closeProviderDialog')?.addEventListener('click', () => document.getElementById('providerDialog')?.close());

document.getElementById('menuButton').addEventListener('click', () => {
  const nav = document.getElementById('primaryNav');
  const open = nav.classList.toggle('open');
  document.getElementById('menuButton').setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('#primaryNav a').forEach(a => a.addEventListener('click', () => document.getElementById('primaryNav').classList.remove('open')));

loadProviders();
