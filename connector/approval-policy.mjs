import {randomUUID,createHash} from 'node:crypto';
export function createApprovals({clock=Date.now,ttl=120000,limit=8}={}){
 const items=new Map();
 const expire=()=>{for(const [id,a] of items)if(clock()>=a.expires)items.delete(id)};
 return {
 request({session,action,description,digest}){
  expire();
  if(items.size>=limit||!['demo-attach','demo-download','document-attach'].includes(action)||typeof session!=='string'||!session||typeof description!=='string'||description.length>300||!(/^[a-f0-9]{64}$/).test(digest))throw Error('Invalid approval request');
  const id=randomUUID();const a={id,session,action,description,digest,expires:clock()+ttl,state:'pending'};items.set(id,a);return {...a};
 },
 list(){expire();return [...items.values()].map(a=>({...a}))},
 decide(id,allow){expire();const a=items.get(id);if(!a||a.state!=='pending'||typeof allow!=='boolean')throw Error('Unknown or decided approval');a.state=allow?'approved':'denied';return {...a}},
 consume(id,{session,action,digest}){expire();const a=items.get(id);if(!a||a.state!=='approved'||a.session!==session||a.action!==action||a.digest!==digest)throw Error('Approval missing or mismatched');items.delete(id);return true},
 clear(session){for(const [id,a] of items)if(a.session===session)items.delete(id)}
 };
}
export const actionDigest=(session,action)=>createHash('sha256').update(JSON.stringify([session,action])).digest('hex');
