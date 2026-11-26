import test from 'node:test';import assert from 'node:assert/strict';import {validateJob} from '../bridge-protocol.mjs';
test('inspeccion válida',()=>assert.equal(validateJob({origin:'https://example.org',steps:[{op:'inspect'}]}).steps.length,1));
test('origen exacto',()=>assert.throws(()=>validateJob({origin:'https://example.org/a',steps:[{op:'inspect'}]})));
test('sin eval',()=>assert.throws(()=>validateJob({origin:'https://example.org',steps:[{op:'eval'}]})));
test('etiqueta requerida',()=>assert.throws(()=>validateJob({origin:'https://example.org',steps:[{op:'click'}]})));
