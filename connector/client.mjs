export function buildClient(base,key,fetcher=fetch){
 const u=new URL(base);
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname))))throw Error('Use HTTPS or local loopback base URL');
 if(typeof key!=='string'||key.length<32)throw Error('Client key required');
 async function request(path,method='GET',body){
  const r=await fetcher(new URL(path,u),{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(20000),...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok)throw Error('ECOAGENT HTTP '+r.status);
  return r.json();
 }
 return {
  health:()=>request('/health'),
  read:(url)=>{const target=new URL(url);if(target.protocol!=='https:'||target.username||target.password||target.search||target.hash)throw Error('Public HTTPS URL without credentials, query or fragment required');return request('/api/jobs','POST',{steps:[{op:'open',url:target.href},{op:'read'},{op:'close'}]})},
  status:(id)=>{if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw Error('Invalid job id');return request('/api/jobs/'+id)}
 };
}
