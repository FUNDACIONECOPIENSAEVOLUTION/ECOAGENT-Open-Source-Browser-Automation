import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,openSync,closeSync,fsyncSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
export function createSubmissionLedger({limit=100,clock=Date.now,directory=null}={}){
 const records=new Map(),keys=new Set();
 const copy=x=>({...x});
 if(directory)mkdirSync(directory,{recursive:true,mode:0o700});
 function persistReservation(key,entry){
  if(!directory)return;
  const path=join(directory,key+'.json');
  const fd=openSync(path,'wx',0o600);
  try{writeFileSync(fd,JSON.stringify(entry));fsyncSync(fd)}finally{closeSync(fd)}
 }
 function persistResult(key,entry){
  if(!directory)return;
  const fd=openSync(join(directory,key+'.result.json'),'wx',0o600);
  try{writeFileSync(fd,JSON.stringify(entry));fsyncSync(fd)}finally{closeSync(fd)}
 }
 const recordKeys=new Map();
 return {
 reserve(plan){
  const key=createHash('sha256').update(JSON.stringify([plan.demo,plan.action,plan.digest])).digest('hex');
  if(keys.has(key)||(directory&&existsSync(join(directory,key+'.json'))))throw Error('Duplicate or uncertain submission; review before retry');
  if(records.size>=limit)throw Error('Submission ledger full; manual review required');
  const entry={id:randomUUID(),endpoint:plan.action,demo:plan.demo,createdAt:new Date(clock()).toISOString(),attempted:false,httpStatus:null,confirmed:false,submitted:false,requiresReceiptReview:true,state:'reserved'};
  if(!entry.demo)persistReservation(key,entry);
  keys.add(key);recordKeys.set(entry.id,key);records.set(entry.id,entry);return copy(entry);
 },
 record(id,{attempted,httpStatus}){
  const e=records.get(id);if(!e||e.state!=='reserved')throw Error('Invalid submission record');
  e.attempted=!!attempted;e.httpStatus=Number.isInteger(httpStatus)?httpStatus:null;
  e.state=!attempted?'not_observed':e.httpStatus===null?'uncertain':'response_received';
  if(!e.demo)persistResult(recordKeys.get(id),e);
  return copy(e);
 },
 list(){
  const all=new Map();
  if(directory)for(const name of readdirSync(directory).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).slice(0,10000)){
   try{const e=JSON.parse(readFileSync(join(directory,name),'utf8'));const resultPath=join(directory,name.replace(/\.json$/,'.result.json'));const r=existsSync(resultPath)?JSON.parse(readFileSync(resultPath,'utf8')):e;if(r.id!==e.id||r.endpoint!==e.endpoint)throw Error('Invalid record');all.set(e.id,{...r,confirmed:false,submitted:false});}catch{throw Error('Persistent submission history requires local review')}
  }
  for(const e of records.values())all.set(e.id,copy(e));return [...all.values()].slice(-100);
 }
 };
}
