import test from 'node:test';import assert from 'node:assert/strict';import {validateBatch} from '../protocol.mjs';
test('lote válido',()=>assert.equal(validateBatch({steps:[{op:'open',url:'https://example.org'},{op:'inspect'}]}).length,2));
test('rechaza código arbitrario',()=>assert.throws(()=>validateBatch({steps:[{op:'eval',code:'x'}]})));
test('clic sin aprobación',()=>assert.throws(()=>validateBatch({steps:[{op:'click',id:'1:2'}]})));
test('límite de lote',()=>assert.throws(()=>validateBatch({steps:Array(21).fill({op:'inspect'})})));
test('referencia inválida',()=>assert.throws(()=>validateBatch({steps:[{op:'fill',id:'x',value:'a'}]})));
