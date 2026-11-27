import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createControl} from './manual-control.mjs';
test('only local takeover changes mode and AI is blocked',()=>{const c=createControl();assert.throws(()=>c.take());c.request('s');c.assertAI();assert.equal(c.take().mode,'human');assert.throws(()=>c.assertAI());assert.equal(c.assertHuman(),'s');c.release();c.assertAI();assert.throws(()=>c.assertHuman())});

test('closing only the matching session releases human mode or pending takeover',()=>{const c=createControl();c.request('a');c.take();c.sessionClosed('other');assert.equal(c.status().mode,'human');c.sessionClosed('a');c.assertAI();assert.equal(c.status().session,null);c.request('b');c.sessionClosed('b');assert.equal(c.status().requested,false);assert.throws(()=>c.take())});
