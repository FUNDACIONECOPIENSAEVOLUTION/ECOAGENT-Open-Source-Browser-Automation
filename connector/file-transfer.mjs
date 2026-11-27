import {randomUUID,createHash} from 'node:crypto';
import {maxDocumentBytes} from './document-vault.mjs';
const allowed=/\.(pdf|docx|xlsx|pptx|txt|csv|png|jpg|jpeg|webp)$/i;
export function createFileTransfer(vault,{clock=Date.now,ttl=900000}={}){
 const pending=new Map();
 function clear(id){const t=pending.get(id);if(t){t.bytes.fill(0);pending.delete(id)}}
 function expire(){for(const [id,t] of pending)if(clock()>=t.expires)clear(id)}
 return {execute(a){
  expire();
  if(a.action==='begin'){
   if(typeof a.name!=='string'||a.name.length>180||!allowed.test(a.name)||/[\\/\u0000-\u001f\u007f]/.test(a.name)||!Number.isSafeInteger(a.size)||a.size<1||a.size>maxDocumentBytes||!/^[a-f0-9]{64}$/.test(a.sha256??''))throw Error('Invalid file metadata');
   if(pending.size>=2||[...pending.values()].reduce((n,t)=>n+t.size,0)+a.size>maxDocumentBytes)throw Error('Transfer capacity exceeded');
   const id=randomUUID();pending.set(id,{name:a.name,size:a.size,sha256:a.sha256,bytes:Buffer.alloc(a.size),offset:0,expires:clock()+ttl});return {transfer:id,nextOffset:0,maxChunkBytes:65536};
  }
  const t=pending.get(a.transfer);if(!t)throw Error('Transfer unavailable');
  if(a.action==='cancel'){clear(a.transfer);return {cancelled:true}}
  if(a.action==='append'){
   if(a.offset!==t.offset||typeof a.data!=='string'||a.data.length>87384||!a.data.length||! /^[A-Za-z0-9+/]+={0,2}$/.test(a.data))throw Error('Invalid chunk or offset');
   const b=Buffer.from(a.data,'base64');try{if(b.toString('base64')!==a.data||b.length>65536||t.offset+b.length>t.size)throw Error('Invalid chunk length or encoding');b.copy(t.bytes,t.offset);t.offset+=b.length;return {transfer:a.transfer,nextOffset:t.offset}}finally{b.fill(0)}
  }
  if(a.action==='finish'){
   if(t.offset!==t.size)throw Error('Incomplete file');
   try{if(createHash('sha256').update(t.bytes).digest('hex')!==t.sha256)throw Error('File integrity mismatch');return {document:vault.add(t.name,t.bytes),received:true,submitted:false}}finally{clear(a.transfer)}
  }
  throw Error('Unknown transfer action')
 }}
}
