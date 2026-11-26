import test from 'node:test';import assert from 'node:assert/strict';import {parseOrigins,allowed,validate} from './policy.mjs';
const origins=parseOrigins('https://example.org');
test('allow only exact origin',()=>{assert.equal(allowed('https://example.org/a',origins),true);assert.equal(allowed('http://127.0.0.1',origins),false);assert.equal(allowed('https://example.org.evil.test',origins),false)});
test('deny arbitrary code',()=>assert.throws(()=>validate({op:'eval'},origins)));
test('require snapshot',()=>assert.throws(()=>validate({op:'click',id:0},origins)));
