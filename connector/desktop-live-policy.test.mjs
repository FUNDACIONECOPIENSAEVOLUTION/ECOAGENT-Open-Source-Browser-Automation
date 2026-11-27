import test from 'node:test';
import assert from 'node:assert/strict';
import {canDraft,validateDraft,findRef} from './desktop-live-policy.mjs';
test('draft limits and sensitive fields',()=>{const f={tag:'input',type:'text',label:'Project'};assert.equal(canDraft(f),true);assert.equal(validateDraft(f,'demo'),'demo');for(const x of [{...f,type:'password'},{...f,type:'file'},{...f,label:'API token'},{...f,label:'Passport'},{...f,disabled:true},{...f,readOnly:true},{tag:'button',type:'submit'}])assert.throws(()=>validateDraft(x,'demo'));assert.throws(()=>validateDraft(f,'a'.repeat(2001)))});
test('live references fail closed',()=>{const refs=new Map([['x',{id:1}]]);assert.equal(findRef('a','a',refs,'x').id,1);assert.throws(()=>findRef('old','new',refs,'x'));assert.throws(()=>findRef('a','a',refs,'missing'))});
