import test from 'node:test';import assert from 'node:assert/strict';import {validateControl} from '../manual-control.mjs';
test('manual click requires valid frame and coordinates',()=>{assert.throws(()=>validateControl({op:'click',x:0.5,y:0.5}));assert.throws(()=>validateControl({op:'click',frame:'a',x:1,y:0}));assert.equal(validateControl({op:'click',frame:'a',x:.5,y:.5}).op,'click')});
test('reject arbitrary code and keys',()=>{assert.throws(()=>validateControl({op:'eval'}));assert.throws(()=>validateControl({op:'key',frame:'a',key:'Control+V'}))});
test('take and release',()=>{assert.deepEqual(validateControl({op:'take'}),{op:'take'});assert.deepEqual(validateControl({op:'release'}),{op:'release'})});
