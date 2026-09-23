const ALLOWED_ORIGINS = new Set([
  'https://tvmentalhealthguide.org',
  'https://www.tvmentalhealthguide.org',
]);

const SQUARE_API_VERSION = '2026-08-19';
const PREPAYMENT_STATUSES = new Set([
  'draft',
  'submitted',
  'approved_pending_payment',
  'payment_pending',
]);

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

function originAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' &&
      url.hostname.endsWith('.treasure-valley-mental-health-guide.pages.dev');
  } catch {
    return false;
  }
}

function getRequiredEnv(env, name) {
  const value = String(env?.[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function squareBaseUrl(environment) {
  return String(environment || '').trim().toLowerCase() === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
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

function planAmount(plan) {
  return plan === 'advanced' ? 4900 : 1200;
}

function planLabel(plan) {
  return plan === 'advanced'
    ? 'Advanced Provider Listing'
    : 'Basic Provider Listing';
}

function planVariationId(env, plan) {
  return getRequiredEnv(
    env,
    plan === 'advanced'
      ? 'SQUARE_ADVANCED_PLAN_VARIATION_ID'
      : 'SQUARE_BASIC_PLAN_VARIATION_ID',
  );
}

function profileReadyForPayment(provider) {
  return Boolean(
    String(provider?.first_name || '').trim() &&
    String(provider?.last_name || '').trim() &&
    String(provider?.credentials || '').trim() &&
    String(provider?.primary_city || '').trim() &&
    String(provider?.short_bio || '').trim()
  );
}

async function createSquarePaymentLink(env, { providerId, plan, billingMode, redirectUrl }) {
  const accessToken = getRequiredEnv(env, 'SQUARE_ACCESS_TOKEN');
  const locationId = getRequiredEnv(env, 'SQUARE_LOCATION_ID');
  const amountCents = planAmount(plan);
  const name = `Treasure Valley Mental Health Guide — ${planLabel(plan)}`;
  const checkoutOptions = { redirect_url: redirectUrl };

  if (billingMode === 'auto_renew') {
    checkoutOptions.subscription_plan_id = planVariationId(env, plan);
  }

  const response = await fetch(
    `${squareBaseUrl(env.SQUARE_ENVIRONMENT)}/v2/online-checkout/payment-links`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': SQUARE_API_VERSION,
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        description: name,
        quick_pay: {
          name,
          price_money: { amount: amountCents, currency: 'USD' },
          location_id: locationId,
        },
        checkout_options: checkoutOptions,
        payment_note: `TVMHG provider ${providerId}`,
      }),
    },
  );

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Square returned an unreadable response (${response.status})`);
  }

  if (!response.ok) {
    const detail = Array.isArray(payload?.errors)
      ? payload.errors.map((error) => error?.detail || error?.code).filter(Boolean).join('; ')
      : '';
    throw new Error(detail || `Square checkout request failed (${response.status})`);
  }

  const paymentLink = payload?.payment_link;
  if (!paymentLink?.id || !paymentLink?.url || !paymentLink?.order_id) {
    throw new Error('Square did not return a usable payment link');
  }

  return {
    id: paymentLink.id,
    url: paymentLink.url,
    orderId: paymentLink.order_id,
    amountCents,
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!originAllowed(request.headers.get('Origin'))) {
    return json({ error: 'Origin not allowed.' }, 403);
  }

  const accessToken = bearerToken(request);
  if (!accessToken) return json({ error: 'You must be signed in.' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const billingMode = body?.billingMode === 'auto_renew' ? 'auto_renew' : 'one_time';

  try {
    const user = await getSupabaseUser(env, accessToken);
    if (!user?.id) return json({ error: 'Your session has expired. Sign in again.' }, 401);

    const provider = await readSingle(
      env,
      `/rest/v1/provider_profiles?owner_user_id=eq.${encodeURIComponent(user.id)}&select=id,requested_plan,first_name,last_name,credentials,primary_city,short_bio&limit=1`,
    );
    if (!provider?.id) return json({ error: 'Provider profile not found.' }, 404);

    if (!profileReadyForPayment(provider)) {
      return json({
        error: 'Complete and save your first name, last name, credentials, primary city, and short bio before payment.',
      }, 409);
    }

    const publication = await readSingle(
      env,
      `/rest/v1/provider_publication?provider_id=eq.${encodeURIComponent(provider.id)}&select=plan,status&limit=1`,
    );
    if (!publication) return json({ error: 'Publication record not found.' }, 409);

    if (!PREPAYMENT_STATUSES.has(publication.status)) {
      const error = publication.status === 'published'
        ? 'This listing is already active.'
        : publication.status === 'paid_pending_review'
          ? 'Payment has already been received. Your profile is awaiting administrator review.'
          : publication.status === 'changes_requested'
            ? 'Payment is already active. Save the requested changes and resubmit your profile for review.'
            : publication.status === 'suspended'
              ? 'This listing is suspended. Contact the directory administrator.'
              : 'This profile is not eligible for a new checkout.';
      return json({ error }, 409);
    }

    const existingSubscription = await readSingle(
      env,
      `/rest/v1/provider_subscriptions?provider_id=eq.${encodeURIComponent(provider.id)}&select=status,current_period_end&limit=1`,
    );
    if (existingSubscription && ['active', 'grace_period'].includes(existingSubscription.status)) {
      return json({ error: 'Your annual payment is already active.' }, 409);
    }

    const requestedPlan = provider.requested_plan === 'advanced' ? 'advanced' : 'basic';
    const plan = publication.status === 'approved_pending_payment'
      ? (publication.plan === 'advanced' ? 'advanced' : 'basic')
      : requestedPlan;

    const origin = new URL(request.url).origin;
    const redirectUrl = `${origin}/dashboard?panel=billing&checkout=success`;
    const paymentLink = await createSquarePaymentLink(env, {
      providerId: provider.id,
      plan,
      billingMode,
      redirectUrl,
    });

    const now = new Date().toISOString();
    const subscriptionResponse = await supabaseRequest(
      env,
      '/rest/v1/provider_subscriptions?on_conflict=provider_id',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          provider_id: provider.id,
          plan,
          billing_mode: billingMode,
          status: 'pending',
          payment_source: 'square',
          square_order_id: paymentLink.orderId,
          square_payment_id: null,
          grace_until: null,
          cancel_at_period_end: false,
          updated_at: now,
        }),
      },
    );

    if (!subscriptionResponse.ok) {
      console.error('Unable to save provider Square checkout', await subscriptionResponse.text());
      return json({ error: 'Checkout was created, but billing state could not be saved.' }, 500);
    }

    const publicationResponse = await supabaseRequest(
      env,
      `/rest/v1/provider_publication?provider_id=eq.${encodeURIComponent(provider.id)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ plan, status: 'payment_pending' }),
      },
    );
    if (!publicationResponse.ok) {
      console.error('Unable to mark provider payment pending', await publicationResponse.text());
      return json({ error: 'Checkout was created, but the provider workflow could not be updated.' }, 500);
    }

    const eventResponse = await supabaseRequest(env, '/rest/v1/provider_billing_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        provider_id: provider.id,
        event_type: 'square_checkout_created',
        external_event_id: `checkout:${paymentLink.id}`,
        amount_cents: paymentLink.amountCents,
        currency: 'USD',
        details: {
          plan,
          billing_mode: billingMode,
          square_payment_link_id: paymentLink.id,
          square_order_id: paymentLink.orderId,
        },
      }),
    });
    if (!eventResponse.ok && eventResponse.status !== 409) {
      console.error('Unable to record checkout audit event', await eventResponse.text());
    }

    return json({ checkoutUrl: paymentLink.url });
  } catch (error) {
    console.error('Unable to start provider checkout', error);
    return json({ error: 'Unable to start secure Square checkout right now.' }, 502);
  }
}

export function onRequestGet() {
  return json({ error: 'Method not allowed.' }, 405);
}
