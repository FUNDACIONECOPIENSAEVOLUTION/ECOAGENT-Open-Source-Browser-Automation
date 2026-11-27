import {randomUUID,createHash} from 'node:crypto';
export function createSubmissionLedger({limit=100,clock=Date.now}={}){
 const records=new Map(),keys=new Set();
 const copy=x=>({...x});
 return {
 reserve(plan){
  const key=createHash('sha256').update(JSON.stringify([plan.demo,plan.action,plan.digest])).digest('hex');
  if(keys.has(key))throw Error('Duplicate or uncertain submission; review before retry');
  if(records.size>=limit)throw Error('Submission ledger full; manual review required');
  const entry={id:randomUUID(),endpoint:plan.action,demo:plan.demo,createdAt:new Date(clock()).toISOString(),attempted:false,httpStatus:null,confirmed:false,submitted:false,requiresReceiptReview:true,state:'reserved'};
  keys.add(key);records.set(entry.id,entry);return copy(entry);
 },
 record(id,{attempted,httpStatus}){
  const e=records.get(id);if(!e||e.state!=='reserved')throw Error('Invalid submission record');
  e.attempted=!!attempted;e.httpStatus=Number.isInteger(httpStatus)?httpStatus:null;
  e.state=!attempted?'not_observed':e.httpStatus===null?'uncertain':'response_received';
  return copy(e);
 },
 list(){return [...records.values()].map(copy)}
 };
}
