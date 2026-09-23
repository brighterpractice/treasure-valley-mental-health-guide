import { sendPendingProviderReviewEmail } from '../../_lib/review-email.js';

const SQUARE_API_VERSION = '2026-08-19';

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

function base64Encode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifySquareWebhookSignature({ requestBody, signatureHeader, signatureKey, notificationUrl }) {
  if (!requestBody || !signatureHeader || !signatureKey || !notificationUrl) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signatureKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${notificationUrl}${requestBody}`),
  );
  return constantTimeEqual(base64Encode(new Uint8Array(digest)), signatureHeader);
}

function parseAmount(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function expectedAmount(plan) {
  return plan === 'advanced' ? 4900 : 1200;
}

function addOneYear(isoValue) {
  const start = new Date(isoValue);
  if (Number.isNaN(start.getTime())) throw new Error('Square payment timestamp is invalid');
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function findSubscription(env, payment) {
  const orderId = String(payment?.order_id || '').trim();
  if (orderId) {
    const response = await supabaseRequest(
      env,
      `/rest/v1/provider_subscriptions?square_order_id=eq.${encodeURIComponent(orderId)}&select=provider_id,plan,billing_mode,status,current_period_end,square_customer_id,square_subscription_id&limit=1`,
    );
    if (!response.ok) throw new Error(`Unable to map Square order (${response.status})`);
    const rows = await response.json();
    if (rows?.[0]) return rows[0];
  }

  const customerId = String(payment?.customer_id || '').trim();
  if (customerId) {
    const response = await supabaseRequest(
      env,
      `/rest/v1/provider_subscriptions?square_customer_id=eq.${encodeURIComponent(customerId)}&select=provider_id,plan,billing_mode,status,current_period_end,square_customer_id,square_subscription_id&limit=1`,
    );
    if (!response.ok) throw new Error(`Unable to map Square customer (${response.status})`);
    const rows = await response.json();
    if (rows?.[0]) return rows[0];
  }

  return null;
}

async function eventAlreadyApplied(env, eventId) {
  const response = await supabaseRequest(
    env,
    `/rest/v1/provider_billing_events?external_event_id=eq.${encodeURIComponent(eventId)}&select=id&limit=1`,
  );
  if (!response.ok) throw new Error(`Unable to check webhook idempotency (${response.status})`);
  const rows = await response.json();
  return Boolean(rows?.[0]);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let signatureKey;
  try {
    signatureKey = getRequiredEnv(env, 'SQUARE_WEBHOOK_SIGNATURE_KEY');
  } catch {
    return json({ error: 'Square webhooks are not configured.' }, 503);
  }

  // Square signs the exact notification URL plus the raw request body.
  // Using the URL that actually received the webhook keeps verification correct
  // for both deployment-specific preview URLs and the production custom domain.
  const notificationUrl = request.url;

  const signatureHeader =
    request.headers.get('x-square-hmacsha256-signature')?.trim() || '';
  const rawBody = await request.text();
  const signatureValid = await verifySquareWebhookSignature({
    requestBody: rawBody,
    signatureHeader,
    signatureKey,
    notificationUrl,
  });

  if (!signatureValid) return json({ error: 'Invalid Square webhook signature.' }, 401);

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Square webhook body is not valid JSON.' }, 400);
  }

  const eventId = String(event?.event_id || '').trim();
  const eventType = String(event?.type || '').trim();
  if (!eventId || !eventType) {
    return json({ error: 'Square webhook is missing its event ID or type.' }, 400);
  }

  const payment = event?.data?.object?.payment;
  if (!payment || !['payment.created', 'payment.updated'].includes(eventType)) {
    return json({ received: true, ignored: 'unsupported_event' });
  }

  if (String(payment.status || '').toUpperCase() !== 'COMPLETED') {
    return json({ received: true, ignored: 'payment_not_completed' });
  }

  try {
    if (await eventAlreadyApplied(env, eventId)) {
      return json({ received: true, duplicate: true });
    }

    const subscription = await findSubscription(env, payment);
    if (!subscription?.provider_id) {
      return json({ received: true, ignored: 'unmatched_payment' });
    }

    const amountCents = parseAmount(payment?.amount_money?.amount);
    const currency = String(payment?.amount_money?.currency || '').toUpperCase();
    if (currency !== 'USD' || amountCents !== expectedAmount(subscription.plan)) {
      console.error('Square provider payment amount mismatch', {
        eventId,
        providerId: subscription.provider_id,
        amountCents,
        currency,
      });
      return json({ error: 'Payment amount did not match the provider plan.' }, 409);
    }

    const paidAt = payment.updated_at || event.created_at || new Date().toISOString();
    const period = addOneYear(paidAt);
    const orderId = String(payment.order_id || '').trim() || null;
    const paymentId = String(payment.id || '').trim() || null;
    const customerId = String(payment.customer_id || '').trim() || subscription.square_customer_id || null;

    const rpcResponse = await supabaseRequest(env, '/rest/v1/rpc/billing_activate_provider', {
      method: 'POST',
      body: JSON.stringify({
        target_provider_id: subscription.provider_id,
        target_plan: subscription.plan,
        target_billing_mode: subscription.billing_mode === 'auto_renew' ? 'auto_renew' : 'one_time',
        target_period_start: period.start,
        target_period_end: period.end,
        target_square_customer_id: customerId,
        target_square_subscription_id: subscription.square_subscription_id || null,
        target_square_order_id: orderId,
        target_square_payment_id: paymentId,
        target_external_event_id: eventId,
        target_amount_cents: amountCents,
      }),
    });

    if (!rpcResponse.ok) {
      console.error('Unable to activate provider from Square webhook', {
        eventId,
        status: rpcResponse.status,
        body: await rpcResponse.text(),
      });
      return json({ error: 'Unable to reconcile Square webhook.' }, 500);
    }

    let emailAlert = { sent: false, skipped: 'not_attempted' };
    try {
      emailAlert = await sendPendingProviderReviewEmail(env, subscription.provider_id);
    } catch (emailError) {
      // Payment reconciliation must never fail because an alert email provider is down.
      console.error('Provider payment activated but review email could not be sent', emailError);
      emailAlert = { sent: false, skipped: 'send_failed' };
    }

    return json({
      received: true,
      activated: true,
      providerId: subscription.provider_id,
      reviewQueued: true,
      emailAlert,
    });
  } catch (error) {
    console.error('Unable to reconcile provider Square webhook', error);
    return json({ error: 'Unable to reconcile Square webhook.' }, 500);
  }
}

export function onRequestGet() {
  return json({ error: 'Method not allowed.' }, 405);
}
