function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

function bearerToken(request) {
  const value = request.headers.get('Authorization') || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function requiredEnv(env, name) {
  const value = String(env?.[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function getUser(env, token) {
  const url = requiredEnv(env, 'SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = requiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
}

async function getAdmin(env, userId) {
  const url = requiredEnv(env, 'SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = requiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(
    `${url}/rest/v1/tv_admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id,notification_email&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw new Error('Unable to verify administrator access.');
  const rows = await response.json();
  return Array.isArray(rows) ? (rows[0] || null) : null;
}

export async function onRequestPost({ request, env }) {
  const token = bearerToken(request);
  if (!token) return json({ error: 'You must be signed in.' }, 401);

  try {
    const user = await getUser(env, token);
    if (!user?.id) return json({ error: 'Your session has expired.' }, 401);

    const admin = await getAdmin(env, user.id);
    if (!admin?.user_id) return json({ error: 'Administrator access required.' }, 403);

    const to = String(admin.notification_email || '').trim();
    if (!to) return json({ error: 'No administrator notification email is configured.' }, 409);

    const resendKey = requiredEnv(env, 'RESEND_API_KEY');
    const from = requiredEnv(env, 'ADMIN_ALERT_FROM_EMAIL');
    const siteUrl = String(env?.PUBLIC_SITE_URL || 'https://tvmentalhealthguide.org').replace(/\/$/, '');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'TVMHG test: administrator email alerts are working',
        text: `Treasure Valley Mental Health Guide administrator email notifications are configured correctly.\n\nAdministrator console: ${siteUrl}/admin`,
      }),
    });

    if (!response.ok) {
      console.error('Resend test email failed', response.status, await response.text());
      return json({ error: `Resend rejected the test email (${response.status}).` }, 502);
    }

    return json({ sent: true });
  } catch (error) {
    console.error('Admin test email failed', error);
    return json({ error: error?.message || 'Unable to send a test email.' }, 500);
  }
}

export function onRequestGet() {
  return json({ error: 'Method not allowed.' }, 405);
}
