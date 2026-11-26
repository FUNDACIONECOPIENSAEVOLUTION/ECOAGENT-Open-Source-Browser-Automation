import test from 'node:test';import assert from 'node:assert/strict';import {accepts,verifyOAuth,metadata,oauthConfig} from './oauth-policy.mjs';
const c={resource:'https://app.example/mcp',issuer:'https://auth.example/',introspection:'https://auth.example/introspect',id:'client',secret:'secret',scope:'ecoagent.read'};
const good={active:true,iss:c.issuer,aud:c.resource,exp:200,scope:c.scope};
test('OAuth requires issuer audience expiry and scope',()=>{assert.equal(accepts(good,c,100),true);for(const patch of [{active:false},{iss:'wrong'},{aud:'wrong'},{exp:99},{scope:'other'},{nbf:101}])assert.equal(accepts({...good,...patch},c,100),false)});
test('OAuth metadata binds exact resource',()=>assert.equal(metadata(c).resource,c.resource));
test('OAuth disabled by default',()=>assert.equal(oauthConfig({}),null));
test('OAuth network failure denies',async()=>assert.equal(await verifyOAuth('Bearer abc',c,async()=>{throw Error('offline')}),false));
test('OAuth introspection uses fixed endpoint and denies redirect',async()=>{let called=false;const ok=await verifyOAuth('Bearer abc',c,async(url,opts)=>{called=true;assert.equal(url,c.introspection);assert.equal(opts.redirect,'error');return {ok:true,json:async()=>({...good,exp:Date.now()/1000+60})}});assert.equal(called,true);assert.equal(ok,true)});
