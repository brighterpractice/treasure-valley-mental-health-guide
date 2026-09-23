import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cfg = window.TV_GUIDE_SUPABASE;
if (!cfg?.url || !cfg?.publishableKey) throw new Error('Supabase configuration is missing.');

const supabase = createClient(cfg.url, cfg.publishableKey);

function setStatus(text, kind = '') {
  const status = document.getElementById('adminEmailTestStatus');
  if (status) {
    status.textContent = text;
    status.dataset.kind = kind;
  }
}

async function sendTestEmail(button) {
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Sending…';
  setStatus('Sending through Cloudflare and Resend…');

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.access_token) throw new Error('Your administrator session has expired. Sign in again.');

    const response = await fetch('/api/admin/test-email', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error || `Test email failed (${response.status}).`);

    setStatus('Test email sent. Check your administrator inbox.', 'success');
  } catch (error) {
    console.error('Admin test email failed', error);
    setStatus(error?.message || 'Unable to send the test email.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function installEmailTestControl() {
  if (document.getElementById('sendAdminTestEmail')) return;
  const panel = document.getElementById('admin-notifications');
  const toolbar = panel?.querySelector('.admin-toolbar');
  if (!toolbar) return;

  const button = document.createElement('button');
  button.id = 'sendAdminTestEmail';
  button.type = 'button';
  button.className = 'admin-btn primary';
  button.textContent = 'Send test email';
  button.addEventListener('click', () => sendTestEmail(button));

  const status = document.createElement('span');
  status.id = 'adminEmailTestStatus';
  status.className = 'muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  toolbar.append(button, status);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installEmailTestControl, { once: true });
} else {
  installEmailTestControl();
}
