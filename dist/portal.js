import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cfg = window.TV_GUIDE_SUPABASE;
const supabase = createClient(cfg.url, cfg.publishableKey);
const buttons = [...document.querySelectorAll('.portal-nav button')];
const panels = [...document.querySelectorAll('.portal-panel')];
const title = document.getElementById('panelTitle');
const qs = new URLSearchParams(location.search);
let currentPlan = qs.get('plan') === 'basic' ? 'basic' : 'advanced';
let session;
let profile = null;

function titleCase(v) { return v.charAt(0).toUpperCase() + v.slice(1); }
function say(text, kind = '') {
  const node = document.getElementById('profileMessage');
  if (node) { node.textContent = text; node.dataset.kind = kind; }
}
function applyPublicationStatus(status = 'draft') {
  const normalized = status || 'draft';
  document.getElementById('publicationStatus').textContent = `● ${titleCase(normalized)}`;
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
  } else {
    submit.disabled = false;
    submit.textContent = normalized === 'submitted' ? 'Submitted for review' : 'Submit for review';
    submit.title = '';
  }
}
function showPanel(name) {
  buttons.forEach(b => b.classList.toggle('active', b.dataset.panel === name));
  panels.forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  const btn = buttons.find(b => b.dataset.panel === name);
  title.textContent = btn ? btn.childNodes[0].textContent.trim() : titleCase(name);
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
  const value = input.value.trim();
  if (!value) return;
  const existing = getCustomTags(listId);
  if (!existing.some(item => item.toLowerCase() === value.toLowerCase())) {
    setCustomTags(listId, [...existing, value]);
  }
  input.value = '';
  input.focus();
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
    licenseNumber: row?.license_number || ''
  });
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
  document.getElementById('accountAvatar').textContent = `${first[0] || ''}${last[0] || ''}`.toUpperCase() || 'TV';
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
    availability: document.getElementById('availability').value,
    visit_types: [document.getElementById('visitType').value],
    provider_gender: document.getElementById('providerGender').value,
    license_state: document.getElementById('licenseState').value.trim(),
    license_number: document.getElementById('licenseNumber').value.trim(),
    populations: [...getChips('populations'), ...getCustomTags('customPopulations')],
    insurance: [...getChips('insurance'), ...getCustomTags('customInsurance')],
    specialties: [...getChips('specialties'), ...getCustomTags('customSpecialties')],
    approaches: [...getChips('approaches'), ...getCustomTags('customApproaches')],
    services: getCustomTags('customServices')
  };
}
async function saveProfile() {
  say('Saving your profile…');
  const payload = formPayload();
  if (!payload.first_name || !payload.last_name || !payload.credentials || !payload.primary_city || !payload.short_bio) {
    say('Add your name, credentials, city, and bio before saving.', 'error');
    return false;
  }
  const result = profile?.id
    ? await supabase.from('provider_profiles').update(payload).eq('id', profile.id).select().single()
    : await supabase.from('provider_profiles').insert(payload).select().single();
  if (result.error) { say(result.error.message, 'error'); return false; }
  populateProfile(result.data);
  const publication = profile?.id
    ? await supabase.from('provider_publication').select('status').eq('provider_id', profile.id).maybeSingle()
    : null;
  const status = publication?.data?.status || 'draft';
  applyPublicationStatus(status);
  say(status === 'published' ? 'Changes saved and updated on your live profile.' : 'Profile saved.', 'success');
  return true;
}
async function loadProfile() {
  const { data, error } = await supabase.from('provider_profiles').select('*').maybeSingle();
  if (error) { say(error.message, 'error'); return; }
  populateProfile(data);
  if (data) {
    const publication = await supabase.from('provider_publication').select('status, plan').eq('provider_id', data.id).maybeSingle();
    if (publication.data) {
      currentPlan = publication.data.plan || currentPlan;
      applyPublicationStatus(publication.data.status || 'draft');
    }
  }
  applyPlan(currentPlan);
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
document.getElementById('addSpecialty')?.addEventListener('click', () => addCustomTag('customSpecialtyInput', 'customSpecialties'));
document.getElementById('customSpecialtyInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addCustomTag('customSpecialtyInput', 'customSpecialties'); } });
document.getElementById('addPopulation')?.addEventListener('click', () => addCustomTag('customPopulationInput', 'customPopulations'));
document.getElementById('customPopulationInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addCustomTag('customPopulationInput', 'customPopulations'); } });
document.getElementById('addInsurance')?.addEventListener('click', () => addCustomTag('customInsuranceInput', 'customInsurance'));
document.getElementById('customInsuranceInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addCustomTag('customInsuranceInput', 'customInsurance'); } });
document.getElementById('addService')?.addEventListener('click', () => addCustomTag('customServiceInput', 'customServices'));
document.getElementById('customServiceInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addCustomTag('customServiceInput', 'customServices'); } });
document.getElementById('addApproach')?.addEventListener('click', () => addCustomTag('customApproachInput', 'customApproaches'));
document.getElementById('customApproachInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addCustomTag('customApproachInput', 'customApproaches'); } });
document.getElementById('saveProfile')?.addEventListener('click', saveProfile);
document.getElementById('submitProfile')?.addEventListener('click', submitProfile);
document.getElementById('signOut')?.addEventListener('click', async () => { const { error } = await supabase.auth.signOut(); if (error) { say(error.message, 'error'); return; } location.replace('provider-login.html?signed_out=1'); });
document.getElementById('previewBtn')?.addEventListener('click', () => location.href = 'index.html#find');

function applyPlan(plan) {
  currentPlan = plan;
  const advanced = plan === 'advanced';
  document.getElementById('planMetric').textContent = advanced ? 'Advanced' : 'Basic';
  document.getElementById('billingPlanName').textContent = advanced ? 'Advanced · $49/year' : 'Basic · $12/year';
  document.getElementById('checkoutItem').textContent = advanced ? 'Advanced Provider Listing — $49/year' : 'Basic Provider Listing — $12/year';
  document.querySelectorAll('.plan-switch').forEach(b => b.classList.toggle('selected', b.dataset.plan === plan));
  document.querySelectorAll('.portal-nav button').forEach(b => {
    if (['analytics', 'media', 'qr'].includes(b.dataset.panel)) b.classList.toggle('locked', !advanced);
  });
}
document.querySelectorAll('.plan-switch').forEach(b => b.addEventListener('click', () => applyPlan(b.dataset.plan)));
document.getElementById('checkoutDemo')?.addEventListener('click', () => document.getElementById('checkoutDialog').showModal());
document.getElementById('closeCheckout')?.addEventListener('click', () => document.getElementById('checkoutDialog').close());

const { data: auth } = await supabase.auth.getSession();
session = auth.session;
if (!session) location.href = 'provider-login.html';
else await loadProfile();
