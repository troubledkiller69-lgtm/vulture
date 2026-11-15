import { staffApi } from './staff-api.mjs';
import { readLimited } from './request-body.mjs';
import { parsePhoto } from './photo.mjs';
import { customerSession } from './customer-session.mjs';
import { customerTickets } from './tickets.mjs';
import { accounts } from './accounts.mjs';
import { staffAuth } from './staff-auth.mjs';

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
    if (url.pathname.startsWith('/api/account/')) {
      try { return await accounts(request,env); } catch (error) { console.error('account request failed', error); return json({error:'Account service unavailable.'},503); }
    }
    if (url.pathname === '/api/tickets' || url.pathname.startsWith('/api/tickets/')) {
      try { return await customerTickets(request, env); } catch { return json({ error: 'Tickets are temporarily unavailable.' }, 503); }
    }
    if (url.pathname === '/api/config' && request.method === 'GET') return json({ ordersEnabled: env.ORDERS_ENABLED === 'true', accountsEnabled: env.ACCOUNTS_ENABLED === 'true', turnstileSiteKey: env.TURNSTILE_SITE_KEY || '' });
    if (url.pathname === '/api/staff/session') {
      try { return await staffAuth(request, env); } catch { return json({ error: 'Staff sign-in is unavailable.' }, 503); }
    }
    if (url.pathname.startsWith('/api/staff/')) return staffApi(request, env);
    if (url.pathname !== '/api/orders') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    // Keep intake closed until the staff workflow and anti-abuse controls are configured.
    if (env.ORDERS_ENABLED !== 'true') return json({ error: 'Ordering is not available yet.' }, 503);
    if (request.headers.get('origin') !== url.origin) return json({ error: 'Invalid request origin.' }, 403);
    let customer;
    try { customer = await customerSession(request, env.DB); } catch { return json({ error: 'Sign-in service unavailable.' }, 503); }
    if (!customer) return json({ error: 'Create an account or sign in before ordering.' }, 401);
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json({ error: 'Expected JSON.' }, 415);
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 3000000) return json({ error: 'Request is too large.' }, 413);
    let text;
    try { text = await readLimited(request, 3000000); } catch (error) { return json({ error: 'Unable to read request.' }, error instanceof RangeError ? 413 : 400); }
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'Invalid request.' }, 400); }
    const order = validateOrder(body);
    if (!order) return json({ error: 'Check the restaurant, order details, contact and total.' }, 400);
    let photo;
    try { photo = parsePhoto(body.photo); } catch (error) { return json({ error: error.message }, 400); }
    if (photo && !env.PHOTOS) return json({ error: 'Photo uploads are temporarily unavailable.' }, 503);
    if (!await verifyTurnstile(env.TURNSTILE_SECRET, body.turnstileToken, url.hostname)) return json({ error: 'Verification failed. Please try again.' }, 400);
    if (env.ORDER_LIMITER) {
      const limit = await env.ORDER_LIMITER.limit({ key: customer.id });
      if (!limit.success) return json({ error: 'Too many requests. Wait a minute and try again.' }, 429);
    }
    const id = crypto.randomUUID();
    const photoKey = photo ? `orders/${id}` : null;
    try {
      if (photo) await env.PHOTOS.put(photoKey, photo.bytes, { httpMetadata: { contentType: photo.type } });
      await env.DB.prepare('INSERT INTO orders (id, restaurant, details, contact, cart_total_cents, fulfillment, customer_id, photo_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, order.restaurant, order.details, order.contact, order.cents, order.fulfillment, customer.id, photoKey).run();
    } catch {
      if (photo) { try { await env.PHOTOS.delete(`orders/${id}`); } catch {} }
      return json({ error: 'Unable to save your request. Try again later.' }, 503);
    }
    return json({ id, status: 'new' }, 201);
  }
};
