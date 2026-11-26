import {readFile} from 'node:fs/promises';
import {oauthConfig} from '../connector/oauth-policy.mjs';
const c=oauthConfig(process.env);
if(!c)throw Error('Set ECOAGENT_AUTH_MODE=oauth');
const issuer=new URL(c.issuer);
const metadataUrl=new URL('/.well-known/oauth-authorization-server'+(issuer.pathname==='/'?'':issuer.pathname),issuer.origin);
const r=await fetch(metadataUrl,{redirect:'error',signal:AbortSignal.timeout(10000)});
if(!r.ok)throw Error('Authorization metadata unavailable: '+r.status);
const m=await r.json();
if(m.issuer!==c.issuer)throw Error('Issuer mismatch');
if(!m.code_challenge_methods_supported?.includes('S256'))throw Error('PKCE S256 not advertised');
if(m.introspection_endpoint!==c.introspection)throw Error('Introspection endpoint mismatch');
for(const k of ['authorization_endpoint','token_endpoint']){const u=new URL(m[k]);if(u.protocol!=='https:')throw Error('HTTPS required: '+k)}
console.log('OAuth provider metadata checks OK. No tokens or secrets printed. Actual authorization flow still requires testing.');
