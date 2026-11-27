import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentVault,maxDocumentBytes} from './document-vault.mjs';
test('file metadata excludes bytes; exact hash and contents preserved',()=>{const v=createDocumentVault();const b=Buffer.from('document');const d=v.add('proposal.pdf',b);assert.equal(d.size,b.length);assert.equal(d.buffer,undefined);assert.deepEqual(v.get(d.id).buffer,b);assert.equal(v.list()[0].sha256,d.sha256);assert.ok(v.remove(d.id));assert.throws(()=>v.get(d.id))});
test('reject traversal, executable, empty and oversized files',()=>{const v=createDocumentVault();for(const n of ['../a.pdf','a\\b.pdf','a.exe','a.html'])assert.throws(()=>v.add(n,Buffer.from('a')));assert.throws(()=>v.add('a.pdf',Buffer.alloc(0)));assert.throws(()=>v.add('a.pdf',Buffer.alloc(maxDocumentBytes+1)))});
test('capacity and expiration',()=>{let now=0;const v=createDocumentVault({clock:()=>now,ttl:10,limit:1});const d=v.add('a.docx',Buffer.from('a'));assert.throws(()=>v.add('b.pdf',Buffer.from('b')));now=10;assert.throws(()=>v.get(d.id));assert.equal(v.list().length,0)});
test('long document survives byte-exact storage',()=>{const v=createDocumentVault();const b=Buffer.alloc(20*1024*1024,65);const d=v.add('long.txt',b);assert.equal(d.size,20*1024*1024);assert.deepEqual(v.get(d.id).buffer,b)});
