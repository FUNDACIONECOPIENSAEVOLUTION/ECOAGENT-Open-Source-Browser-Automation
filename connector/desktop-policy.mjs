// Explicit trusted public origins. No arbitrary URLs, credentials or private hosts.
export const origins=Object.freeze(['https://example.org','https://www.grants.gov','https://www.globalgiving.org','https://www.ungm.org','https://www.minciencias.gov.co','https://minciencias.gov.co','https://www.undp.org']);
export function readURL(raw){
 const u=new URL(raw);
 if(u.protocol!=='https:'||!origins.includes(u.origin)||u.username||u.password||u.search||u.hash)throw Error('URL not allowed: use an approved HTTPS origin without query or fragment');
 return u;
}
export function requestAllowed(raw,origin,method){try{const u=new URL(raw);return u.origin===origin&&!u.username&&!u.password&&['GET','HEAD'].includes(method)}catch{return false}}
// Bounded same-origin read redirects only.
export function safeReadRedirect(location,current,origin,status,method){
 if(![301,302,303,307,308].includes(status)||!['GET','HEAD'].includes(method)||typeof location!=='string'||!location.trim())return null;
 try{const u=readURL(new URL(location,current).href);return u.origin===origin?u.href:null}catch{return null}
}
export function cleanLinks(items,origin){const seen=new Set();return items.flatMap(x=>{try{const u=readURL(x.url);if(u.origin!==origin||seen.has(u.href))return [];seen.add(u.href);return [{url:u.href,label:String(x.label||'').trim().slice(0,180)}]}catch{return []}}).slice(0,80)}

export function pageOutcome(status){return status===401||status===403?'access_denied':status===429?'rate_limited':status>=400?'http_error':status>=200&&status<300?'ok':'unknown'}
export function cleanFields(items){return items.slice(0,80).map(x=>({tag:String(x.tag||'').slice(0,20),type:String(x.type||'').slice(0,30),label:String(x.label||'').trim().slice(0,160),required:!!x.required,disabled:!!x.disabled})).filter(x=>['input','textarea','select','button'].includes(x.tag)&&!['hidden','password','file'].includes(x.type))}
