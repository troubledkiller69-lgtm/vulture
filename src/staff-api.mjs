import { createRemoteJWKSet, jwtVerify } from 'jose';

const response = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
const keys = new Map();

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
    return response({ error: 'Status changes are not enabled.' }, 503);
  }
  return response({ error: 'Not found.' }, 404);
}
