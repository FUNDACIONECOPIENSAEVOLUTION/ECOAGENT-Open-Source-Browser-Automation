import assert from 'node:assert/strict';
import {createLive} from './desktop-live.mjs';
import {createApprovals} from './approval-policy.mjs';
import {createDocumentVault} from './document-vault.mjs';
import {startApprovalUI} from './approval-ui.mjs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const live=createLive(root),vault=createDocumentVault(),approvals=createApprovals();
const ui=await startApprovalUI(approvals,{port:0,vault});
let session;
try{
 const origin=new URL(ui.url).origin;
 const bytes=Buffer.alloc(20*1024*1024,65);
 const uploaded=await fetch(ui.url+'/documents/add',{method:'POST',headers:{Origin:origin,'Content-Type':'application/octet-stream','X-Document-Name':'long-proposal.txt'},body:bytes});
 assert.equal(uploaded.status,200);const doc=await uploaded.json();
 const page=await live.open('',true);session=page.session;
 const field=page.elements.find(e=>e.attachment&&e.label==='Sample document');assert.ok(field);
 const target=await live.attachmentTarget(session,page.snapshot,field.id);
 const digest=createHash('sha256').update(JSON.stringify([target,doc.id,doc.sha256])).digest('hex');
 const request={session,action:'document-attach',description:'Attach synthetic 20 MiB proposal',digest};
 const a=approvals.request(request);assert.throws(()=>approvals.consume(a.id,request));
 const decision=await fetch(ui.url+'/decide',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id:a.id,allow:true})});
 assert.equal(decision.status,200);assert.ok(approvals.consume(a.id,request));
 const d=vault.get(doc.id);
 try{const attached=await live.attachDocument(session,page.snapshot,field.id,d);assert.equal(attached.attached,true);assert.equal(attached.submitted,false);assert.equal(attached.size,bytes.length);assert.equal(attached.sha256,doc.sha256)}finally{d.buffer.fill(0)}
 assert.throws(()=>approvals.consume(a.id,request));
 assert.ok(vault.remove(doc.id));console.log('LOCAL DOCUMENT APPROVAL AND CHROMIUM 20 MIB ATTACHMENT OK');
}finally{if(session)await live.close(session).catch(()=>{});await ui.close()}
