import test from 'node:test';
import assert from 'node:assert/strict';
import {discover,validateDiscovery} from './desktop-discovery.mjs';
test('discovery deduplicates and rejects whole invalid batch before reading',async()=>{assert.deepEqual(validateDiscovery(['https://example.org','https://example.org/']),['https://example.org/']);let count=0;await assert.rejects(discover(['https://example.org/','https://localhost/'],async()=>{count++}));assert.equal(count,0)});
test('discovery bounds batch and output',async()=>{assert.throws(()=>validateDiscovery(Array(6).fill('https://example.org/')));const r=await discover(['https://example.org/'],async()=>({status:200,outcome:'ok',text:'a'.repeat(5000),links:Array(40).fill({url:'https://example.org/'})}));assert.equal(r.results[0].text.length,3000);assert.equal(r.results[0].links.length,25);assert.equal(r.complete,true)});
test('discovery stops on rate limit',async()=>{let count=0;const r=await discover(['https://example.org/','https://www.undp.org/'],async()=>{count++;return {status:429,outcome:'rate_limited'}});assert.equal(count,1);assert.equal(r.complete,false)});
test('discovery stops on browser failure',async()=>{const r=await discover(['https://example.org/','https://www.undp.org/'],async()=>{throw Error('failure')});assert.equal(r.results[0].outcome,'read_failed');assert.equal(r.complete,false)});
