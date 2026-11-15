import { staffApi } from './staff-api.mjs';
import { readLimited } from './request-body.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});

export function validateOrder(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const clean = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
  const restaurant = clean(body.restaurant, 100);
  const details = clean(body.details, 2000);
  const contact = clean(body.contact, 254);
  const fulfillment = body.fulfillment;
  const cents = body.cartTotalCents;
  if (!restaurant || !details || !contact || !['pickup', 'delivery'].includes(fulfillment) || !Number.isSafeInteger(cents) || cents < 1 || cents > 1000000) return null;
  return { restaurant, details, contact, fulfillment, cents };
}

export async function verifyTurnstile(secret, token, hostname, client = fetch) {
  if (!secret || typeof token !== 'string' || !token || token.length > 2048) return false;
  try {
    const result = await client('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token }), signal: AbortSignal.timeout(8000)
    });
    if (!result.ok) return false;
    const data = await result.json();
    return data.success === true && data.hostname === hostname && data.action === 'order';
  } catch { return false; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/staff/')) return staffApi(request, env);
    if (url.pathname !== '/api/orders') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    // Keep intake closed until the staff workflow and anti-abuse controls are configured.
    if (env.ORDERS_ENABLED !== 'true') return json({ error: 'Ordering is not available yet.' }, 503);
    if (request.headers.get('origin') !== url.origin) return json({ error: 'Invalid request origin.' }, 403);
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json({ error: 'Expected JSON.' }, 415);
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 8192) return json({ error: 'Request is too large.' }, 413);
    let text;
    try { text = await readLimited(request, 8192); } catch (error) { return json({ error: 'Unable to read request.' }, error instanceof RangeError ? 413 : 400); }
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'Invalid request.' }, 400); }
    const order = validateOrder(body);
    if (!order) return json({ error: 'Check the restaurant, order details, contact and total.' }, 400);
    if (!await verifyTurnstile(env.TURNSTILE_SECRET, body.turnstileToken, url.hostname)) return json({ error: 'Verification failed. Please try again.' }, 400);
    const id = crypto.randomUUID();
    try {
      await env.DB.prepare('INSERT INTO orders (id, restaurant, details, contact, cart_total_cents, fulfillment) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, order.restaurant, order.details, order.contact, order.cents, order.fulfillment).run();
    } catch {
      return json({ error: 'Unable to save your request. Try again later.' }, 503);
    }
    return json({ id, status: 'new' }, 201);
  }
};
