import test from 'node:test';
import assert from 'node:assert/strict';
import {pageOutcome,cleanFields} from './desktop-policy.mjs';
test('HTTP failures remain explicit',()=>{assert.equal(pageOutcome(200),'ok');assert.equal(pageOutcome(403),'access_denied');assert.equal(pageOutcome(429),'rate_limited');assert.equal(pageOutcome(500),'http_error');assert.equal(pageOutcome(null),'unknown')});
test('field metadata never returns values, hidden, password or file inputs',()=>{assert.deepEqual(cleanFields([{tag:'input',type:'text',label:' Name ',value:'private',required:true},{tag:'input',type:'password',label:'Password'},{tag:'input',type:'hidden'},{tag:'input',type:'file'}]),[{tag:'input',type:'text',label:'Name',required:true,disabled:false}])});
