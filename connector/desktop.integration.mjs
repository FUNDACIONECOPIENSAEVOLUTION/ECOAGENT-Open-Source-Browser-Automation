import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {fileURLToPath} from 'node:url';
const client=new Client({name:'ecoagent-desktop-test',version:'1.0.0'});
try{
 await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./desktop.mjs',import.meta.url))]}));
 const tools=(await client.listTools()).tools;assert.equal(tools.length,3);assert.ok(tools.some(t=>t.name==='ecoagent_discover'));
 const h=await client.callTool({name:'ecoagent_local_health',arguments:{}});assert.equal(JSON.parse(h.content[0].text).ok,true);
 const d=await client.callTool({name:'ecoagent_local_read',arguments:{url:'https://invalid.example/'}});assert.equal(d.isError,true);
 const denied=await client.callTool({name:'ecoagent_discover',arguments:{urls:['https://example.org/','https://invalid.example/']}});assert.equal(denied.isError,true);
 if(process.argv.includes('--live')){const r=await client.callTool({name:'ecoagent_local_read',arguments:{url:'https://example.org/'}},undefined,{timeout:45000});assert.equal(r.isError??false,false);const p=JSON.parse(r.content[0].text);assert.equal(new URL(p.url).origin,'https://example.org');assert.ok(p.title&&p.text.length>40);console.log('DESKTOP LIVE READ OK: '+p.title)}
 console.log('DESKTOP STDIO MCP OK');
}finally{await client.close()}
