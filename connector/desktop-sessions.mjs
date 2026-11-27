import {randomUUID} from 'node:crypto';
import {readURL,cleanLinks,cleanFields} from './desktop-policy.mjs';
// Ephemeral navigation snapshots, not persistent browser profiles.
export function createSessions(read,{now=Date.now,ttl=600000,max=4}={}){
 const sessions=new Map();
 function prune(){for(const [id,s] of sessions)if(s.expires<=now())sessions.delete(id)}
 function lookup(id){prune();const s=sessions.get(id);if(!s)throw Error('Session expired or unknown');return s}
 async function snapshot(url){
  const u=readURL(url),p=await read(u.href),final=readURL(p.url);
  if(final.origin!==u.origin)throw Error('Origin changed');
  const links=p.status===200?cleanLinks(p.links??[],final.origin):[];
  return {snapshot:randomUUID(),url:final.href,status:p.status??null,outcome:p.outcome??'unknown',title:String(p.title??'').slice(0,500),text:String(p.text??'').slice(0,10000),links:links.map((x,i)=>({id:i+1,...x})),fields:p.status===200?cleanFields(p.fields??[]):[],truncated:!!p.truncated};
 }
 function view(id,s){return {session:id,expiresAt:new Date(s.expires).toISOString(),...s.page}}
 return {
 async open(url){prune();if(sessions.size>=max)throw Error('Session limit');const page=await snapshot(url);const id=randomUUID(),s={page,expires:now()+ttl};sessions.set(id,s);return view(id,s)},
 inspect(id){const s=lookup(id);return view(id,s)},
 async follow(id,ref,linkId){const s=lookup(id);if(s.page.snapshot!==ref)throw Error('Stale snapshot');const link=s.page.links.find(l=>l.id===linkId);if(!link)throw Error('Unknown link');const page=await snapshot(link.url);s.page=page;s.expires=now()+ttl;return view(id,s)},
 close(id){prune();return {closed:sessions.delete(id)}}
 };
}
