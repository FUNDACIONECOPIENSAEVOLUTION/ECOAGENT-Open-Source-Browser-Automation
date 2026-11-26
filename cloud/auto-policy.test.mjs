import test from 'node:test';import assert from 'node:assert/strict';import {automatic,safeReadURL} from './auto-policy.mjs';
test('auto disabled by default',()=>assert.equal(automatic({steps:[{op:'open'},{op:'read'}]},false),false));
test('public read batch',()=>assert.equal(automatic({steps:[{op:'open'},{op:'read'}]},true),true));
test('deny mutation and existing session',()=>{for(const op of ['click','fill','find','inspect'])assert.equal(automatic({steps:[{op:'open'},{op}]},true),false);assert.equal(automatic({steps:[{op:'read'}]},true),false)});
test('strip query and fragment',()=>assert.equal(safeReadURL('https://example.org/a?x=1#b'),'https://example.org/a'));
