import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerSession, tokenHash } from '../src/customer-session.mjs';
import { customerTickets } from '../src/tickets.mjs';
test('anonymous and malformed session cookies are rejected without querying D1', async () => {
  for (const cookie of ['', '__Host-vulture_session=bad', '__Host-vulture_session='+'a'.repeat(64)+'; __Host-vulture_session='+'b'.repeat(64)]) {
    assert.equal(await customerSession(new Request('https://example.test', { headers: { cookie } }), {}), null);
  }
  assert.equal((await customerTickets(new Request('https://example.test/api/tickets'), {})).status,401);
});
test('session tokens are hashed and never used as plain database identifiers',async()=>{
  assert.match(await tokenHash('test'),/^[a-f0-9]{64}$/);
});
test('ticket ownership is checked before messages are read',async()=>{
  const sql=[];
  const db={prepare(query){sql.push(query);return {bind(...args){return {first:async()=>query.startsWith('SELECT c.id')?{id:'customer-a'}:null}}}}};
  const req=new Request('https://example.test/api/tickets/11111111-1111-1111-1111-111111111111',{headers:{cookie:'__Host-vulture_session='+'a'.repeat(64)}});
  assert.equal((await customerTickets(req,{DB:db})).status,404);
  assert.match(sql[1],/customer_id = \?/);
  assert.equal(sql.length,2);
});
