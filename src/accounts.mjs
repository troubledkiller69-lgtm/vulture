import { readLimited } from './request-body.mjs';
import { customerSession, tokenHash } from './customer-session.mjs';

const json = (body, status=200, headers={}) => Response.json(body,{status,headers:{'cache-control':'no-store',...headers}});
const hex = bytes => [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
const saltBytes = hexValue => Uint8Array.from(hexValue.match(/../g),x=>parseInt(x,16));
const iterations = 100000; // Workers PBKDF2 rejects iteration counts above 100,000.
async function derive(password, salt, rounds) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' }, key, 256);
  return new Uint8Array(bits);
}
export async function passwordHash(password, salt=hex(crypto.getRandomValues(new Uint8Array(16)))) {
  // PBKDF2 is native in Workers, so hashing does not consume the CPU budget like a JS scrypt would.
  return `pbkdf2$${iterations}$${salt}$${hex(await derive(password,saltBytes(salt),iterations))}`;
}
function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a[index] ^ b[index];
  return diff === 0;
}
export async function passwordMatches(password, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts.length !== 4 || parts[0] !== 'pbkdf2' || !/^[1-9][0-9]{0,6}$/.test(parts[1]) || Number(parts[1]) > 100000 || !/^[a-f0-9]{32}$/.test(parts[2]) || !/^[a-f0-9]{64}$/.test(parts[3])) return false;
  const candidate = await derive(password, saltBytes(parts[2]), Number(parts[1]));
  return sameBytes(new TextEncoder().encode(hex(candidate)), new TextEncoder().encode(parts[3]));
}
const cookie = token => `__Host-vulture_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;

export async function accounts(request,env) {
  const url=new URL(request.url);
  if(url.pathname==='/api/account/me' && request.method==='GET') {
    const user=await customerSession(request,env.DB);
    return user?json({customer:user}):json({error:'Sign in required.'},401);
  }
  if(request.method!=='POST') return json({error:'Method not allowed.'},405);
  if(request.headers.get('origin')!==url.origin) return json({error:'Invalid origin.'},403);
  if(url.pathname==='/api/account/signout') {
    const raw=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-vulture_session='))?.split('=')[1];
    if(raw && /^[a-f0-9]{64}$/.test(raw)) await env.DB.prepare('DELETE FROM customer_sessions WHERE token_hash = ?').bind(await tokenHash(raw)).run();
    return json({ok:true},200,{'set-cookie':'__Host-vulture_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'});
  }
  if(!['/api/account/signup','/api/account/signin'].includes(url.pathname)) return json({error:'Not found.'},404);
  // Scrypt requires the paid Worker CPU budget. Require configured rate limiting before opening accounts.
  if(env.ACCOUNTS_ENABLED!=='true'||!env.AUTH_LIMITER) return json({error:'Account registration is not open yet.'},503);
  const limit=await env.AUTH_LIMITER.limit({key:request.headers.get('cf-connecting-ip')||'unknown'});
  if(!limit.success) return json({error:'Too many attempts. Try again later.'},429);
  if(!(request.headers.get('content-type')||'').startsWith('application/json')) return json({error:'Expected JSON.'},415);
  let body;
  try { body=JSON.parse(await readLimited(request,4096)); } catch {return json({error:'Invalid request.'},400);}
  const email=typeof body?.email==='string'?body.email.trim().toLowerCase():'';
  const password=body?.password;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<12||password.length>128) return json({error:'Enter a valid email and a password of 12 to 128 characters.'},400);
  const token=hex(crypto.getRandomValues(new Uint8Array(32)));
  const session=env.DB.prepare('INSERT INTO customer_sessions (token_hash,customer_id,expires_at) VALUES (?,?,?)');
  if(url.pathname.endsWith('/signup')) {
    const name=typeof body.name==='string'?body.name.trim():'';
    if(!name||name.length>80) return json({error:'Enter your name (up to 80 characters).'},400);
    const id=crypto.randomUUID();
    const hash=await passwordHash(password);
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO customers (id,email,name,password_hash) VALUES (?,?,?,?)').bind(id,email,name,hash),
        session.bind(await tokenHash(token),id,Date.now()+604800000)
      ]);
    } catch {return json({error:'Unable to create account. If you already registered, sign in.'},409);}
    return json({customer:{id,email,name}},201,{'set-cookie':cookie(token)});
  }
  const user=await env.DB.prepare('SELECT id,email,name,password_hash FROM customers WHERE email = ?').bind(email).first();
  // Run the same KDF for missing users to reduce email enumeration by timing.
  const matched=await passwordMatches(password,user?.password_hash||`${'0'.repeat(32)}:${'0'.repeat(64)}`);
  if(!user||!matched) return json({error:'Email or password is incorrect.'},401);
  await session.bind(await tokenHash(token),user.id,Date.now()+604800000).run();
  return json({customer:{id:user.id,email:user.email,name:user.name}},200,{'set-cookie':cookie(token)});
}
