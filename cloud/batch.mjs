import {validate,allowed} from './policy.mjs';
export function validateBatch(input,origins){
 if(!input||typeof input!=='object'||!Array.isArray(input.steps)||input.steps.length<1||input.steps.length>12)throw Error('Batch must contain 1–12 steps');
 const steps=input.steps.map(a=>{
  if(a?.op==='find'){if(typeof a.label!=='string'||!a.label.trim()||a.label.length>120||!['fill','click'].includes(a.action))throw Error('Invalid exact label');if(a.action==='fill'&&(typeof a.value!=='string'||a.value.length>4000))throw Error('Invalid value');return {op:'find',label:a.label,action:a.action,...(a.action==='fill'?{value:a.value}:{})}}
  validate(a,origins);return Object.fromEntries(Object.entries(a).filter(([k])=>['op','url','id','snapshot','value'].includes(k)));
 });
 if(JSON.stringify(steps).length>14000)throw Error('Batch too large');
 return {steps};
}
export async function executeBatch(batch,execute){
 const results=[];
 for(const a of batch.steps){try{
 let data;
 if(a.op==='find'){
  const s=await execute({op:'inspect'});const m=s.elements.filter(e=>e.label===a.label);
  if(m.length!==1)throw Error('Label absent or ambiguous');
  data=await execute({op:a.action,id:m[0].id,snapshot:s.snapshot,...(a.action==='fill'?{value:a.value}:{})});
 }else data=await execute(a);
 results.push({op:a.op,ok:true,data});
 }catch(e){results.push({op:a.op,ok:false,error:String(e.message).slice(0,150)});return {ok:false,results}}
 }
 return {ok:true,results};
}
