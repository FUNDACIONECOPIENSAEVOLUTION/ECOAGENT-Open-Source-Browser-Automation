// Resource-server validation via a trusted external RFC 7662 authorization server.
export function oauthConfig(env){
 if(env.ECOAGENT_AUTH_MODE!=='oauth')return null;
 function https(v){const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('OAuth endpoints require HTTPS');return u.href}
 const resource=https(env.ECOAGENT_RESOURCE_URL),issuer=https(env.ECOAGENT_OAUTH_ISSUER),introspection=https(env.ECOAGENT_INTROSPECTION_URL);
 if(!resource.endsWith('/mcp'))throw Error('Resource must end in /mcp');
 const id=env.ECOAGENT_INTROSPECTION_ID,secret=env.ECOAGENT_INTROSPECTION_SECRET;
 if(!id||!secret)throw Error('Introspection credentials required');
 return {resource,issuer,introspection,id,secret,scope:'ecoagent.read'};
}
export function metadata(c){return {resource:c.resource,authorization_servers:[c.issuer],scopes_supported:[c.scope],bearer_methods_supported:['header']}}
export function accepts(data,c,now=Date.now()/1000){
 return data?.active===true&&data.iss===c.issuer&&Number.isFinite(data.exp)&&data.exp>now&&(!Number.isFinite(data.nbf)||data.nbf<=now)&&
 (Array.isArray(data.aud)?data.aud.includes(c.resource):data.aud===c.resource)&&typeof data.scope==='string'&&data.scope.split(/\s+/).includes(c.scope);
}
export async function verifyOAuth(header,c,fetcher=fetch){
 if(typeof header!=='string'||!/^Bearer [A-Za-z0-9._~+\/=-]{1,8192}$/.test(header))return false;
 try{
 const res=await fetcher(c.introspection,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(encodeURIComponent(c.id)+':'+encodeURIComponent(c.secret)).toString('base64')},body:new URLSearchParams({token:header.slice(7),token_type_hint:'access_token'})});
 return res.ok&&accepts(await res.json(),c);
 }catch{return false}
}
