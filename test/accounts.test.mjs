import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accounts,passwordHash,passwordMatches } from '../src/accounts.mjs';
test('account creation is fail closed until rate limiting is configured',async()=>{
 const req=new Request('https://example.test/api/account/signup',{method:'POST',headers:{origin:'https://example.test'}});
 assert.equal((await accounts(req,{})).status,503);
});
test('passwords use salted PBKDF2 and reject incorrect passwords',async()=>{
 const hash=await passwordHash('a correct long password');
 assert.equal(await passwordMatches('a correct long password',hash),true);
 assert.equal(await passwordMatches('a different password',hash),false);
 assert.equal(await passwordMatches('password','invalid'),false);
});
