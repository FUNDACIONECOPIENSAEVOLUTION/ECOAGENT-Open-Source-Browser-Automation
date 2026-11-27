import {readURL} from './desktop-policy.mjs';
// Bounded anonymous public discovery. Denial is a handoff, never a retry or bypass.
export function validateDiscovery(urls){
 if(!Array.isArray(urls)||urls.length<1||urls.length>5)throw Error('Provide 1–5 approved URLs');
 return [...new Set(urls.map(u=>readURL(u).href))];
}
export async function discover(urls,read){
 const requested=validateDiscovery(urls),results=[],denied=new Set();
 let stopReason=null;
 for(const url of requested){
  const origin=new URL(url).origin;
  if(denied.has(origin)){results.push({url,status:null,outcome:'skipped_access_denied',nextAction:'human_review'});continue}
  try{
   const p=await read(url);
   if(p.status===401||p.status===403||p.outcome==='access_denied'){
    denied.add(origin);results.push({url,status:p.status??null,outcome:'access_denied',nextAction:'human_review',title:'',text:'',links:[],fields:[]});continue;
   }
   if(p.status===429||p.outcome==='rate_limited'){
    results.push({url,status:p.status??null,outcome:'rate_limited',nextAction:'wait_for_provider'});stopReason='rate_limited';break;
   }
   results.push({url,status:p.status??null,outcome:p.outcome??'unknown',title:p.title??'',text:String(p.text??'').slice(0,3000),links:(p.links??[]).slice(0,25),fields:(p.fields??[]).slice(0,25)});
  }catch{results.push({url,outcome:'read_failed',nextAction:'inspect_connection'});stopReason='read_failed';break}
 }
 return {results,complete:results.length===requested.length,allAccessible:results.length===requested.length&&results.every(p=>p.outcome==='ok'),stopReason,manualReview:results.filter(p=>p.nextAction==='human_review').map(p=>p.url)};
}
