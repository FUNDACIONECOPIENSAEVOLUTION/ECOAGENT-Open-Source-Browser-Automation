import http from 'node:http';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {buildClient} from './client.mjs';
import {createServer} from './tools.mjs';
import {authorized,originAllowed} from './remote-policy.mjs';
const key=process.env.ECOAGENT_CONNECTOR_KEY||'',clientKey=process.env.ECOAGENT_CLIENT_KEY||'';
if(key.length<32||key===clientKey||key===process.env.ECOAGENT_OPERATOR_KEY)throw Error('Distinct connector secret required');
const client=buildClient(process.env.ECOAGENT_API_URL||'http://127.0.0.1:8080',clientKey);
const port=Number(process.env.CONNECTOR_PORT||8081);
let active=0;
const server=http.createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 if(req.url==='/health'&&req.method==='GET')return send(200,{ok:true,version:'0.11.0',mode:'public-reader'});
 if(req.url!=='/mcp')return send(404,{error:'Not found'});
 if(!originAllowed(req.headers.origin))return send(403,{error:'Browser origins disabled'});
 if(!authorized(req.headers.authorization,key)){res.setHeader('WWW-Authenticate','Bearer');return send(401,{error:'Unauthorized'})}
 if(req.method!=='POST')return send(405,{error:'Stateless POST only'});
 if(active>=4)return send(429,{error:'Busy'});
 active++;
 let transport,mcp;
 try{
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65536)throw Error('Request too large');chunks.push(chunk)}
 const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(Array.isArray(body))return send(400,{error:'JSON-RPC batches disabled'});
 mcp=createServer(client);
 transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
 await mcp.connect(transport);
 await transport.handleRequest(req,res,body);
 }catch(e){if(!res.headersSent)send(400,{error:'Invalid request'});else res.end()}
 finally{await transport?.close().catch(()=>{});await mcp?.close().catch(()=>{});active--}
});
server.requestTimeout=30000;server.headersTimeout=10000;
server.listen(port,process.env.CONNECTOR_BIND||'127.0.0.1',()=>console.log('ECOAGENT connector ready on '+port));
