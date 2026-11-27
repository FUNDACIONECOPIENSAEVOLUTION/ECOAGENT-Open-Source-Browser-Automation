import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,openSync,closeSync,fsyncSync} from 'node:fs';
import {join} from 'node:path';
export function storeReceipt({entry,url,bytes,mime,directory,demo=false}){
 const type=String(mime||'').split(';')[0].trim().toLowerCase();
 const ext={'application/pdf':'pdf','text/plain':'txt'}[type];
 if(!ext||!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>10*1024*1024)throw Error('Unsupported receipt');
 if(ext==='pdf'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Invalid PDF signature');
 const id=randomUUID(),sha256=createHash('sha256').update(bytes).digest('hex'),name=id+'.'+ext;
 const meta={id,submission:entry.id,source:url,name,size:bytes.length,sha256,mimeType:type,demo,downloaded:true,confirmed:false,submitted:false};
 if(!demo){
  if(!directory)throw Error('Receipt storage missing');mkdirSync(directory,{recursive:true,mode:0o700});
  for(const [file,data] of [[name,bytes],[id+'.json',JSON.stringify(meta)]]){
   const fd=openSync(join(directory,file),'wx',0o600);try{writeFileSync(fd,data);fsyncSync(fd)}finally{closeSync(fd)}
  }
 }
 return meta;
}
