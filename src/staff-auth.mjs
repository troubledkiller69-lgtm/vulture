import { createRemoteJWKSet, jwtVerify } from 'jose';
import { readLimited } from './request-body.mjs';
import { passwordMatches } from './accounts.mjs';
import { tokenHash } from './customer-session.mjs';

const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } });
const COOKIE = '__Host-vulture_staff';
const SESSION_MS = 8 * 60 * 60 * 1000;
const keys = new Map();

export function sessionToken(request) {
  const cookies = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).filter(Boolean);
  const matches = cookies.filter(value => value.startsWith(`${COOKIE}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

async function accessEmail(request, env) {
  const host = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  if (!host || !audience || !/^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(host)) return null;
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return null;
  try {
    if (!keys.has(host)) keys.set(host, createRemoteJWKSet(new URL(`https://${host}/cdn-cgi/access/certs`)));
    const { payload } = await jwtVerify(token, keys.get(host), { issuer: `https://${host}`, audience, algorithms: ['RS256'] });
    return typeof payload.email === 'string' && payload.email ? payload.email.toLowerCase() : null;
  } catch { return null; }
}

export async function staffIdentity(request, env) {
  const viaAccess = await accessEmail(request, env);
  if (viaAccess) return { email: viaAccess, via: 'access' };
  if (env.STAFF_ACCESS_ONLY === 'true') return null;
  const token = sessionToken(request);
  if (!token) return null;
  try {
    const row = await env.DB.prepare('SELECT s.email, u.name FROM staff_sessions s JOIN staff_users u ON u.email = s.email WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1')
      .bind(await tokenHash(token), Date.now()).first();
    return row ? { email: row.email, name: row.name, via: 'session' } : null;
  } catch { return null; }
}

export async function staffAuth(request, env) {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const identity = await staffIdentity(request, env);
    return identity ? json({ staff: identity }) : json({ error: 'Staff sign-in required.' }, 401);
  }
  if (request.method === 'DELETE') {
    const token = sessionToken(request);
    if (token) await env.DB.prepare('DELETE FROM staff_sessions WHERE token_hash = ?').bind(await tokenHash(token)).run().catch(() => {});
    return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0` });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (request.headers.get('origin') !== url.origin) return json({ error: 'Invalid request origin.' }, 403);
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json({ error: 'Expected JSON.' }, 415);
  if (!env.STAFF_LIMITER) return json({ error: 'Staff sign-in is not configured.' }, 503);
  const limit = await env.STAFF_LIMITER.limit({ key: request.headers.get('cf-connecting-ip') || 'unknown' });
  if (!limit.success) return json({ error: 'Too many attempts. Try again later.' }, 429);
  let body;
  try { body = JSON.parse(await readLimited(request, 2048)); } catch { return json({ error: 'Invalid request.' }, 400); }
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || email.length > 254 || !password || password.length > 128) return json({ error: 'Enter your staff email and password.' }, 400);
  let user;
  try { user = await env.DB.prepare('SELECT email, name, password_hash FROM staff_users WHERE email = ? AND active = 1').bind(email).first(); } catch { return json({ error: 'Sign-in is unavailable.' }, 503); }
  const matched = await passwordMatches(password, user?.password_hash || `00000000000000000000000000000000:${'0'.repeat(64)}`);
  if (!user || !matched) return json({ error: 'Email or password is incorrect.' }, 401);
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('DELETE FROM staff_sessions WHERE expires_at < ?').bind(Date.now()).run().catch(() => {});
  await env.DB.prepare('INSERT INTO staff_sessions (token_hash, email, expires_at) VALUES (?, ?, ?)').bind(await tokenHash(token), user.email, Date.now() + SESSION_MS).run();
  return json({ staff: { email: user.email, name: user.name, via: 'session' } }, 200, { 'set-cookie': `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}` });
}
