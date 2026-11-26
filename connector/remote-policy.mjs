import {timingSafeEqual} from 'node:crypto';
export function authorized(header,key){
 if(typeof header!=='string'||typeof key!=='string'||key.length<32)return false;
 const a=Buffer.from(header),b=Buffer.from('Bearer '+key);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export function originAllowed(origin){return origin===undefined;}
