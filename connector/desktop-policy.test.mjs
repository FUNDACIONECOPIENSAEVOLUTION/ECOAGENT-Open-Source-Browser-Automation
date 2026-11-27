import test from 'node:test';
import assert from 'node:assert/strict';
import {readURL,requestAllowed,cleanLinks,origins} from './desktop-policy.mjs';
test('approved institutional origins',()=>{for(const origin of origins)assert.equal(readURL(origin+'/').origin,origin)});
test('reject arbitrary hosts and credential-bearing URLs',()=>{for(const u of ['http://www.grants.gov','https://localhost','https://127.0.0.1','https://www.grants.gov.evil.test','https://user@www.grants.gov','https://www.grants.gov/?a=b','https://www.grants.gov/#a','file:///C:/Windows'])assert.throws(()=>readURL(u))});
test('network requests restricted to same origin and read methods',()=>{assert.equal(requestAllowed('https://www.grants.gov/a?x=1','https://www.grants.gov','GET'),true);assert.equal(requestAllowed('https://example.org/','https://www.grants.gov','GET'),false);assert.equal(requestAllowed('https://www.grants.gov/','https://www.grants.gov','POST'),false)});
test('links filtered, deduplicated and capped',()=>{const origin='https://www.grants.gov';assert.deepEqual(cleanLinks([{url:origin+'/a',label:' A '},{url:origin+'/a',label:'duplicate'},{url:'https://example.org/'},{url:origin+'/?token=x'}],origin),[{url:origin+'/a',label:'A'}]);assert.equal(cleanLinks(Array.from({length:100},(_,i)=>({url:origin+'/'+i})),origin).length,80)});
