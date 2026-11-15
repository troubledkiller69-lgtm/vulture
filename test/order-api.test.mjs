import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { validateOrder, verifyTurnstile } from '../src/order-api.mjs';

const valid = { restaurant: 'Example', details: 'A meal', contact: 'person@example.test', cartTotalCents: 1200, fulfillment: 'pickup' };
test('validates order fields and amounts', () => {
  assert.ok(validateOrder(valid));
  for (const value of [0, -1, 1.1, 1000001, '1200']) assert.equal(validateOrder({ ...valid, cartTotalCents: value }), null);
  assert.equal(validateOrder({ ...valid, contact: '  ' }), null);
  assert.equal(validateOrder({ ...valid, fulfillment: 'other' }), null);
});
test('intake is closed by default', async () => {
  const response = await worker.fetch(new Request('https://example.test/api/orders', { method: 'POST' }), {});
  assert.equal(response.status, 503);
});
test('requires same origin when intake is enabled', async () => {
  const response = await worker.fetch(new Request('https://example.test/api/orders', { method: 'POST', headers: { origin: 'https://other.test' } }), { ORDERS_ENABLED: 'true' });
  assert.equal(response.status, 403);
});
test('stores validated requests using bound parameters', async () => {
  let query, values;
  const env = { ORDERS_ENABLED: 'true', TURNSTILE_SECRET: 'test', DB: { prepare(sql) { query = sql; return { bind(...args) { values = args; return { run: async () => ({ success: true }) }; } }; } } };
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: true, hostname: 'example.test', action: 'order' });
  try {
    const request = new Request('https://example.test/api/orders', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: JSON.stringify({ ...valid, turnstileToken: 'test-token' }) });
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 201);
    assert.match(query, /VALUES \(\?, \?, \?, \?, \?, \?\)/);
    assert.equal(values[1], 'Example');
    assert.equal(values[4], 1200);
  } finally { globalThis.fetch = original; }
});
test('turnstile rejects wrong host, action, and network failures', async () => {
  const reply = (data) => async () => Response.json(data);
  assert.equal(await verifyTurnstile('secret', 'token', 'example.test', reply({ success: true, hostname: 'other.test', action: 'order' })), false);
  assert.equal(await verifyTurnstile('secret', 'token', 'example.test', reply({ success: true, hostname: 'example.test', action: 'login' })), false);
  assert.equal(await verifyTurnstile('secret', 'token', 'example.test', async () => { throw new Error('offline'); }), false);
  assert.equal(await verifyTurnstile('secret', 'token', 'example.test', reply({ success: true, hostname: 'example.test', action: 'order' })), true);
});
