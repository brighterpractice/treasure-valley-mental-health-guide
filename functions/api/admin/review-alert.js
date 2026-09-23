import { sendPendingProviderReviewEmail } from '../../_lib/review-email.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function getRequiredEnv(env, name) {
  const value = String(env?.[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function bearerToken(request) {
  const value = request.headers.get('Authorization') || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

async function getSupabaseUser(env, accessToken) {
  const url = getRequiredEnv(env, 'SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = getRequiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) return null;
  return response.json();
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

async function readSingle(env, path) {
  const response = await supabaseRequest(env, path);
  if (!response.ok) throw new Error(`Supabase lookup failed (${response.status})`);
  const rows = await response.json();
  return Array.isArray(rows) ? (rows[0] || null) : rows;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const accessToken = bearerToken(request);
  if (!accessToken) return json({ error: 'You must be signed in.' }, 401);

  try {
    const user = await getSupabaseUser(env, accessToken);
    if (!user?.id) return json({ error: 'Your session has expired. Sign in again.' }, 401);

    const provider = await readSingle(
      env,
      `/rest/v1/provider_profiles?owner_user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`,
    );
    if (!provider?.id) return json({ error: 'Provider profile not found.' }, 404);

    const publication = await readSingle(
      env,
      `/rest/v1/provider_publication?provider_id=eq.${encodeURIComponent(provider.id)}&select=status&limit=1`,
    );
    if (publication?.status !== 'paid_pending_review') {
      return json({ error: 'This profile is not waiting for administrator review.' }, 409);
    }

    const result = await sendPendingProviderReviewEmail(env, provider.id);
    return json({ ok: true, emailAlert: result });
  } catch (error) {
    console.error('Unable to send provider review alert', error);
    return json({ error: 'Unable to send the review alert right now.' }, 500);
  }
}

export function onRequestGet() {
  return json({ error: 'Method not allowed.' }, 405);
}
