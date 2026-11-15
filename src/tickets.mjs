import { customerSession } from './customer-session.mjs';
import { readLimited } from './request-body.mjs';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

export async function customerTickets(request, env) {
  let customer;
  try { customer = await customerSession(request, env.DB); } catch { return json({ error: 'Service unavailable.' }, 503); }
  if (!customer) return json({ error: 'Sign in to access your tickets.' }, 401);
  const url = new URL(request.url);
  if (url.pathname === '/api/tickets' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, restaurant, status, cart_total_cents, fulfillment, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100').bind(customer.id).all();
    return json({ tickets: results });
  }
  const match = /^\/api\/tickets\/([a-f0-9-]{36})(\/messages|\/photo)?$/i.exec(url.pathname);
  if (!match) return json({ error: 'Not found.' }, 404);
  const order = await env.DB.prepare('SELECT id, restaurant, details, status, cart_total_cents, fulfillment, photo_key, created_at FROM orders WHERE id = ? AND customer_id = ?').bind(match[1], customer.id).first();
  if (!order) return json({ error: 'Ticket not found.' }, 404);

  if (request.method === 'GET' && match[2] === '/photo') {
    if (!order.photo_key || !env.PHOTOS) return json({ error: 'No photo attached.' }, 404);
    try {
      const photo = await env.PHOTOS.get(order.photo_key);
      if (!photo) return json({ error: 'No photo attached.' }, 404);
      return new Response(photo.body, { headers: { 'content-type': photo.httpMetadata?.contentType || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" } });
    } catch { return json({ error: 'Photo unavailable.' }, 503); }
  }

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare("SELECT id, author_role, body, created_at FROM ticket_messages WHERE order_id = ? AND visibility = 'customer' ORDER BY created_at, id LIMIT 200").bind(order.id).all();
    return json({ ticket: { ...order, photo_key: Boolean(order.photo_key) }, messages: results });
  }
  if (request.method !== 'POST' || match[2] !== '/messages') return json({ error: 'Method not allowed.' }, 405);
  if (request.headers.get('origin') !== url.origin) return json({ error: 'Invalid origin.' }, 403);
  if (['completed', 'cancelled'].includes(order.status)) return json({ error: 'This ticket is closed.' }, 409);
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json({ error: 'Expected JSON.' }, 415);
  if (env.TICKET_LIMITER) {
    const limit = await env.TICKET_LIMITER.limit({ key: customer.id });
    if (!limit.success) return json({ error: 'Too many messages. Wait a minute and try again.' }, 429);
  }
  let body;
  try { body = JSON.parse(await readLimited(request, 10000)); } catch { return json({ error: 'Invalid message.' }, 400); }
  if (typeof body?.body !== 'string' || !body.body.trim() || body.body.trim().length > 2000) return json({ error: 'Write a message of up to 2000 characters.' }, 400);
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO ticket_messages (id, order_id, author_id, author_role, visibility, body) VALUES (?, ?, ?, 'customer', 'customer', ?)").bind(id, order.id, customer.id, body.body.trim()),
    env.DB.prepare("UPDATE orders SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").bind(order.id)
  ]);
  return json({ id }, 201);
}
