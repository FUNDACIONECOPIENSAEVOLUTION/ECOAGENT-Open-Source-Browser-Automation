import test from 'node:test';import assert from 'node:assert/strict';import {authorized,originAllowed} from './remote-policy.mjs';
test('require distinct bearer credential format',()=>{const k='a'.repeat(32);assert.equal(authorized('Bearer '+k,k),true);assert.equal(authorized(k,k),false);assert.equal(authorized('Bearer wrong',k),false);assert.equal(authorized('Bearer x','x'),false)});
test('deny browser origins',()=>{assert.equal(originAllowed(undefined),true);assert.equal(originAllowed('https://example.org'),false);assert.equal(originAllowed('null'),false)});
