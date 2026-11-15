import { staffIdentity } from './staff-auth.mjs';
import { readLimited } from './request-body.mjs';

const response = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
const transitions = { new: ['claimed', 'cancelled'], claimed: ['placing', 'cancelled'], placing: ['completed', 'cancelled'], completed: [], cancelled: [] };
const idPattern = /^\/api\/staff\/orders\/([0-9a-f-]{36})(?:\/(photo|messages|status))?$/i;

export async function updateStatus(db, id, user, previousStatus, status) {
  const change = db.prepare("UPDATE orders SET status = ?, assigned_staff = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status = ? AND (assigned_staff IS NULL OR assigned_staff = ?)")
    .bind(status, user, id, previousStatus, user);
  const audit = db.prepare("INSERT INTO order_events (id, order_id, actor, event_type, note) SELECT ?, ?, ?, 'status_changed', ? WHERE changes() = 1")
    .bind(crypto.randomUUID(), id, user, `${previousStatus} to ${status}`);
  const result = await db.batch([change, audit]);
  return result[0].meta.changes === 1;
}

export async function staffApi(request, env) {
  const user = await staffIdentity(request, env);
  if (!user) return response({ error: 'Staff sign-in required.' }, 403);
  const url = new URL(request.url);
  const match = idPattern.exec(url.pathname);
  const actor = user.email;

  if (request.method === 'GET' && url.pathname === '/api/staff/orders') {
    try {
      const rows = await env.DB.prepare(`SELECT o.id, o.restaurant, o.details, o.contact, o.cart_total_cents, o.fulfillment, o.status,
          o.assigned_staff, o.created_at, o.updated_at, o.photo_key, c.name AS customer_name, c.email AS customer_email,
          (SELECT COUNT(*) FROM ticket_messages m WHERE m.order_id = o.id AND m.visibility = 'customer') AS customer_messages
        FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
        ORDER BY CASE o.status WHEN 'new' THEN 0 WHEN 'claimed' THEN 1 WHEN 'placing' THEN 2 ELSE 3 END, o.created_at DESC
        LIMIT 200`).all();
      return response({ orders: rows.results });
    } catch { return response({ error: 'Orders are unavailable.' }, 503); }
  }

  if (!match) return response({ error: 'Not found.' }, 404);
  const id = match[1];
  const action = match[2];

  if (request.method === 'GET' && action === 'photo') {
    try {
      const order = await env.DB.prepare('SELECT photo_key FROM orders WHERE id = ?').bind(id).first();
      if (!order?.photo_key || !env.PHOTOS) return response({ error: 'No photo attached.' }, 404);
      const photo = await env.PHOTOS.get(order.photo_key);
      if (!photo) return response({ error: 'No photo attached.' }, 404);
      return new Response(photo.body, { headers: { 'content-type': photo.httpMetadata?.contentType || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" } });
    } catch { return response({ error: 'Photo unavailable.' }, 503); }
  }

  if (request.method === 'GET' && !action) {
    try {
      const ticket = await env.DB.prepare(`SELECT o.id, o.restaurant, o.details, o.contact, o.cart_total_cents, o.fulfillment, o.status,
          o.assigned_staff, o.created_at, o.updated_at, o.photo_key, c.name AS customer_name, c.email AS customer_email
        FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`).bind(id).first();
      if (!ticket) return response({ error: 'Ticket not found.' }, 404);
      const [messages, events] = await env.DB.batch([
        env.DB.prepare('SELECT id, author_id, author_role, visibility, body, created_at FROM ticket_messages WHERE order_id = ? ORDER BY created_at, id LIMIT 500').bind(id),
        env.DB.prepare('SELECT actor, event_type, note, created_at FROM order_events WHERE order_id = ? ORDER BY created_at, id LIMIT 200').bind(id)
      ]);
      return response({ ticket, messages: messages.results, events: events.results });
    } catch { return response({ error: 'Ticket is unavailable.' }, 503); }
  }

  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);
  if (request.headers.get('origin') !== url.origin) return response({ error: 'Invalid request origin.' }, 403);
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return response({ error: 'Expected JSON.' }, 415);

  let body;
  try { body = JSON.parse(await readLimited(request, 4096)); } catch (error) { return response({ error: 'Invalid request.' }, error instanceof RangeError ? 413 : 400); }

  if (action === 'status') {
    if (!body || !Object.hasOwn(transitions, body.previousStatus) || !transitions[body.previousStatus].includes(body.status)) return response({ error: 'Invalid status change.' }, 400);
    try {
      if (!await updateStatus(env.DB, id, actor, body.previousStatus, body.status)) return response({ error: 'Ticket changed or was claimed by another crew member. Refresh and try again.' }, 409);
      return response({ status: body.status });
    } catch { return response({ error: 'Unable to update ticket.' }, 503); }
  }

  if (action === 'messages') {
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    const visibility = body?.visibility === 'staff' ? 'staff' : 'customer';
    if (!text || text.length > 2000) return response({ error: 'Write a message of up to 2000 characters.' }, 400);
    try {
      const ticket = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind(id).first();
      if (!ticket) return response({ error: 'Ticket not found.' }, 404);
      if (ticket.status === 'cancelled') return response({ error: 'This ticket is closed.' }, 409);
      const messageId = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO ticket_messages (id, order_id, author_id, author_role, visibility, body) VALUES (?, ?, ?, 'staff', ?, ?)").bind(messageId, id, actor, visibility, text),
        env.DB.prepare("UPDATE orders SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").bind(id),
        env.DB.prepare("INSERT INTO order_events (id, order_id, actor, event_type, note) VALUES (?, ?, ?, 'message_added', ?)").bind(crypto.randomUUID(), id, actor, visibility === 'staff' ? 'staff note' : 'customer reply')
      ]);
      return response({ id: messageId }, 201);
    } catch { return response({ error: 'Unable to send the message.' }, 503); }
  }

  return response({ error: 'Not found.' }, 404);
}
