import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, staffApi } from '../src/staff-api.mjs';

test('staff endpoint denies requests with no Access configuration', async () => {
  const request = new Request('https://example.test/api/staff/orders');
  assert.equal(await authenticate(request, {}), null);
  assert.equal((await staffApi(request, {})).status, 403);
});
test('staff endpoint rejects untrusted team domains and forged tokens', async () => {
  const request = new Request('https://example.test/api/staff/orders', { headers: { 'cf-access-jwt-assertion': 'not.a.valid.token' } });
  assert.equal(await authenticate(request, { ACCESS_TEAM_DOMAIN: 'evil.example', ACCESS_AUD: 'aud' }), null);
  assert.equal(await authenticate(request, { ACCESS_TEAM_DOMAIN: 'example.cloudflareaccess.com', ACCESS_AUD: 'aud' }), null);
});
