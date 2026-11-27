import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApprovals} from './approval-policy.mjs';
import {createDocumentVault} from './document-vault.mjs';
import {startApprovalUI} from './approval-ui.mjs';
test('loopback document ingestion and explicit approval boundaries',async()=>{
 const approvals=createApprovals(),vault=createDocumentVault();
 const ui=await startApprovalUI(approvals,{port:0,vault});
 try{
  const origin=new URL(ui.url).origin;
  const headers={Origin:origin,'Content-Type':'application/octet-stream','X-Document-Name':'proposal.txt'};
  const bytes=Buffer.from('Synthetic institutional proposal');
  assert.equal((await fetch(ui.url+'/documents/add',{method:'POST',headers:{...headers,Origin:'https://example.org'},body:bytes})).status,403);
  assert.equal((await fetch(origin+'/documents')).status,404);
  const r=await fetch(ui.url+'/documents/add',{method:'POST',headers,body:bytes});assert.equal(r.status,200);
  const d=await r.json();assert.equal(d.size,bytes.length);assert.deepEqual(vault.get(d.id).buffer,bytes);assert.equal(d.buffer,undefined);
  const request={session:'test',action:'document-attach',description:'Attach synthetic proposal',digest:d.sha256};
  const a=approvals.request(request);
  assert.throws(()=>approvals.consume(a.id,request));
  const decide={method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id:a.id,allow:true})};
  assert.equal((await fetch(ui.url+'/decide',{...decide,headers:{...decide.headers,Origin:'https://example.org'}})).status,403);
  assert.equal((await fetch(ui.url+'/decide',decide)).status,200);
  assert.ok(approvals.consume(a.id,request));assert.throws(()=>approvals.consume(a.id,request));
  assert.equal((await fetch(ui.url+'/documents/remove',{...decide,body:JSON.stringify({id:d.id})})).status,200);
  assert.equal(vault.list().length,0);
 }finally{await ui.close()}
});
