function getRequiredEnv(env, name) {
  const value = String(env?.[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function supabaseRequest(env, path, init = {}) {
  const url = getRequiredEnv(env, 'SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = getRequiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const headers = new Headers(init.headers || {});
  headers.set('apikey', serviceKey);
  headers.set('Authorization', `Bearer ${serviceKey}`);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${url}${path}`, { ...init, headers });
}

async function readRows(env, path) {
  const response = await supabaseRequest(env, path);
  if (!response.ok) throw new Error(`Supabase lookup failed (${response.status})`);
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendPendingProviderReviewEmail(env, providerId) {
  const resendApiKey = String(env?.RESEND_API_KEY || '').trim();
  const from = String(env?.ADMIN_ALERT_FROM_EMAIL || '').trim();
  if (!resendApiKey || !from) {
    return { sent: false, skipped: 'email_not_configured' };
  }

  const notifications = await readRows(
    env,
    `/rest/v1/tv_admin_notifications?provider_id=eq.${encodeURIComponent(providerId)}&read_at=is.null&email_sent_at=is.null&select=id,kind,created_at&order=created_at.desc&limit=1`,
  );
  const notification = notifications[0];
  if (!notification?.id) return { sent: false, skipped: 'no_pending_notification' };

  const [providers, publications, admins] = await Promise.all([
    readRows(
      env,
      `/rest/v1/provider_profiles?id=eq.${encodeURIComponent(providerId)}&select=first_name,last_name,credentials,practice_name,primary_city,requested_plan&limit=1`,
    ),
    readRows(
      env,
      `/rest/v1/provider_publication?provider_id=eq.${encodeURIComponent(providerId)}&select=plan,status&limit=1`,
    ),
    readRows(
      env,
      '/rest/v1/tv_admin_users?notification_email=not.is.null&select=notification_email',
    ),
  ]);

  const provider = providers[0] || {};
  const publication = publications[0] || {};
  const recipients = [...new Set(
    admins
      .map((row) => String(row?.notification_email || '').trim().toLowerCase())
      .filter((email) => email.includes('@')),
  )];
  if (!recipients.length) return { sent: false, skipped: 'no_admin_email' };

  const name = `${provider.first_name || ''} ${provider.last_name || ''}`.trim() || 'A provider';
  const practice = String(provider.practice_name || '').trim();
  const credentials = String(provider.credentials || '').trim();
  const city = String(provider.primary_city || '').trim();
  const plan = publication.plan === 'advanced' || provider.requested_plan === 'advanced'
    ? 'Advanced'
    : 'Basic';
  const reviewUrl = `${String(env?.PUBLIC_SITE_URL || 'https://tvmentalhealthguide.org').replace(/\/$/, '')}/admin`;
  const isResubmission = notification.kind === 'provider_changes_resubmitted';
  const subject = isResubmission
    ? `TVMHG: ${name} resubmitted a profile for review`
    : `TVMHG: ${name} paid and is ready for review`;

  const descriptor = [credentials, practice, city].filter(Boolean).join(' · ');
  const text = [
    isResubmission
      ? `${name} has resubmitted a paid provider profile after making requested changes.`
      : `${name} has completed payment and the provider profile is ready for approval.`,
    descriptor || null,
    `Plan: ${plan}`,
    '',
    `Review profile: ${reviewUrl}`,
    '',
    'The listing remains hidden until an administrator approves it.',
  ].filter((line) => line !== null).join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#17324d;max-width:640px;margin:auto">
      <h2 style="margin-bottom:8px">Provider profile ready for review</h2>
      <p>${escapeHtml(isResubmission
        ? `${name} has resubmitted a paid provider profile after making requested changes.`
        : `${name} has completed payment and the provider profile is ready for approval.`)}</p>
      ${descriptor ? `<p><strong>${escapeHtml(descriptor)}</strong></p>` : ''}
      <p><strong>Plan:</strong> ${escapeHtml(plan)}</p>
      <p><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;padding:11px 18px;background:#153e69;color:#fff;text-decoration:none;border-radius:8px">Review provider profile</a></p>
      <p style="color:#60758a;font-size:13px">The listing remains hidden until an administrator approves it.</p>
    </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: recipients, subject, text, html }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Review alert email failed (${response.status}): ${detail.slice(0, 400)}`);
  }

  const now = new Date().toISOString();
  const update = await supabaseRequest(
    env,
    `/rest/v1/tv_admin_notifications?id=eq.${encodeURIComponent(notification.id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ email_sent_at: now }),
    },
  );
  if (!update.ok) {
    console.error('Review email sent but notification could not be marked delivered', await update.text());
  }

  return { sent: true, recipients: recipients.length };
}
