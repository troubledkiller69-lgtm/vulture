import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staffApi, updateStatus } from '../src/staff-api.mjs';
import { staffIdentity } from '../src/staff-auth.mjs';

test('staff sessions reject forged cookies before touching the database', async () => {
  let queried = false;
  const env = { DB: { prepare() { queried = true; return { bind() { return { first: async () => null }; } }; } } };
  for (const cookie of ['__Host-vulture_staff=short', '__Host-vulture_staff=' + 'a'.repeat(64) + '; __Host-vulture_staff=' + 'b'.repeat(64)]) {
    assert.equal(await staffIdentity(new Request('https://example.test/api/staff/orders', { headers: { cookie } }), env), null);
  }
  assert.equal(queried, false);
});

test('staff endpoint denies requests with no Access configuration or session', async () => {
  const request = new Request('https://example.test/api/staff/orders');
  assert.equal(await staffIdentity(request, {}), null);
  assert.equal((await staffApi(request, {})).status, 403);
});
test('status update and audit run in one batch with an ownership guard', async () => {
  const statements = [];
  const db = {
    prepare(sql) { return { bind(...values) { return { sql, values }; } }; },
    async batch(items) { statements.push(...items); return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }]; }
  };
  assert.equal(await updateStatus(db, 'order-id', 'staff@example.test', 'new', 'claimed'), true);
  assert.match(statements[0].sql, /assigned_staff IS NULL OR assigned_staff = \?/);
  assert.match(statements[1].sql, /changes\(\) = 1/);
  assert.equal(statements[0].values[4], 'staff@example.test');
});
test('staff endpoint rejects untrusted team domains and forged tokens', async () => {
  const request = new Request('https://example.test/api/staff/orders', { headers: { 'cf-access-jwt-assertion': 'not.a.valid.token' } });
  assert.equal(await staffIdentity(request, { ACCESS_TEAM_DOMAIN: 'evil.example', ACCESS_AUD: 'aud' }), null);
  assert.equal(await staffIdentity(request, { ACCESS_TEAM_DOMAIN: 'example.cloudflareaccess.com', ACCESS_AUD: 'aud' }), null);
});
