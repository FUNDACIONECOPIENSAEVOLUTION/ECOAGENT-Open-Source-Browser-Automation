import {readURL} from './desktop-policy.mjs';
// Bounded public discovery only. No writes, arbitrary commands, or private sessions.
export function validateDiscovery(urls){
 if(!Array.isArray(urls)||urls.length<1||urls.length>5)throw Error('Provide 1–5 approved URLs');
 return [...new Set(urls.map(u=>readURL(u).href))];
}
export async function discover(urls,read){
 const results=[];
 for(const url of validateDiscovery(urls)){
  try{
   const p=await read(url);
   results.push({url,status:p.status??null,outcome:p.outcome??'unknown',title:p.title??'',text:String(p.text??'').slice(0,3000),links:(p.links??[]).slice(0,25),fields:(p.fields??[]).slice(0,25)});
   if(p.status===429)break;
  }catch{results.push({url,outcome:'read_failed'});break}
 }
 return {results,complete:results.length===validateDiscovery(urls).length};
}
