import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const key=()=>randomBytes(32).toString('hex');
const clientKey=key(),connectorKey=key();
const id='12345678-1234-4234-8234-123456789abc';
const mock=http.createServer(async(req,res)=>{
 if(req.headers.authorization!=='Bearer '+clientKey){res.writeHead(401).end();return}
 let data;
 if(req.url==='/health')data={ok:true};
 else if(req.url==='/api/jobs'&&req.method==='POST'){let raw='';for await(const c of req)raw+=c;assert.deepEqual(JSON.parse(raw).steps.map(x=>x.op),['open','read','close']);data={id,status:'running'}}
 else if(req.url==='/api/jobs/'+id)data={id,status:'completed',result:{ok:true}};
 else{res.writeHead(404).end();return}
 res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(data));
});
mock.listen(0,'127.0.0.1');await once(mock,'listening');
const probe=http.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
const child=spawn(process.execPath,[new URL('./remote.mjs',import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/,'')],{env:{...process.env,ECOAGENT_API_URL:'http://127.0.0.1:'+mock.address().port,ECOAGENT_CLIENT_KEY:clientKey,ECOAGENT_CONNECTOR_KEY:connectorKey,CONNECTOR_PORT:String(port),CONNECTOR_BIND:'127.0.0.1'},stdio:'ignore'});
const base='http://127.0.0.1:'+port;
const client=new Client({name:'http-test',version:'1.0.0'});
try{
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(500)})).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
 assert.ok(ready,'Connector did not start');
 assert.equal((await fetch(base+'/mcp',{method:'POST'})).status,401);
 assert.equal((await fetch(base+'/mcp',{method:'POST',headers:{Origin:'https://example.org',Authorization:'Bearer '+connectorKey}})).status,403);
 await client.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+connectorKey}}}));
 assert.equal((await client.listTools()).tools.length,3);
 const h=await client.callTool({name:'ecoagent_health',arguments:{}});assert.equal(JSON.parse(h.content[0].text).ok,true);
 const read=await client.callTool({name:'ecoagent_read_public',arguments:{url:'https://example.org/'}});assert.equal(JSON.parse(read.content[0].text).id,id);
 const status=await client.callTool({name:'ecoagent_job_status',arguments:{id}});assert.equal(JSON.parse(status.content[0].text).status,'completed');
 console.log('HTTP MCP integration OK (mock backend)');
}finally{await client.close().catch(()=>{});child.kill();mock.closeAllConnections();await new Promise(r=>mock.close(r))}
