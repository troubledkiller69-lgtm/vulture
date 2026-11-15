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
  const env = { ORDERS_ENABLED: 'true', TURNSTILE_SECRET: 'test', DB: { prepare(sql) { if(sql.startsWith('SELECT c.id')) return {bind(){return {first:async()=>({id:'customer-id'})}}}; query = sql; return { bind(...args) { values = args; return { run: async () => ({ success: true }) }; } }; } } };
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: true, hostname: 'example.test', action: 'order' });
  try {
    const request = new Request('https://example.test/api/orders', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json', cookie: '__Host-vulture_session=' + 'a'.repeat(64) }, body: JSON.stringify({ ...valid, turnstileToken: 'test-token' }) });
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 201);
    assert.match(query, /VALUES \(\?, \?, \?, \?, \?, \?, \?, \?\)/);
    assert.equal(values[1], 'Example');
    assert.equal(values[4], 1200);
  } finally { globalThis.fetch = original; }
});
test('photos are stored privately and removed when the order insert fails', async () => {
  const calls = [];
  let failInsert = false;
  const env = {
    ORDERS_ENABLED: 'true', TURNSTILE_SECRET: 'test',
    PHOTOS: { put: async (key, bytes, options) => calls.push(['put', key, bytes.length, options.httpMetadata.contentType]), delete: async key => calls.push(['delete', key]) },
    DB: { prepare(sql) {
      if (sql.startsWith('SELECT c.id')) return { bind() { return { first: async () => ({ id: 'customer-id' }) }; } };
      return { bind(...values) { return { run: async () => { if (failInsert) throw new Error('insert failed'); return { success: true }; } }; } };
    } }
  };
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: true, hostname: 'example.test', action: 'order' });
  try {
    const body = JSON.stringify({ ...valid, turnstileToken: 'test-token', photo: 'data:image/png;base64,iVBORw0KGgo=' });
    const request = () => new Request('https://example.test/api/orders', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json', cookie: '__Host-vulture_session=' + 'a'.repeat(64) }, body });
    assert.equal((await worker.fetch(request(), env)).status, 201);
    assert.equal(calls[0][0], 'put');
    assert.match(calls[0][1], /^orders\/[0-9a-f-]{36}$/);
    assert.equal(calls[0][2], 8);
    assert.equal(calls[0][3], 'image/png');
    const id = calls[0][1].split('/')[1];
    failInsert = true;
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 503);
    assert.equal(calls.at(-1)[0], 'delete');
    assert.match(calls.at(-1)[1], /^orders\/[0-9a-f-]{36}$/);
    assert.notEqual(calls.at(-1)[1], `orders/${id}`);
  } finally { globalThis.fetch = original; }
});
test('turnstile rejects wrong host, action, and network failures', async () => {
  const reply = (data) => async () => Response.json(data);
  assert.equal(await verifyTurnstile('secret', 'token', 'example.test', reply({ success: true, hostname: 'other.test', action: 'order' })), false);
  assert.equal(await verifyTurnstile('secret', 'token', 'example.test', reply({ success: true, hostname: 'example.test', action: 'login' })), false);
  assert.equal(await verifyTurnstile('secret', 'token', 'example.test', async () => { throw new Error('offline'); }), false);
  assert.equal(await verifyTurnstile('secret', 'token', 'example.test', reply({ success: true, hostname: 'example.test', action: 'order' })), true);
});
