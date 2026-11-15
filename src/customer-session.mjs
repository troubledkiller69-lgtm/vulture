export async function tokenHash(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export async function customerSession(request, db) {
  const cookie = request.headers.get('cookie') || '';
  const matches = cookie.split(';').map(value => value.trim()).filter(value => value.startsWith('__Host-vulture_session='));
  if (matches.length !== 1) return null;
  const token = matches[0].slice('__Host-vulture_session='.length);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare('SELECT c.id, c.email, c.name FROM customer_sessions s JOIN customers c ON c.id = s.customer_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .bind(await tokenHash(token), Date.now()).first();
}
