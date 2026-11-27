// Explicit trusted public origins. No arbitrary URLs, credentials or private hosts.
export const origins=Object.freeze(['https://example.org','https://www.grants.gov','https://www.globalgiving.org','https://www.ungm.org','https://www.minciencias.gov.co','https://minciencias.gov.co','https://www.undp.org']);
export function readURL(raw){
 const u=new URL(raw);
 if(u.protocol!=='https:'||!origins.includes(u.origin)||u.username||u.password||u.search||u.hash)throw Error('URL not allowed: use an approved HTTPS origin without query or fragment');
 return u;
}
export function requestAllowed(raw,origin,method){try{const u=new URL(raw);return u.origin===origin&&!u.username&&!u.password&&['GET','HEAD'].includes(method)}catch{return false}}
export function cleanLinks(items,origin){const seen=new Set();return items.flatMap(x=>{try{const u=readURL(x.url);if(u.origin!==origin||seen.has(u.href))return [];seen.add(u.href);return [{url:u.href,label:String(x.label||'').trim().slice(0,180)}]}catch{return []}}).slice(0,80)}
