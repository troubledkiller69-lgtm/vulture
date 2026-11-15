import { createRemoteJWKSet, jwtVerify } from 'jose';

const response = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
const keys = new Map();
const transitions = { new: ['claimed', 'cancelled'], claimed: ['placing', 'cancelled'], placing: ['completed', 'cancelled'], completed: [], cancelled: [] };

export async function updateStatus(db, id, user, previousStatus, status) {
  const change = db.prepare("UPDATE orders SET status = ?, assigned_staff = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status = ? AND (assigned_staff IS NULL OR assigned_staff = ?)")
    .bind(status, user, id, previousStatus, user);
  const audit = db.prepare("INSERT INTO order_events (id, order_id, actor, event_type, note) SELECT ?, ?, ?, 'status_changed', ? WHERE changes() = 1")
    .bind(crypto.randomUUID(), id, user, `${previousStatus} to ${status}`);
  const result = await db.batch([change, audit]);
  return result[0].meta.changes === 1;
}

export async function authenticate(request, env) {
  const host = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  if (!host || !audience || !/^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(host)) return null;
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return null;
  try {
    if (!keys.has(host)) keys.set(host, createRemoteJWKSet(new URL(`https://${host}/cdn-cgi/access/certs`)));
    const { payload } = await jwtVerify(token, keys.get(host), { issuer: `https://${host}`, audience, algorithms: ['RS256'] });
    return typeof payload.email === 'string' && payload.email ? payload.email : null;
  } catch { return null; }
}

export async function staffApi(request, env) {
  const user = await authenticate(request, env);
  if (!user) return response({ error: 'Staff sign-in required.' }, 403);
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/staff/orders') {
    try {
      const rows = await env.DB.prepare('SELECT id, restaurant, details, contact, cart_total_cents, fulfillment, status, assigned_staff, created_at, updated_at FROM orders ORDER BY created_at DESC LIMIT 100').all();
      return response({ orders: rows.results });
    } catch { return response({ error: 'Orders are unavailable.' }, 503); }
  }
  if (request.method === 'POST' && /^\/api\/staff\/orders\/[0-9a-f-]{36}\/status$/i.test(url.pathname)) {
    if (request.headers.get('origin') !== url.origin) return response({ error: 'Invalid request origin.' }, 403);
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return response({ error: 'Expected JSON.' }, 415);
    let body;
    try {
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > 1024) return response({ error: 'Request too large.' }, 413);
      body = JSON.parse(text);
    } catch { return response({ error: 'Invalid request.' }, 400); }
    if (!body || !Object.hasOwn(transitions, body.previousStatus) || !transitions[body.previousStatus].includes(body.status)) return response({ error: 'Invalid status change.' }, 400);
    try {
      const id = url.pathname.split('/')[4];
      if (!await updateStatus(env.DB, id, user, body.previousStatus, body.status)) return response({ error: 'Order changed or was claimed by another staff member. Refresh and try again.' }, 409);
      return response({ status: body.status });
    } catch { return response({ error: 'Unable to update order.' }, 503); }
  }
  return response({ error: 'Not found.' }, 404);
}
