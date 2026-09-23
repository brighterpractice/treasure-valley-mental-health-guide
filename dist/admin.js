import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const supabase = createClient(
  window.TV_GUIDE_SUPABASE.url,
  window.TV_GUIDE_SUPABASE.publishableKey,
);

let submissions = [];
let selected = null;
const $ = (id) => document.getElementById(id);

function message(text, kind = '') {
  const node = $('adminMessage');
  if (!node) return;
  node.textContent = text;
  node.dataset.kind = kind;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]);
}

function safeLink(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return esc(raw);
    const safe = esc(url.toString());
    return `<a href="${safe}" target="_blank" rel="noreferrer">${safe}</a>`;
  } catch {
    return esc(raw);
  }
}

function listText(values) {
  return Array.isArray(values) && values.length
    ? esc(values.join(', '))
    : '—';
}

function formatDate(value) {
  if (!value) return 'Ready for review';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Ready for review'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderList() {
  $('submissionCount').textContent = submissions.length;
  $('submissionList').innerHTML = submissions.length
    ? submissions.map((provider) => `
      <button class="submission-item ${selected?.id === provider.id ? 'active' : ''}" data-id="${provider.id}">
        <strong>${esc(provider.first_name)} ${esc(provider.last_name)}</strong>
        <span>${esc(provider.practice_name || 'Independent practice')}</span>
        <small>Paid · ${formatDate(provider.submitted_at)}</small>
      </button>`).join('')
    : '<p class="muted">No paid profiles are waiting for review.</p>';

  document.querySelectorAll('.submission-item').forEach((button) => {
    button.addEventListener('click', () => selectSubmission(button.dataset.id));
  });
}

function renderDetail() {
  if (!selected) {
    $('emptyReview').hidden = false;
    $('reviewCard').hidden = true;
    return;
  }

  $('emptyReview').hidden = true;
  $('reviewCard').hidden = false;
  $('reviewName').textContent = `${selected.first_name} ${selected.last_name}${selected.credentials ? `, ${selected.credentials}` : ''}`;
  $('reviewPractice').textContent = `${selected.practice_name || 'Independent practice'} · ${selected.primary_city || 'No city listed'}`;
  $('reviewStatus').textContent = 'Paid · awaiting review';
  $('reviewPlanText').textContent = selected.plan === 'advanced' ? 'Advanced · $49/year' : 'Basic · $12/year';

  const qrCodes = [
    selected.show_website_qr ? 'Website' : '',
    selected.show_portal_qr ? 'Portal / scheduling' : '',
  ].filter(Boolean).join(', ') || 'None';

  const license = selected.license_number
    ? `${esc(selected.license_state || 'State')} · ${esc(selected.license_number)}`
    : '—';

  const rows = [
    ['Bio', esc(selected.short_bio || '—')],
    ['Website', safeLink(selected.website_url)],
    ['YouTube video', safeLink(selected.video_url)],
    ['Client portal', safeLink(selected.client_portal_url)],
    ['Public QR codes', esc(qrCodes)],
    ['Availability', esc(selected.availability || '—')],
    ['Visit type', listText(selected.visit_types)],
    ['Provider gender', esc(selected.provider_gender || '—')],
    ['State license', license],
    ['Who they work with', listText(selected.populations)],
    ['Insurance / payment', listText(selected.insurance)],
    ['Specialties', listText(selected.specialties)],
    ['Services', listText(selected.services)],
    ['Modalities / approaches', listText(selected.approaches)],
    ['Paid plan', selected.plan === 'advanced' ? 'Advanced' : 'Basic'],
  ];

  $('reviewFields').innerHTML = rows
    .map(([label, value]) => `<div class="review-field"><dt>${esc(label)}</dt><dd>${value}</dd></div>`)
    .join('');
}

function selectSubmission(id) {
  selected = submissions.find((provider) => provider.id === id) || null;
  renderList();
  renderDetail();
}

async function verifyAdminAccess() {
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    location.replace('/provider-login');
    return false;
  }

  const { data: isAdmin, error } = await supabase.rpc('tv_is_admin');
  if (error || isAdmin !== true) {
    location.replace('/dashboard?admin=denied');
    return false;
  }

  document.body.hidden = false;
  return true;
}

async function load() {
  if (!await verifyAdminAccess()) return;

  const { data, error } = await supabase.rpc('admin_list_submissions');
  if (error) {
    console.error(error);
    message('Unable to load the administrator review queue.', 'error');
    return;
  }

  submissions = data || [];
  renderList();
  renderDetail();
}

async function approve() {
  if (!selected) return;
  const providerId = selected.id;
  message('Publishing the approved provider profile…');
  $('approveProfile').disabled = true;
  $('requestChanges').disabled = true;

  const { error } = await supabase.rpc('admin_approve_provider', {
    target_provider_id: providerId,
  });

  $('approveProfile').disabled = false;
  $('requestChanges').disabled = false;
  if (error) {
    message(error.message, 'error');
    return;
  }

  message('Profile approved and published. The paid annual access remains active.', 'success');
  submissions = submissions.filter((provider) => provider.id !== providerId);
  selected = null;
  renderList();
  renderDetail();
}

async function requestChanges() {
  if (!selected) return;
  const providerId = selected.id;
  message('Requesting profile changes…');
  $('approveProfile').disabled = true;
  $('requestChanges').disabled = true;

  const { error } = await supabase.rpc('admin_request_provider_changes', {
    target_provider_id: providerId,
  });

  $('approveProfile').disabled = false;
  $('requestChanges').disabled = false;
  if (error) {
    message(error.message, 'error');
    return;
  }

  message('Changes requested. The provider remains paid, but the listing stays private until resubmitted and approved.', 'success');
  submissions = submissions.filter((provider) => provider.id !== providerId);
  selected = null;
  renderList();
  renderDetail();
}

$('approveProfile').addEventListener('click', approve);
$('requestChanges').addEventListener('click', requestChanges);
$('signOut').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    message(error.message, 'error');
    return;
  }
  location.replace('/provider-login?signed_out=1');
});

await load();
