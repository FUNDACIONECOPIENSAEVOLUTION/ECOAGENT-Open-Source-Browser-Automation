import http from 'node:http';
import {allowedRoute} from './route.mjs';
const publicUrl=new URL(process.env.ECOAGENT_RESOURCE_URL||'');
if(publicUrl.protocol!=='https:'||publicUrl.pathname!=='/mcp'||publicUrl.username||publicUrl.password||publicUrl.search||publicUrl.hash)throw Error('Exact HTTPS resource URL required');
const upstream='http://127.0.0.1:8081';
const metadata=await fetch(upstream+'/.well-known/oauth-protected-resource/mcp',{signal:AbortSignal.timeout(5000)});
if(!metadata.ok||(await metadata.json()).resource!==publicUrl.href)throw Error('OAuth resource metadata not ready; refusing gateway startup');
let active=0;
const server=http.createServer(async(req,res)=>{
 const fail=(code,error)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error}))};
 if(!allowedRoute(req.method,req.url))return fail(404,'Not found');
 if(req.headers.origin)return fail(403,'Browser origin forbidden');
 if(active>=4)return fail(429,'Busy');
 active++;
 try{
 const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>65536)return fail(413,'Too large');chunks.push(c)}
 const headers={};for(const h of ['authorization','content-type','accept','mcp-protocol-version'])if(typeof req.headers[h]==='string')headers[h]=req.headers[h];
 const r=await fetch(upstream+req.url,{method:req.method,headers,redirect:'error',signal:AbortSignal.timeout(30000),...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
 const out={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};for(const h of ['content-type','www-authenticate'])if(r.headers.has(h))out[h]=r.headers.get(h);
 const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>1048576)return fail(502,'Response too large');
 res.writeHead(r.status,out);res.end(bytes);
 }catch{if(!res.headersSent)fail(502,'Connector unavailable');else res.end()}finally{active--}
});
server.requestTimeout=20000;server.headersTimeout=10000;
server.listen(8082,'127.0.0.1',()=>console.log('ECOAGENT restricted gateway ready on 8082'));
