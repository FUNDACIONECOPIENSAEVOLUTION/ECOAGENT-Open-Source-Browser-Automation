import test from 'node:test';import assert from 'node:assert/strict';import {buildClient} from './client.mjs';
const key='x'.repeat(32);
test('reject unsafe API base',()=>assert.throws(()=>buildClient('http://example.org',key)));
test('reject URL with query or credentials',()=>{const c=buildClient('https://example.org',key);assert.throws(()=>c.read('https://example.org/?token=x'));assert.throws(()=>c.read('https://user:pass@example.org/'))});
test('submit only public read batch',async()=>{let req;const c=buildClient('https://example.org',key,async(u,o)=>{req={u:u.href,o};return {ok:true,json:async()=>({id:'test'})}});await c.read('https://example.org/');assert.deepEqual(JSON.parse(req.o.body).steps.map(x=>x.op),['open','read','close']);assert.equal(req.o.redirect,'error')});
test('reject invalid job id',()=>assert.throws(()=>buildClient('https://example.org',key).status('../health')));
