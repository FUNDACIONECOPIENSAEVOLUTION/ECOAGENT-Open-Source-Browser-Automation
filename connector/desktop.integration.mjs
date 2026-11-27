import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {fileURLToPath} from 'node:url';
const browserEnv=Object.fromEntries(['PLAYWRIGHT_BROWSERS_PATH','ECOAGENT_TEST_DIAGNOSTICS'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const client=new Client({name:'ecoagent-desktop-test',version:'1.0.0'});
try{
 await client.connect(new StdioClientTransport({command:process.execPath,env:browserEnv,stderr:'inherit',args:[fileURLToPath(new URL('./desktop.mjs',import.meta.url))]}));
 const tools=(await client.listTools()).tools;assert.equal(tools.length,16);assert.ok(tools.some(t=>t.name==='ecoagent_discover'));
 const h=await client.callTool({name:'ecoagent_local_health',arguments:{}});assert.equal(JSON.parse(h.content[0].text).ok,true);
 const d=await client.callTool({name:'ecoagent_local_read',arguments:{url:'https://invalid.example/'}});assert.equal(d.isError,true);
 const denied=await client.callTool({name:'ecoagent_discover',arguments:{urls:['https://example.org/','https://invalid.example/']}});assert.equal(denied.isError,true);
 const invalidSession=await client.callTool({name:'ecoagent_inspect',arguments:{session:'00000000-0000-4000-8000-000000000000'}});assert.equal(invalidSession.isError,true);
 const invalidOpen=await client.callTool({name:'ecoagent_open',arguments:{url:'https://localhost/'}});assert.equal(invalidOpen.isError,true);
 const badLive=await client.callTool({name:'ecoagent_live_open',arguments:{url:'https://localhost/'}});assert.equal(badLive.isError,true);
 if(process.argv.includes('--fixture')){
  const call=async(name,args)=>{const r=await client.callTool({name,arguments:args},undefined,{timeout:45000});assert.equal(r.isError??false,false,name+': '+JSON.stringify(r.content));return JSON.parse(r.content[0].text)};
  let a=await call('ecoagent_live_demo',{});const field=a.elements.find(e=>e.label==='Project');assert.ok(field?.draft,JSON.stringify(a.elements));assert.ok(!a.elements.some(e=>e.type==='password'));
  a=await call('ecoagent_live_draft',{session:a.session,snapshot:a.snapshot,element:field.id,value:'Synthetic project'});
  const project=a.elements.find(e=>e.label==='Project');
  assert.equal((await call('ecoagent_live_verify',{session:a.session,snapshot:a.snapshot,element:project.id,value:'Synthetic project'})).matches,true);
  assert.equal((await call('ecoagent_live_verify',{session:a.session,snapshot:a.snapshot,element:project.id,value:'Wrong value'})).matches,false);
  const category=a.elements.find(e=>e.label==='Category');assert.ok(category?.draft,JSON.stringify(a.elements));
  a=await call('ecoagent_live_draft',{session:a.session,snapshot:a.snapshot,element:category.id,value:'Environment'});
  const selected=a.elements.find(e=>e.label==='Category');
  assert.equal((await call('ecoagent_live_verify',{session:a.session,snapshot:a.snapshot,element:selected.id,value:'Environment'})).matches,true);
  const review=await call('ecoagent_live_review',{session:a.session});assert.equal(review.ready,true,JSON.stringify(review));assert.equal(review.submitted,false);
  const capture=await client.callTool({name:'ecoagent_live_capture',arguments:{session:a.session}},undefined,{timeout:45000});assert.equal(capture.isError??false,false);assert.equal(capture.content[0].type,'image');assert.ok(Buffer.from(capture.content[0].data,'base64').length>100);
  await call('ecoagent_live_close',{session:a.session});console.log('OFFLINE LIVE FORM MCP OK');
 }
 if(process.argv.includes('--live')){const r=await client.callTool({name:'ecoagent_local_read',arguments:{url:'https://example.org/'}},undefined,{timeout:45000});assert.equal(r.isError??false,false);const p=JSON.parse(r.content[0].text);assert.equal(new URL(p.url).origin,'https://example.org');assert.ok(p.title&&p.text.length>40);console.log('DESKTOP LIVE READ OK: '+p.title)}
 console.log('DESKTOP STDIO MCP OK');
}finally{await client.close()}
