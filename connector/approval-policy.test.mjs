import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApprovals,actionDigest} from './approval-policy.mjs';
const args={session:'session-A',action:'demo-attach',description:'Attach built-in synthetic test document',digest:actionDigest('session-A','demo-attach')};
test('pending approval cannot authorize action',()=>{const a=createApprovals();const r=a.request(args);assert.throws(()=>a.consume(r.id,args));});
test('explicit decision binds session and action and is single-use',()=>{const a=createApprovals();const r=a.request(args);a.decide(r.id,true);assert.throws(()=>a.consume(r.id,{...args,session:'session-B'}));assert.throws(()=>a.consume(r.id,{...args,digest:'a'.repeat(64)}));assert.ok(a.consume(r.id,args));assert.throws(()=>a.consume(r.id,args));});
test('denied and expired decisions cannot be used',()=>{let now=0;const a=createApprovals({clock:()=>now,ttl:10});const r=a.request(args);a.decide(r.id,false);assert.throws(()=>a.consume(r.id,args));const s=a.request(args);a.decide(s.id,true);now=10;assert.throws(()=>a.consume(s.id,args));});
test('bounded queue and session cleanup',()=>{const a=createApprovals({limit:1});a.request(args);assert.throws(()=>a.request(args));a.clear(args.session);assert.equal(a.list().length,0);assert.throws(()=>a.request({...args,action:'external-submit'}));});
