import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createControl} from './manual-control.mjs';
test('only local takeover changes mode and AI is blocked',()=>{const c=createControl();assert.throws(()=>c.take());c.request('s');c.assertAI();assert.equal(c.take().mode,'human');assert.throws(()=>c.assertAI());assert.equal(c.assertHuman(),'s');c.release();c.assertAI();assert.throws(()=>c.assertHuman())});
