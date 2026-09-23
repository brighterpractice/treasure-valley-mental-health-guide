import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const supabase = createClient(
  window.TV_GUIDE_SUPABASE.url,
  window.TV_GUIDE_SUPABASE.publishableKey,
);

const $ = (id) => document.getElementById(id);
let summary = {};
let submissions = [];
let providers = [];
let notifications = [];
let selected = null;

function message(text = '', kind = '') {
  const node = $('adminMessage');
  if (!node) return;
  node.textContent = text;
  node.dataset.kind = kind;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
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
  return Array.isArray(values) && values.length ? esc(values.join(', ')) : '—';
}

function formatDate(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function titleCase(value) {
  return String(value || 'unknown').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusClass(value) {
  if (['published', 'active'].includes(value)) return 'green';
  if (['paid_pending_review', 'grace_period', 'changes_requested', 'pending'].includes(value)) return 'amber';
  if (['past_due', 'expired', 'suspended', 'canceled'].includes(value)) return 'red';
  return 'blue';
}

function formatMoney(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((Number(cents) || 0) / 100);
}

function showPanel(panel) {
  document.querySelectorAll('[data-panel]').forEach((node) => {
    node.classList.toggle('active', node.dataset.panel === panel);
  });
  document.querySelectorAll('[data-admin-panel]').forEach((button) => {
    button.classList.toggle('active', button.dataset.adminPanel === panel);
  });
}

function renderSummary() {
  $('metricAwaiting').textContent = summary.awaiting_review ?? 0;
  $('metricActive').textContent = summary.active_providers ?? 0;
  $('metricPaidHidden').textContent = summary.paid_hidden ?? 0;
  $('metricExpiring').textContent = summary.expiring_30_days ?? 0;
  $('metricPastDue').textContent = summary.past_due ?? 0;
  $('metricRevenue').textContent = formatMoney(summary.annual_revenue_cents);
  $('healthTotal').textContent = summary.total_providers ?? 0;
  $('healthChanges').textContent = summary.changes_requested ?? 0;
  $('healthSuspended').textContent = summary.suspended ?? 0;
  $('healthUnread').textContent = summary.unread_notifications ?? 0;
  $('navReviewCount').textContent = summary.awaiting_review ?? submissions.length;
  $('navNotificationCount').textContent = summary.unread_notifications ?? notifications.filter((n) => !n.read_at).length;
}

function renderAttention() {
  const items = [];

  submissions.slice(0, 4).forEach((provider) => items.push({
    kind: 'review',
    label: `${provider.first_name || ''} ${provider.last_name || ''}`.trim() || 'Provider profile',
    detail: `Paid ${provider.plan === 'advanced' ? 'Advanced' : 'Basic'} listing is waiting for review`,
    id: provider.id,
  }));

  providers.filter((p) => ['past_due', 'grace_period'].includes(p.billing_status)).slice(0, 3).forEach((provider) => items.push({
    kind: 'provider',
    label: `${provider.first_name || ''} ${provider.last_name || ''}`.trim() || provider.email,
    detail: `Billing is ${titleCase(provider.billing_status)}`,
    id: provider.id,
  }));

  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  providers.filter((p) => {
    const end = p.current_period_end ? new Date(p.current_period_end).getTime() : 0;
    return end > now && end < now + thirtyDays && ['active', 'grace_period'].includes(p.billing_status);
  }).slice(0, 3).forEach((provider) => items.push({
    kind: 'provider',
    label: `${provider.first_name || ''} ${provider.last_name || ''}`.trim() || provider.email,
    detail: `Paid access ends ${formatDate(provider.current_period_end)}`,
    id: provider.id,
  }));

  $('attentionList').innerHTML = items.length
    ? items.slice(0, 8).map((item) => `
      <div class="attention-item">
        <div><strong>${esc(item.label)}</strong><span>${esc(item.detail)}</span></div>
        <button class="admin-btn" type="button" data-attention-kind="${item.kind}" data-attention-id="${item.id}">Open</button>
      </div>`).join('')
    : '<p class="empty-state">Nothing requires immediate attention.</p>';

  document.querySelectorAll('[data-attention-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.attentionKind === 'review') {
        showPanel('review');
        selectSubmission(button.dataset.attentionId);
      } else {
        showPanel('providers');
        $('providerSearch').value = providers.find((p) => p.id === button.dataset.attentionId)?.email || '';
        renderProviders();
      }
    });
  });
}

function renderReviewList() {
  $('submissionCount').textContent = submissions.length;
  $('submissionList').innerHTML = submissions.length
    ? submissions.map((provider) => `
      <button class="submission-item ${selected?.id === provider.id ? 'active' : ''}" data-id="${provider.id}">
        <strong>${esc(provider.first_name)} ${esc(provider.last_name)}</strong>
        <span>${esc(provider.practice_name || 'Independent practice')}</span>
        <small>Paid · ${formatDate(provider.submitted_at, 'Ready for review')}</small>
      </button>`).join('')
    : '<p class="empty-state">No paid profiles are waiting for review.</p>';

  document.querySelectorAll('.submission-item').forEach((button) => {
    button.addEventListener('click', () => selectSubmission(button.dataset.id));
  });
}

function renderReviewDetail() {
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
  renderReviewList();
  renderReviewDetail();
}

function providerMatchesFilters(provider) {
  const query = $('providerSearch').value.trim().toLowerCase();
  const status = $('providerStatusFilter').value;
  const plan = $('providerPlanFilter').value;
  const haystack = [provider.first_name, provider.last_name, provider.practice_name, provider.email, provider.primary_city].join(' ').toLowerCase();
  return (!query || haystack.includes(query))
    && (status === 'all' || provider.publication_status === status)
    && (plan === 'all' || provider.plan === plan);
}

function renderProviders() {
  const rows = providers.filter(providerMatchesFilters);
  $('providerTableBody').innerHTML = rows.length ? rows.map((provider) => {
    const fullName = `${provider.first_name || ''} ${provider.last_name || ''}`.trim() || 'Unnamed provider';
    const paidThrough = formatDate(provider.current_period_end);
    const actions = [];

    if (provider.publication_status === 'paid_pending_review') {
      actions.push(`<button class="admin-btn" type="button" data-provider-action="review" data-id="${provider.id}">Review</button>`);
    }
    if (provider.publication_status === 'published') {
      if (provider.public_slug) actions.push(`<a class="admin-btn" href="/providers/${encodeURIComponent(provider.public_slug)}" target="_blank" rel="noreferrer">View</a>`);
      actions.push(`<button class="admin-btn danger" type="button" data-provider-action="suspend" data-id="${provider.id}">Suspend</button>`);
    }
    if (provider.publication_status === 'suspended') {
      actions.push(`<button class="admin-btn primary" type="button" data-provider-action="reactivate" data-id="${provider.id}">Reactivate</button>`);
    }

    return `<tr>
      <td class="provider-name"><strong>${esc(fullName)}${provider.credentials ? `, ${esc(provider.credentials)}` : ''}</strong><small>${esc(provider.practice_name || provider.email || '')}</small></td>
      <td>${esc(provider.primary_city || '—')}</td>
      <td><span class="admin-pill blue">${esc(titleCase(provider.plan))}</span></td>
      <td><span class="admin-pill ${statusClass(provider.publication_status)}">${esc(titleCase(provider.publication_status))}</span></td>
      <td><span class="admin-pill ${statusClass(provider.billing_status)}">${esc(titleCase(provider.billing_status))}</span></td>
      <td>${paidThrough}</td>
      <td>${formatDate(provider.profile_updated_at)}</td>
      <td><div class="table-actions">${actions.join('') || '<span class="muted">—</span>'}</div></td>
    </tr>`;
  }).join('') : '<tr><td colspan="8" class="empty-state">No providers match these filters.</td></tr>';

  document.querySelectorAll('[data-provider-action]').forEach((button) => {
    button.addEventListener('click', () => handleProviderAction(button.dataset.providerAction, button.dataset.id));
  });
}

function notificationCopy(notification) {
  const name = notification.provider_name || notification.practice_name || 'Provider';
  if (notification.kind === 'provider_paid_pending_review') return `${name} paid and is waiting for profile review.`;
  if (notification.kind === 'provider_changes_resubmitted') return `${name} resubmitted requested profile changes.`;
  return `${name}: ${titleCase(notification.kind)}`;
}

function renderNotifications() {
  const filter = $('notificationFilter').value;
  const rows = notifications.filter((n) => filter === 'all' || !n.read_at);
  $('notificationList').innerHTML = rows.length ? rows.map((notification) => `
    <div class="notification-item ${notification.read_at ? '' : 'unread'}">
      <div class="notification-copy">
        <strong>${esc(notificationCopy(notification))}</strong>
        <span>${formatDateTime(notification.created_at)}</span>
        <div class="notification-meta">
          <span class="admin-pill ${notification.read_at ? '' : 'blue'}">${notification.read_at ? 'Read' : 'Unread'}</span>
          <span class="admin-pill ${notification.email_sent_at ? 'green' : 'amber'}">${notification.email_sent_at ? 'Email sent' : 'Email not sent'}</span>
        </div>
      </div>
      <div class="table-actions">
        ${notification.provider_id ? `<button class="admin-btn" data-notification-provider="${notification.provider_id}" type="button">Provider</button>` : ''}
        ${notification.read_at ? '' : `<button class="admin-btn" data-notification-read="${notification.id}" type="button">Mark read</button>`}
      </div>
    </div>`).join('') : '<p class="empty-state">No notifications in this view.</p>';

  document.querySelectorAll('[data-notification-read]').forEach((button) => {
    button.addEventListener('click', () => markNotificationRead(button.dataset.notificationRead));
  });
  document.querySelectorAll('[data-notification-provider]').forEach((button) => {
    button.addEventListener('click', () => {
      const provider = providers.find((item) => item.id === button.dataset.notificationProvider);
      showPanel('providers');
      $('providerSearch').value = provider?.email || provider?.last_name || '';
      renderProviders();
    });
  });
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

async function refreshAll({ quiet = false } = {}) {
  if (!quiet) message('Refreshing administrator data…');

  const [summaryResult, submissionsResult, providersResult, notificationsResult] = await Promise.all([
    supabase.rpc('admin_dashboard_summary'),
    supabase.rpc('admin_list_submissions'),
    supabase.rpc('admin_list_providers'),
    supabase.rpc('admin_list_notifications'),
  ]);

  const firstError = [summaryResult, submissionsResult, providersResult, notificationsResult].find((result) => result.error)?.error;
  if (firstError) {
    console.error(firstError);
    message(firstError.message || 'Unable to load administrator data.', 'error');
    return;
  }

  summary = summaryResult.data || {};
  submissions = submissionsResult.data || [];
  providers = providersResult.data || [];
  notifications = notificationsResult.data || [];
  if (selected) selected = submissions.find((item) => item.id === selected.id) || null;

  renderSummary();
  renderAttention();
  renderReviewList();
  renderReviewDetail();
  renderProviders();
  renderNotifications();
  if (!quiet) message('');
}

async function approve() {
  if (!selected) return;
  const providerId = selected.id;
  message('Publishing the approved provider profile…');
  $('approveProfile').disabled = true;
  $('requestChanges').disabled = true;

  const { error } = await supabase.rpc('admin_approve_provider', { target_provider_id: providerId });

  $('approveProfile').disabled = false;
  $('requestChanges').disabled = false;
  if (error) {
    message(error.message, 'error');
    return;
  }

  selected = null;
  message('Profile approved and published.', 'success');
  await refreshAll({ quiet: true });
}

async function requestChanges() {
  if (!selected) return;
  const providerId = selected.id;
  message('Requesting profile changes…');
  $('approveProfile').disabled = true;
  $('requestChanges').disabled = true;

  const { error } = await supabase.rpc('admin_request_provider_changes', { target_provider_id: providerId });

  $('approveProfile').disabled = false;
  $('requestChanges').disabled = false;
  if (error) {
    message(error.message, 'error');
    return;
  }

  selected = null;
  message('Changes requested. The listing remains private while paid access stays active.', 'success');
  await refreshAll({ quiet: true });
}

async function handleProviderAction(action, id) {
  const provider = providers.find((item) => item.id === id);
  if (!provider) return;

  if (action === 'review') {
    showPanel('review');
    selectSubmission(id);
    return;
  }

  if (action === 'suspend') {
    const name = `${provider.first_name || ''} ${provider.last_name || ''}`.trim() || provider.email;
    if (!confirm(`Suspend ${name}'s public listing? Their paid time will remain unchanged.`)) return;
    message('Suspending provider listing…');
    const { error } = await supabase.rpc('admin_suspend_provider', { target_provider_id: id });
    if (error) { message(error.message, 'error'); return; }
    message('Provider listing suspended. Paid access was not changed.', 'success');
    await refreshAll({ quiet: true });
    return;
  }

  if (action === 'reactivate') {
    message('Reactivating provider listing…');
    const { error } = await supabase.rpc('admin_reactivate_provider', { target_provider_id: id });
    if (error) { message(error.message, 'error'); return; }
    message('Provider listing reactivated.', 'success');
    await refreshAll({ quiet: true });
  }
}

async function markNotificationRead(id) {
  const { error } = await supabase.rpc('admin_mark_notification_read', { target_notification_id: Number(id) });
  if (error) { message(error.message, 'error'); return; }
  await refreshAll({ quiet: true });
}

document.querySelectorAll('[data-admin-panel]').forEach((button) => {
  button.addEventListener('click', () => showPanel(button.dataset.adminPanel));
});
$('providerSearch').addEventListener('input', renderProviders);
$('providerStatusFilter').addEventListener('change', renderProviders);
$('providerPlanFilter').addEventListener('change', renderProviders);
$('notificationFilter').addEventListener('change', renderNotifications);
$('approveProfile').addEventListener('click', approve);
$('requestChanges').addEventListener('click', requestChanges);
$('signOut').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) { message(error.message, 'error'); return; }
  location.replace('/provider-login?signed_out=1');
});

if (await verifyAdminAccess()) {
  await refreshAll();
}
