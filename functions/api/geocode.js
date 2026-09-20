const ALLOWED_ORIGINS = new Set([
  'https://tvmentalhealthguide.org',
  'https://www.tvmentalhealthguide.org',
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
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.treasure-valley-mental-health-guide.pages.dev')
    );
  } catch {
    return false;
  }
}

export async function onRequestPost(context) {
  const { request } = context;

  if (!originAllowed(request.headers.get('Origin'))) {
    return json({ error: 'Origin not allowed.' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const address = String(body?.address || '')
    .trim()
    .replace(/\s+/g, ' ');

  if (address.length < 3 || address.length > 300) {
    return json({ error: 'Enter a valid address.' }, 400);
  }

  const params = new URLSearchParams({
    q: address,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'us',
  });

  let response;
  try {
    response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.8',
          'User-Agent':
            'Treasure-Valley-Mental-Health-Guide/1.0 (https://tvmentalhealthguide.org)',
        },
        redirect: 'follow',
      },
    );
  } catch {
    return json({ error: 'Address lookup is temporarily unavailable.' }, 502);
  }

  if (!response.ok) {
    return json({ error: 'Address lookup is temporarily unavailable.' }, 502);
  }

  let rows;
  try {
    rows = await response.json();
  } catch {
    return json({ error: 'Address lookup returned an invalid response.' }, 502);
  }

  const first = Array.isArray(rows) ? rows[0] : null;
  if (!first) return json({ found: false });

  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ found: false });
  }

  return json({ found: true, lat, lng });
}

export function onRequestGet() {
  return json({ error: 'Method not allowed.' }, 405);
}
