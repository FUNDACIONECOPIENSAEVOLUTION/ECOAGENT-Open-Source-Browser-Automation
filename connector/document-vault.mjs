import {randomUUID,createHash} from 'node:crypto';
import {basename,extname} from 'node:path';
export const maxDocumentBytes=25*1024*1024;
const types={'.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.txt':'text/plain','.csv':'text/csv','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
export function createDocumentVault({clock=Date.now,ttl=900000,limit=4,maxTotal=50*1024*1024}={}){
 const docs=new Map();
 function expire(){for(const [id,d] of docs)if(clock()>=d.expires){d.buffer.fill(0);docs.delete(id)}}
 function metadata(d){const {buffer,...meta}=d;return meta}
 return {
 add(name,buffer){
  expire();
  if(typeof name!=='string'||name!==basename(name)||/[\\/\u0000-\u001f\u007f]/.test(name)||name.length>180||!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>maxDocumentBytes)throw Error('Invalid file name or size');
  const mimeType=types[extname(name).toLowerCase()];if(!mimeType)throw Error('File type not permitted');
  if(docs.size>=limit||[...docs.values()].reduce((n,d)=>n+d.size,0)+buffer.length>maxTotal)throw Error('Document vault full');
  const id=randomUUID();const d={id,name,mimeType,size:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex'),expires:clock()+ttl,buffer:Buffer.from(buffer)};
  docs.set(id,d);return metadata(d);
 },
 list(){expire();return [...docs.values()].map(metadata)},
 get(id){expire();const d=docs.get(id);if(!d)throw Error('Document missing or expired');return {...metadata(d),buffer:Buffer.from(d.buffer)}},
 remove(id){expire();const d=docs.get(id);if(!d)return false;d.buffer.fill(0);return docs.delete(id)}
 };
}
