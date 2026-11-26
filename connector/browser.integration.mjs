import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const key=()=>randomBytes(32).toString('hex');
const children=[];
async function freePort(){const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p}
const cloudPort=await freePort(),remotePort=await freePort();
assert.notEqual(cloudPort,remotePort);
const env={...process.env,ECOAGENT_OPERATOR_KEY:key(),ECOAGENT_CLIENT_KEY:key(),ECOAGENT_CONNECTOR_KEY:key(),ECOAGENT_CLOUD_BIND:'127.0.0.1',CONNECTOR_BIND:'127.0.0.1',PORT:String(cloudPort),CONNECTOR_PORT:String(remotePort),ECOAGENT_API_URL:'http://127.0.0.1:'+cloudPort,ECOAGENT_PUBLIC_READ_AUTO:'true',ECOAGENT_ALLOWED_ORIGINS:'https://example.org'};
const base='http://127.0.0.1:'+remotePort;
const client=new Client({name:'ecoagent-browser-integration',version:'1.0.0'});
function start(relative){const c=spawn(process.execPath,[fileURLToPath(new URL(relative,import.meta.url))],{env,stdio:['ignore','ignore','inherit']});children.push(c);c.on('error',e=>console.error('Child start error:',e.message));return c}
async function health(port){for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/health',{signal:AbortSignal.timeout(500)});if(r.ok)return await r.json()}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('Health timeout on '+port)}
function decode(r){assert.equal(r.isError??false,false,JSON.stringify(r));return JSON.parse(r.content[0].text)}
try{
 start('../cloud/app.mjs');start('./remote.mjs');
 assert.equal((await health(cloudPort)).publicReadAuto,true);await health(remotePort);
 assert.equal((await fetch(base+'/mcp',{method:'POST'})).status,401);
 await client.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+env.ECOAGENT_CONNECTOR_KEY}}}));
 const job=decode(await client.callTool({name:'ecoagent_read_public',arguments:{url:'https://example.org/'}}));
 assert.equal(job.status,'running');
 let status;
 for(let i=0;i<60;i++){
 status=decode(await client.callTool({name:'ecoagent_job_status',arguments:{id:job.id}}));
 if(['completed','failed','rejected'].includes(status.status))break;
 await new Promise(r=>setTimeout(r,1000))
 }
 assert.equal(status?.status,'completed',JSON.stringify(status));
 const read=status.result.results.find(x=>x.op==='read');
 assert.ok(read?.ok);assert.match(read.data.title,/Example Domain/i);assert.match(read.data.text,/Example Domain/i);
 console.log('REAL BROWSER MCP OK: '+read.data.title);
 console.log('Anonymous public read, no private session, no manual clicks.');
}finally{await client.close().catch(()=>{});for(const c of children)c.kill()}
