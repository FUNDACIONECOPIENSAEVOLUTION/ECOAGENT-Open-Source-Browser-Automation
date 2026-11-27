import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessions} from './desktop-sessions.mjs';
const origin='https://example.org';
const reader=async url=>({url,status:200,outcome:'ok',title:'Public fixture',text:'Public text',links:[{url:origin+'/next',label:'Next'},{url:'https://localhost/',label:'Blocked'}],fields:[{tag:'input',type:'text',label:'Name',value:'not returned'}]});
test('open inspect follow close with fresh reference',async()=>{const s=createSessions(reader);const a=await s.open(origin);assert.equal(a.links.length,1);assert.equal(a.fields[0].value,undefined);assert.deepEqual(s.inspect(a.session),a);const b=await s.follow(a.session,a.snapshot,1);assert.equal(b.url,origin+'/next');assert.notEqual(b.snapshot,a.snapshot);await assert.rejects(s.follow(a.session,a.snapshot,1));assert.equal(s.close(a.session).closed,true);assert.throws(()=>s.inspect(a.session))});
test('session expiry and bounded count',async()=>{let t=0;const s=createSessions(reader,{now:()=>t,ttl:100,max:1});const a=await s.open(origin);await assert.rejects(s.open(origin));t=101;assert.throws(()=>s.inspect(a.session));await s.open(origin)});
test('reject unapproved URLs before reader and reject invalid link',async()=>{let calls=0;const s=createSessions(async u=>{calls++;return reader(u)});await assert.rejects(s.open('https://localhost/'));assert.equal(calls,0);const a=await s.open(origin);await assert.rejects(s.follow(a.session,a.snapshot,99));assert.equal(calls,1)});
test('denied pages do not expose navigable references',async()=>{const s=createSessions(async url=>({...await reader(url),status:403,outcome:'access_denied'}));const a=await s.open(origin);assert.equal(a.links.length,0);assert.equal(a.fields.length,0);assert.equal(a.outcome,'access_denied')});
