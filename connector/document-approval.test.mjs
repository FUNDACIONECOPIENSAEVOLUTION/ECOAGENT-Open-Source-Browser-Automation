import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApprovals} from './approval-policy.mjs';
test('document attachment approval is exact and single-use',()=>{
 const a=createApprovals();const x={session:'s',action:'document-attach',description:'Attach proposal.pdf to named field',digest:'a'.repeat(64)};
 const r=a.request(x);assert.throws(()=>a.consume(r.id,x));a.decide(r.id,true);
 assert.throws(()=>a.consume(r.id,{...x,digest:'b'.repeat(64)}));
 assert.ok(a.consume(r.id,x));assert.throws(()=>a.consume(r.id,x));
});
