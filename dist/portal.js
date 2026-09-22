import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import QRCode from 'https://esm.sh/qrcode@1.5.4';

const cfg = window.TV_GUIDE_SUPABASE;
const supabase = createClient(cfg.url, cfg.publishableKey);
const buttons = [...document.querySelectorAll('.portal-nav button')];
const panels = [...document.querySelectorAll('.portal-panel')];
const title = document.getElementById('panelTitle');
const qs = new URLSearchParams(location.search);
let currentPlan = qs.get('plan') === 'advanced' ? 'advanced' : 'basic';
let session;
let profile = null;
let publicationStatus = 'draft';
let billingMode = 'one_time';
let billingSummary = null;

function titleCase(v) { return v.charAt(0).toUpperCase() + v.slice(1); }
function say(text, kind = '') {
  const node = document.getElementById('profileMessage');
  if (node) { node.textContent = text; node.dataset.kind = kind; }
}
function sayPanel(id, text, kind = '') {
  const node = document.getElementById(id);
  if (node) { node.textContent = text; node.dataset.kind = kind; }
}
function profileCompleteness(row) {
  if (!row) return 0;
  const checks = [
    row.first_name,
    row.last_name,
    row.credentials,
    row.primary_city,
    row.short_bio,
    row.practice_name,
    row.availability && row.availability !== 'Not specified',
    Array.isArray(row.specialties) && row.specialties.length,
    Array.isArray(row.insurance) && row.insurance.length,
    Array.isArray(row.approaches) && row.approaches.length,
    row.website_url,
    row.office_address
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
function formatOverviewDate(value) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not yet'
    : date.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
}
function renderOverview(row, publication = null) {
  const percent = profileCompleteness(row);
  const completeness = document.getElementById('profileCompleteness');
  const bar = document.getElementById('profileCompletenessBar');
  const note = document.getElementById('profileCompletenessNote');
  const verified = document.getElementById('lastVerifiedMetric');
  const verifiedNote = document.getElementById('lastVerifiedNote');
  const availability = document.getElementById('availabilitySummary');
  const insurance = document.getElementById('insuranceSummary');
  const specialties = document.getElementById('specialtiesSummary');
  const media = document.getElementById('mediaSummary');
  const preview = document.getElementById('previewBtn');

  if (completeness) completeness.textContent = `${percent}%`;
  if (bar) bar.style.width = `${percent}%`;
  if (note) {
    note.textContent = !row
      ? 'Start your profile to begin.'
      : percent === 100
        ? 'Your core profile information is complete.'
        : 'Add more profile details to strengthen your listing.';
  }

  if (verified) verified.textContent = formatOverviewDate(publication?.last_verified_at);
  if (verifiedNote) {
    verifiedNote.textContent = publication?.last_verified_at
      ? 'Most recent profile verification.'
      : 'Your listing has not been verified yet.';
  }

  if (availability) availability.textContent = row?.availability || 'Not set';
  if (insurance) {
    const count = Array.isArray(row?.insurance) ? row.insurance.length : 0;
    insurance.textContent = count ? `${count} selected` : 'None selected';
  }
  if (specialties) {
    const count = Array.isArray(row?.specialties) ? row.specialties.length : 0;
    specialties.textContent = count ? `${count} selected` : 'None selected';
  }
  if (media) media.textContent = row?.video_url ? 'Intro video added' : 'No video added';
  if (preview) preview.disabled = !row;
}
function enterNewProviderOnboarding() {
  applyPublicationStatus('draft');
  applyPlan(currentPlan);
  renderOverview(null, null);
  const preview = document.getElementById('previewBtn');
  if (preview) preview.disabled = true;
  showPanel('profile');
  title.textContent = 'Set up your profile';
  say('Start with your name, credentials, primary city, and short bio. You can save a draft as you go, then submit it for review when you are ready.');
}
function youtubeVideoId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(candidate);
    const host = url.hostname.replace(/^www\./i, '').replace(/^m\./i, '').toLowerCase();
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else if (/^\/(shorts|embed)\//.test(url.pathname)) id = url.pathname.split('/').filter(Boolean)[1] || '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  } catch {
    return '';
  }
}
function normalizeYouTubeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const id = youtubeVideoId(raw);
  return id ? `https://www.youtube.com/watch?v=${id}` : '';
}
function publicationLabel(status = 'draft') {
  return ({
    draft: 'Draft',
    submitted: 'Submitted for review',
    approved_pending_payment: 'Approved · payment required',
    published: 'Published',
    suspended: 'Suspended'
  })[status] || titleCase(status);
}
function applyPublicationStatus(status = 'draft') {
  const normalized = status || 'draft';
  publicationStatus = normalized;
  document.getElementById('publicationStatus').textContent = `● ${publicationLabel(normalized)}`;
  const submit = document.getElementById('submitProfile');
  if (!submit) return;
  if (normalized === 'published') {
    submit.disabled = true;
    submit.textContent = 'Already published';
    submit.title = 'Published providers can update their live profile with Save changes.';
  } else if (normalized === 'suspended') {
    submit.disabled = true;
    submit.textContent = 'Publication suspended';
    submit.title = 'Contact the directory administrator before republishing.';
  } else if (normalized === 'approved_pending_payment') {
    submit.disabled = true;
    submit.textContent = 'Approved · payment required';
    submit.title = 'Complete annual payment before publication.';
  } else if (normalized === 'submitted') {
    submit.disabled = true;
    submit.textContent = 'Submitted for review';
    submit.title = 'Your submission is awaiting administrator review.';
  } else {
    submit.disabled = false;
    submit.textContent = 'Submit for review';
    submit.title = '';
  }
}
function showPanel(name) {
  if (['analytics','media','qr'].includes(name) && currentPlan !== 'advanced') {
    showPanel('billing');
    return;
  }
  buttons.forEach(b => b.classList.toggle('active', b.dataset.panel === name));
  panels.forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  const btn = buttons.find(b => b.dataset.panel === name);
  title.textContent = btn ? btn.childNodes[0].textContent.trim() : titleCase(name);
  if (name === 'qr') renderQrCodes();
  if (name === 'analytics') loadAnalytics();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function setValues(values) {
  for (const [id, value] of Object.entries(values)) {
    const node = document.getElementById(id);
    if (node) node.value = value ?? '';
  }
}
function setChips(field, values = []) {
  document.querySelectorAll(`.profile-chips[data-field="${field}"] .filter-chip`).forEach(chip => {
    chip.classList.toggle('active', values.includes(chip.dataset.value));
  });
}
function setCustomTags(id, values = []) {
  const node = document.getElementById(id);
  if (!node) return;
  node.innerHTML = '';
  values.filter(Boolean).forEach(value => {
    const tag = document.createElement('span');
    tag.className = 'custom-tag';
    tag.dataset.value = value;
    tag.textContent = value;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${value}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => tag.remove());
    tag.append(remove);
    node.append(tag);
  });
}
function getCustomTags(id) {
  return [...document.querySelectorAll(`#${id} .custom-tag`)].map(tag => tag.dataset.value);
}
function addCustomTag(inputId, listId) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (!input || !list) {
    console.error('Custom field target missing', { inputId, listId });
    return;
  }
  const value = input.value.trim();
  if (!value) {
    input.focus();
    return;
  }
  const existing = getCustomTags(listId);
  if (!existing.some(item => item.toLowerCase() === value.toLowerCase())) {
    setCustomTags(listId, [...existing, value]);
  }
  input.value = '';
  input.focus();
}
async function geocodeAddress(value) {
  const address = String(value || '').trim();
  if (!address) return null;
  const response = await fetch('/api/geocode', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ address })
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || 'Address lookup failed');
  if (!result?.found) return null;
  const lat = Number(result.lat);
  const lng = Number(result.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
function normalizeWebsiteUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return `https://${trimmed.replace(/^https?:\/\//i, '')}`;
}
function getChips(field) {
  return [...document.querySelectorAll(`.profile-chips[data-field="${field}"] .filter-chip.active`)].map(chip => chip.dataset.value);
}
function populateProfile(row) {
  profile = row;
  setValues({
    firstName: row?.first_name,
    lastName: row?.last_name,
    credentials: row?.credentials,
    practiceName: row?.practice_name,
    primaryCity: row?.primary_city,
    yearsInPractice: row?.years_in_practice,
    shortBio: row?.short_bio,
    websiteUrl: row?.website_url,
    availability: row?.availability || 'Not specified',
    visitType: (row?.visit_types || [])[0] || 'In-person & telehealth',
    providerGender: row?.provider_gender || '',
    licenseState: row?.license_state || '',
    licenseNumber: row?.license_number || '',
    videoUrl: row?.video_url || '',
    clientPortalUrl: row?.client_portal_url || '',
    requestedPlan: row?.requested_plan || currentPlan,
    officeAddress: row?.office_address || ''
  });
  const showWebsiteQr = document.getElementById('showWebsiteQr');
  const showPortalQr = document.getElementById('showPortalQr');
  if (showWebsiteQr) showWebsiteQr.checked = Boolean(row?.show_website_qr);
  if (showPortalQr) showPortalQr.checked = Boolean(row?.show_portal_qr);
  setChips('specialties', row?.specialties || []);
  setChips('approaches', row?.approaches || []);
  setChips('populations', row?.populations || []);
  setChips('insurance', row?.insurance || []);
  const builtInSpecialties = [...document.querySelectorAll('.profile-chips[data-field="specialties"] .filter-chip')].map(chip => chip.dataset.value);
  const builtInApproaches = [...document.querySelectorAll('.profile-chips[data-field="approaches"] .filter-chip')].map(chip => chip.dataset.value);
  const builtInPopulations = [...document.querySelectorAll('.profile-chips[data-field="populations"] .filter-chip')].map(chip => chip.dataset.value);
  const builtInInsurance = [...document.querySelectorAll('.profile-chips[data-field="insurance"] .filter-chip')].map(chip => chip.dataset.value);
  setCustomTags('customSpecialties', (row?.specialties || []).filter(value => !builtInSpecialties.includes(value)));
  setCustomTags('customApproaches', (row?.approaches || []).filter(value => !builtInApproaches.includes(value)));
  setCustomTags('customPopulations', (row?.populations || []).filter(value => !builtInPopulations.includes(value)));
  setCustomTags('customInsurance', (row?.insurance || []).filter(value => !builtInInsurance.includes(value)));
  setCustomTags('customServices', row?.services || []);
  const first = row?.first_name || '';
  const last = row?.last_name || '';
  const name = `${first} ${last}`.trim() || session.user.email;
  document.getElementById('accountName').textContent = name;
  document.getElementById('accountPractice').textContent = row?.practice_name || 'Complete your profile';
  const providerInitials = `${first[0] || ''}${last[0] || ''}`.toUpperCase() || 'TV';
  document.getElementById('accountAvatar').textContent = providerInitials;
  const mediaAvatar = document.getElementById('mediaAvatar');
  if (mediaAvatar) mediaAvatar.textContent = providerInitials;
}
function formPayload() {
  return {
    first_name: document.getElementById('firstName').value.trim(),
    last_name: document.getElementById('lastName').value.trim(),
    credentials: document.getElementById('credentials').value.trim(),
    practice_name: document.getElementById('practiceName').value.trim(),
    primary_city: document.getElementById('primaryCity').value,
    years_in_practice: document.getElementById('yearsInPractice').value ? Number(document.getElementById('yearsInPractice').value) : null,
    short_bio: document.getElementById('shortBio').value.trim(),
    website_url: normalizeWebsiteUrl(document.getElementById('websiteUrl').value),
    office_address: document.getElementById('officeAddress')?.value.trim() || '',
    availability: document.getElementById('availability').value,
    visit_types: [document.getElementById('visitType').value],
    provider_gender: document.getElementById('providerGender').value,
    license_state: document.getElementById('licenseState').value.trim(),
    license_number: document.getElementById('licenseNumber').value.trim(),
    video_url: normalizeYouTubeUrl(document.getElementById('videoUrl')?.value || ''),
    client_portal_url: normalizeWebsiteUrl(document.getElementById('clientPortalUrl')?.value || ''),
    requested_plan: currentPlan,
    show_website_qr: Boolean(document.getElementById('showWebsiteQr')?.checked),
    show_portal_qr: Boolean(document.getElementById('showPortalQr')?.checked),
    populations: [...getChips('populations'), ...getCustomTags('customPopulations')],
    insurance: [...getChips('insurance'), ...getCustomTags('customInsurance')],
    specialties: [...getChips('specialties'), ...getCustomTags('customSpecialties')],
    approaches: [...getChips('approaches'), ...getCustomTags('customApproaches')],
    services: getCustomTags('customServices')
  };
}
async function saveProfile() {
  say('Saving your profile…');
  const videoInput = document.getElementById('videoUrl')?.value.trim() || '';
  if (videoInput && !youtubeVideoId(videoInput)) {
    say('Enter a valid YouTube video URL or leave the video field blank.', 'error');
    sayPanel('mediaMessage', 'Enter a valid YouTube video URL.', 'error');
    return false;
  }
  const payload = formPayload();
  let geocodeWarning = '';
  if (payload.office_address) {
    if (payload.office_address !== (profile?.office_address || '') || !profile?.office_latitude || !profile?.office_longitude) {
      try {
        const geo = await geocodeAddress(payload.office_address);
        if (geo) {
          payload.office_latitude = geo.lat;
          payload.office_longitude = geo.lng;
        } else {
          payload.office_latitude = null;
          payload.office_longitude = null;
          geocodeWarning = ' Office address saved, but distance-search coordinates could not be determined yet.';
        }
      } catch (error) {
        console.error(error);
        payload.office_latitude = null;
        payload.office_longitude = null;
        geocodeWarning = ' Office address saved, but distance-search coordinates could not be updated right now.';
      }
    } else {
      payload.office_latitude = profile.office_latitude;
      payload.office_longitude = profile.office_longitude;
    }
  } else {
    payload.office_latitude = null;
    payload.office_longitude = null;
  }
  const result = profile?.id
    ? await supabase.from('provider_profiles').update(payload).eq('id', profile.id).select().single()
    : await supabase.from('provider_profiles').insert(payload).select().single();
  if (result.error) { say(result.error.message, 'error'); return false; }
  populateProfile(result.data);
  const publication = profile?.id
    ? await supabase.from('provider_publication').select('status, plan, last_verified_at').eq('provider_id', profile.id).maybeSingle()
    : null;
  const status = publication?.data?.status || 'draft';
  applyPublicationStatus(status);
  renderOverview(result.data, publication?.data || null);
  const preview = document.getElementById('previewBtn');
  if (preview) preview.disabled = false;
  const savedMessage = status === 'published'
    ? 'Changes saved and updated on your live profile.'
    : 'Draft saved.';
  say(savedMessage + geocodeWarning, 'success');
  return true;
}
async function loadProfile() {
  const { data, error } = await supabase.from('provider_profiles').select('*').maybeSingle();
  if (error) { say(error.message, 'error'); return; }
  populateProfile(data);

  if (!data) {
    enterNewProviderOnboarding();
    await loadBilling();
    return;
  }

  let publicationData = null;
  const publication = await supabase
    .from('provider_publication')
    .select('status, plan, last_verified_at')
    .eq('provider_id', data.id)
    .maybeSingle();

  if (publication.data) {
    publicationData = publication.data;
    const status = publication.data.status || 'draft';
    currentPlan = ['draft','submitted'].includes(status)
      ? (data.requested_plan || publication.data.plan || currentPlan)
      : (publication.data.plan || currentPlan);
    applyPublicationStatus(status);
  } else {
    applyPublicationStatus('draft');
  }

  applyPlan(currentPlan);
  renderOverview(data, publicationData);
  const preview = document.getElementById('previewBtn');
  if (preview) preview.disabled = false;
  await loadBilling();
}
async function saveAdvanced(panelMessageId, successText) {
  if (currentPlan !== 'advanced') {
    sayPanel(panelMessageId, 'This feature is available with the Advanced plan.', 'error');
    return false;
  }
  sayPanel(panelMessageId, 'Saving…');
  const ok = await saveProfile();
  if (ok) sayPanel(panelMessageId, successText, 'success');
  return ok;
}
function assignQrDestination(kind) {
  const input = document.getElementById('qrDestinationInput');
  const raw = input?.value || '';
  const normalized = normalizeWebsiteUrl(raw);
  if (!normalized) {
    sayPanel('qrMessage', 'Enter a URL first, then choose where to use it.', 'error');
    input?.focus();
    return;
  }
  if (kind === 'portal') {
    const portalInput = document.getElementById('clientPortalUrl');
    if (portalInput) portalInput.value = normalized;
    renderQr('portal');
    sayPanel('qrMessage', 'Client / scheduling portal QR updated. Save QR settings to keep it.', 'success');
  } else {
    const websiteInput = document.getElementById('websiteUrl');
    if (websiteInput) websiteInput.value = normalized;
    renderQr('website');
    sayPanel('qrMessage', 'Practice website QR updated. Save QR settings to keep it.', 'success');
  }
}

function qrUrl(kind) {
  const raw = kind === 'portal'
    ? (document.getElementById('clientPortalUrl')?.value || '')
    : (document.getElementById('websiteUrl')?.value || '');
  return normalizeWebsiteUrl(raw);
}
async function renderQr(kind) {
  const isPortal = kind === 'portal';
  const canvas = document.getElementById(isPortal ? 'portalQrCanvas' : 'websiteQrCanvas');
  const urlNode = document.getElementById(isPortal ? 'portalQrUrl' : 'websiteQrUrl');
  if (!canvas || !urlNode) return;
  const url = qrUrl(kind);
  if (!url) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    urlNode.textContent = isPortal ? 'Add a client or scheduling portal URL.' : 'Add your practice website in My Profile.';
    return;
  }
  urlNode.textContent = url;
  await QRCode.toCanvas(canvas, url, { width: 240, margin: 2, errorCorrectionLevel: 'M' });
}
async function renderQrCodes() {
  try {
    await Promise.all([renderQr('website'), renderQr('portal')]);
  } catch (error) {
    console.error(error);
    sayPanel('qrMessage', 'Unable to generate one or more QR codes.', 'error');
  }
}
async function copyQr(kind) {
  const url = qrUrl(kind);
  if (!url) { sayPanel('qrMessage', 'Add the destination URL first.', 'error'); return; }
  try {
    await navigator.clipboard.writeText(url);
    sayPanel('qrMessage', kind === 'portal' ? 'Portal link copied.' : 'Website link copied.', 'success');
  } catch {
    sayPanel('qrMessage', 'Could not copy the destination automatically.', 'error');
  }
}
async function downloadQr(kind) {
  const isPortal = kind === 'portal';
  const canvas = document.getElementById(isPortal ? 'portalQrCanvas' : 'websiteQrCanvas');
  const url = qrUrl(kind);
  if (!canvas || !url) { sayPanel('qrMessage', 'Add the destination URL first.', 'error'); return; }
  await renderQr(kind);
  const link = document.createElement('a');
  link.download = isPortal ? 'treasure-valley-client-portal-qr.png' : 'treasure-valley-website-qr.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
async function submitProfile() {
  if (!await saveProfile()) return;
  say('Submitting your profile for review…');
  const { error } = await supabase.rpc('submit_provider_profile');
  if (error) { say(error.message, 'error'); return; }
  applyPublicationStatus('submitted');
  say('Profile submitted for review.', 'success');
}
buttons.forEach(b => b.addEventListener('click', () => showPanel(b.dataset.panel)));
document.querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.jump)));
document.querySelectorAll('.profile-chips .filter-chip').forEach(b => b.addEventListener('click', () => b.classList.toggle('active')));
document.addEventListener('click', event => {
  const button = event.target.closest('[data-custom-input][data-custom-list]');
  if (!button) return;
  event.preventDefault();
  addCustomTag(button.dataset.customInput, button.dataset.customList);
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  const input = event.target.closest('#customSpecialtyInput, #customPopulationInput, #customInsuranceInput, #customServiceInput, #customApproachInput');
  if (!input) return;
  event.preventDefault();
  const button = document.querySelector(`[data-custom-input="${input.id}"]`);
  if (button) addCustomTag(button.dataset.customInput, button.dataset.customList);
});
document.getElementById('saveProfile')?.addEventListener('click', saveProfile);
document.getElementById('saveMedia')?.addEventListener('click', () => saveAdvanced('mediaMessage', 'Video saved.'));
document.getElementById('saveQrSettings')?.addEventListener('click', async () => {
  if (await saveAdvanced('qrMessage', 'QR settings saved.')) renderQrCodes();
});
document.getElementById('assignWebsiteQr')?.addEventListener('click', () => assignQrDestination('website'));
document.getElementById('assignPortalQr')?.addEventListener('click', () => assignQrDestination('portal'));
document.getElementById('qrDestinationInput')?.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    sayPanel('qrMessage', 'Choose Practice Website or Client / Scheduling Portal.', '');
  }
});
document.getElementById('copyWebsiteQr')?.addEventListener('click', () => copyQr('website'));
document.getElementById('copyPortalQr')?.addEventListener('click', () => copyQr('portal'));
document.getElementById('downloadWebsiteQr')?.addEventListener('click', () => downloadQr('website'));
document.getElementById('downloadPortalQr')?.addEventListener('click', () => downloadQr('portal'));
document.getElementById('submitProfile')?.addEventListener('click', submitProfile);
document.getElementById('signOut')?.addEventListener('click', async () => { const { error } = await supabase.auth.signOut(); if (error) { say(error.message, 'error'); return; } location.replace('provider-login.html?signed_out=1'); });
document.getElementById('previewBtn')?.addEventListener('click', () => {
  if (profile?.public_slug) location.href = `/providers/${encodeURIComponent(profile.public_slug)}`;
  else location.href = '/find-counselor';
});

function isoDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function setDefaultAnalyticsRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  const startEl = document.getElementById('analyticsStart');
  const endEl = document.getElementById('analyticsEnd');
  if (startEl && !startEl.value) startEl.value = isoDateLocal(start);
  if (endEl && !endEl.value) endEl.value = isoDateLocal(end);
}
function renderBars(id, rows = []) {
  const node = document.getElementById(id);
  if (!node) return;
  if (!rows.length) { node.innerHTML = '<div class="analytics-empty">No data in this range yet.</div>'; return; }
  const max = Math.max(...rows.map(r => Number(r.count) || 0),1);
  node.innerHTML = rows.map(r => `<div><span>${String(r.label || '')}</span><i style="--w:${Math.round((Number(r.count)||0)/max*100)}%"></i><b>${Number(r.count)||0}</b></div>`).join('');
}
function renderSources(id, rows = []) {
  const node = document.getElementById(id);
  if (!node) return;
  if (!rows.length) { node.innerHTML = '<div class="analytics-empty">No data in this range yet.</div>'; return; }
  node.innerHTML = rows.map(r => `<div><span>${String(r.label || '')}</span><b>${Number(r.count)||0}</b></div>`).join('');
}
async function loadAnalytics() {
  if (currentPlan !== 'advanced') return;
  setDefaultAnalyticsRange();
  const start = document.getElementById('analyticsStart')?.value;
  const end = document.getElementById('analyticsEnd')?.value;
  if (!start || !end || end < start) {
    sayPanel('analyticsMessage','Choose a valid start and end date.','error');
    return;
  }
  sayPanel('analyticsMessage','Loading analytics…');
  const { data, error } = await supabase.rpc('provider_analytics_summary', { start_date:start, end_date:end });
  if (error) {
    console.error(error);
    sayPanel('analyticsMessage', error.message || 'Unable to load analytics.', 'error');
    return;
  }
  const views = Number(data?.profile_views || 0);
  const unique = Number(data?.unique_visitors || 0);
  const website = Number(data?.website_clicks || 0);
  const portalClicks = Number(data?.portal_clicks || 0);
  document.getElementById('metricProfileViews').textContent = views;
  document.getElementById('metricUniqueVisitors').textContent = unique;
  document.getElementById('metricWebsiteClicks').textContent = website;
  document.getElementById('metricPortalClicks').textContent = portalClicks;
  document.getElementById('metricWebsiteRate').textContent = views ? `${(website/views*100).toFixed(1)}% of profile views` : '0% of profile views';
  document.getElementById('metricPortalRate').textContent = views ? `${(portalClicks/views*100).toFixed(1)}% of profile views` : '0% of profile views';
  document.getElementById('metricProfileViewsNote').textContent = `${start} through ${end}`;
  const overviewViews = document.getElementById('overviewViews');
  const overviewVisitors = document.getElementById('overviewVisitors');
  const overviewClicks = document.getElementById('overviewClicks');
  if (overviewViews) overviewViews.textContent = views;
  if (overviewVisitors) overviewVisitors.textContent = unique;
  if (overviewClicks) overviewClicks.textContent = website + portalClicks;
  const specialtyTop = data?.top_specialties?.[0]?.label || '';
  const approachTop = data?.top_approaches?.[0]?.label || '';
  const insightHeadline = document.getElementById('advancedInsightHeadline');
  if (insightHeadline) {
    insightHeadline.textContent = specialtyTop && approachTop
      ? `People are finding this profile for ${specialtyTop} and ${approachTop}.`
      : specialtyTop
        ? `People are finding this profile for ${specialtyTop}.`
        : views
          ? 'Your Advanced profile is receiving visitor activity.'
          : 'No profile activity has been recorded in this date range yet.';
  }
  renderBars('analyticsSpecialties', data?.top_specialties || []);
  renderBars('analyticsApproaches', data?.top_approaches || []);
  renderSources('analyticsSources', data?.sources || []);
  renderSources('analyticsAccess', data?.access_preferences || []);
  sayPanel('analyticsMessage', views ? 'Analytics updated for the selected range.' : 'No tracked activity in this date range yet.', views ? 'success' : '');
}

function formatBillingDate(value) {
  if (!value) return 'Not active';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not active' : date.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
}
function renderBilling(summary) {
  billingSummary = summary || null;
  const status = summary?.publication_status || publicationStatus || 'draft';
  const billingStatus = summary?.billing_status || '';
  const actualPlan = summary?.billing_plan || summary?.publication_plan || currentPlan;
  const requiresPayment = Boolean(summary?.requires_payment);
  billingMode = summary?.billing_mode || billingMode || 'one_time';

  const badge = document.getElementById('billingStatusBadge');
  const intro = document.getElementById('billingIntro');
  const paidThrough = document.getElementById('billingPaidThrough');
  const renewal = document.getElementById('billingRenewalSetting');
  const pubStatus = document.getElementById('billingPublicationStatus');
  const metricNote = document.getElementById('planMetricNote');

  if (pubStatus) pubStatus.textContent = publicationLabel(status);
  if (paidThrough) paidThrough.textContent = formatBillingDate(summary?.current_period_end);
  if (renewal) {
    renewal.textContent = summary?.cancel_at_period_end
      ? 'Auto-renewal ends after current period'
      : billingMode === 'auto_renew' ? 'Automatic annual renewal' : 'One year only';
  }

  let badgeText = 'Not active';
  if (requiresPayment) badgeText = 'Payment required';
  else if (billingStatus === 'active') badgeText = 'Active';
  else if (billingStatus === 'grace_period') badgeText = 'Grace period';
  else if (billingStatus === 'past_due') badgeText = 'Payment issue';
  else if (billingStatus === 'expired') badgeText = 'Expired';
  else if (billingStatus === 'canceled') badgeText = 'Canceled';
  else if (status === 'published' && !billingStatus) badgeText = 'Beta / manual access';
  if (badge) badge.textContent = badgeText;

  const checkoutButton = document.getElementById('checkoutDemo');
  if (checkoutButton) {
    checkoutButton.disabled = !requiresPayment;
    checkoutButton.textContent = requiresPayment
      ? 'Complete annual payment'
      : status === 'submitted'
        ? 'Payment available after approval'
        : status === 'published'
          ? 'Listing active'
          : 'Payment available after approval';
  }

  if (intro) {
    intro.textContent = requiresPayment
      ? 'Your profile is approved. Complete annual payment to publish it in the directory.'
      : status === 'submitted'
        ? 'Your profile is awaiting administrator review. Payment is requested only after approval.'
        : status === 'published'
          ? 'Your listing is active. Turning off future renewal will not shorten the period you already paid for.'
          : 'Choose a plan now. After administrator approval, payment activates the listing for one year.';
  }
  if (metricNote) metricNote.textContent = requiresPayment ? 'Approved · payment required' : badgeText;

  if (actualPlan && ['basic','advanced'].includes(actualPlan) && !['draft','submitted'].includes(status)) {
    applyPlan(actualPlan);
  }

  document.querySelectorAll('[data-billing-mode]').forEach(button => {
    button.classList.toggle('selected', button.dataset.billingMode === billingMode);
  });
  const modeNode = document.getElementById('checkoutBillingMode');
  if (modeNode) modeNode.textContent = billingMode === 'auto_renew' ? 'Automatic annual renewal' : 'One year only';
}
async function loadBilling() {
  if (!profile?.id) {
    renderBilling(null);
    return;
  }
  const { data, error } = await supabase.rpc('provider_billing_summary');
  if (error) {
    sayPanel('billingMessage', error.message, 'error');
    return;
  }
  const summary = Array.isArray(data) ? (data[0] || null) : data;
  renderBilling(summary);
}

function applyPlan(plan) {
  currentPlan = plan;
  const advanced = plan === 'advanced';
  document.getElementById('planMetric').textContent = advanced ? 'Advanced' : 'Basic';
  document.getElementById('billingPlanName').textContent = advanced ? 'Advanced · $49/year' : 'Basic · $12/year';
  document.getElementById('checkoutItem').textContent = advanced ? 'Advanced Provider Listing — $49/year' : 'Basic Provider Listing — $12/year';
  document.querySelectorAll('.plan-switch').forEach(b => b.classList.toggle('selected', b.dataset.plan === plan));
  const insight = document.getElementById('advancedInsight');
  if (insight) insight.hidden = !advanced;
  document.querySelectorAll('.portal-nav button').forEach(b => {
    if (['analytics', 'media', 'qr'].includes(b.dataset.panel)) {
      b.classList.toggle('locked', !advanced);
      b.setAttribute('aria-disabled', String(!advanced));
    }
  });
  if (advanced) {
    setDefaultAnalyticsRange();
    loadAnalytics();
  }
}
document.getElementById('applyAnalyticsRange')?.addEventListener('click', loadAnalytics);
document.querySelectorAll('.plan-switch').forEach(b => b.addEventListener('click', async () => {
  const plan = b.dataset.plan === 'advanced' ? 'advanced' : 'basic';
  if (!['draft','submitted'].includes(publicationStatus)) {
    sayPanel('billingMessage', 'Plan changes after approval will be handled through billing so paid access and entitlements stay in sync.', 'error');
    applyPlan(billingSummary?.publication_plan || billingSummary?.billing_plan || currentPlan);
    return;
  }
  applyPlan(plan);
  if (profile?.id) {
    const { error } = await supabase.from('provider_profiles').update({ requested_plan: plan }).eq('id', profile.id);
    if (error) sayPanel('billingMessage', error.message, 'error');
    else sayPanel('billingMessage', `${plan === 'advanced' ? 'Advanced' : 'Basic'} plan requested.`, 'success');
  }
}));
document.querySelectorAll('[data-billing-mode]').forEach(button => button.addEventListener('click', () => {
  billingMode = button.dataset.billingMode === 'auto_renew' ? 'auto_renew' : 'one_time';
  document.querySelectorAll('[data-billing-mode]').forEach(item => item.classList.toggle('selected', item === button));
  document.getElementById('billingRenewalSetting').textContent = billingMode === 'auto_renew'
    ? 'Automatic annual renewal'
    : 'One year only';
  document.getElementById('checkoutBillingMode').textContent = billingMode === 'auto_renew'
    ? 'Automatic annual renewal'
    : 'One year only';
}));
async function startSquareCheckout() {
  if (!billingSummary?.requires_payment) {
    sayPanel('billingMessage', 'Payment becomes available after administrator approval.', 'error');
    return;
  }
  if (!session?.access_token) {
    location.href = 'provider-login.html';
    return;
  }

  const button = document.getElementById('startSquareCheckout');
  const originalText = button?.textContent || 'Continue to Square';
  if (button) {
    button.disabled = true;
    button.textContent = 'Opening secure checkout…';
  }
  sayPanel('billingMessage', 'Creating your secure Square checkout…');
  const dialogMessage = document.getElementById('checkoutDialogMessage');
  if (dialogMessage) {
    dialogMessage.textContent = 'Creating your secure Square checkout…';
    dialogMessage.dataset.kind = '';
  }

  try {
    const response = await fetch('/api/payments/checkout', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ billingMode })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.checkoutUrl) {
      throw new Error(result?.error || 'Unable to start secure checkout.');
    }
    if (dialogMessage) {
      dialogMessage.textContent = 'Opening Square…';
      dialogMessage.dataset.kind = 'success';
    }
    location.assign(result.checkoutUrl);
  } catch (error) {
    console.error(error);
    const message = error?.message || 'Unable to start secure checkout.';
    sayPanel('billingMessage', message, 'error');
    if (dialogMessage) {
      dialogMessage.textContent = message;
      dialogMessage.dataset.kind = 'error';
    }
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

document.getElementById('checkoutDemo')?.addEventListener('click', () => {
  if (!billingSummary?.requires_payment) {
    sayPanel('billingMessage', 'Payment becomes available after administrator approval.', 'error');
    return;
  }
  const dialogMessage = document.getElementById('checkoutDialogMessage');
  if (dialogMessage) {
    dialogMessage.textContent = '';
    dialogMessage.dataset.kind = '';
  }
  document.getElementById('checkoutDialog').showModal();
});
document.getElementById('startSquareCheckout')?.addEventListener('click', startSquareCheckout);
document.getElementById('closeCheckout')?.addEventListener('click', () => document.getElementById('checkoutDialog').close());

const { data: auth } = await supabase.auth.getSession();
session = auth.session;
if (!session) location.href = 'provider-login.html';
else {
  await loadProfile();
  const requestedPanel = qs.get('panel');
  if (requestedPanel && buttons.some(button => button.dataset.panel === requestedPanel)) {
    showPanel(requestedPanel);
  }
  if (qs.get('checkout') === 'success') {
    sayPanel(
      'billingMessage',
      billingSummary?.requires_payment
        ? 'Square returned you to the portal. Payment confirmation is still being verified.'
        : 'Payment confirmed. Your annual listing is active.',
      billingSummary?.requires_payment ? '' : 'success'
    );
  }
}
