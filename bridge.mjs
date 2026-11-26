import http from 'node:http';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {validateJob} from './bridge-protocol.mjs';
const port=8791,host='127.0.0.1:'+port;
const clientKey=randomBytes(32).toString('hex'),operatorKey=randomBytes(32).toString('hex');
const jobs=new Map(),ttl=15*60*1000;
const match=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
function clean(){for(const [id,j] of jobs)if(Date.now()-j.created>ttl)jobs.delete(id)}
async function body(req){let s='';for await(const c of req){s+=c;if(Buffer.byteLength(s)>65536)throw Error('Solicitud demasiado grande')}return JSON.parse(s||'{}')}
const server=http.createServer(async(req,res)=>{
 try{
 if(req.headers.host!==host)return send(res,403,{error:'Host no permitido'});
 const origin=req.headers.origin;
 if(origin&&!/^chrome-extension:\/\/[a-p]{32}$/.test(origin))return send(res,403,{error:'Origen no permitido'});
 if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS')}
 if(req.method==='OPTIONS')return res.writeHead(204).end();
 const bearer=req.headers.authorization||'';
 const op=match(bearer,'Bearer '+operatorKey),client=match(bearer,'Bearer '+clientKey);
 if(!op&&!client)return send(res,401,{error:'Autorización requerida'});
 clean();
 const path=req.url;
 if(req.method==='POST'&&path==='/v1/jobs'&&client){
 if(jobs.size>=50)return send(res,429,{error:'Cola llena'});
 const data=validateJob(await body(req));const id=randomUUID();
 jobs.set(id,{id,...data,status:'pending',created:Date.now()});
 return send(res,201,{id,status:'pending'});
 }
 if(req.method==='GET'&&path==='/v1/pending'&&op)return send(res,200,{jobs:[...jobs.values()].filter(j=>j.status==='pending').map(({id,origin,steps})=>({id,origin,steps}))});
 const m=/^\/v1\/jobs\/([a-f0-9-]+)(?:\/(claim|finish|reject))?$/.exec(path||'');
 if(!m||!jobs.has(m[1]))return send(res,404,{error:'No encontrado'});
 const j=jobs.get(m[1]);
 if(req.method==='GET'&&!m[2]&&client)return send(res,200,{id:j.id,status:j.status,result:j.result||null});
 if(req.method==='POST'&&op&&m[2]==='claim'&&j.status==='pending'){j.status='running';return send(res,200,{ok:true})}
 if(req.method==='POST'&&op&&m[2]==='reject'&&j.status==='pending'){j.status='rejected';return send(res,200,{ok:true})}
 if(req.method==='POST'&&op&&m[2]==='finish'&&j.status==='running'){
 const b=await body(req);if(!['completed','failed','cancelled'].includes(b.status)||!Array.isArray(b.results))throw Error('Resultado inválido');
 // Operator explicitly chooses whether to share these results; never write to disk.
 j.status=b.status;j.result=b.results;delete j.steps;return send(res,200,{ok:true});
 }
 return send(res,409,{error:'Acción no permitida para estado o credencial'});
 }catch(e){return send(res,400,{error:String(e.message).slice(0,160)})}
});
server.listen(port,'127.0.0.1',()=>console.log('ECOAGENT bridge http://'+host+'\nCLIENTE (solo cola): '+clientKey+'\nOPERADOR (solo extension): '+operatorKey));
