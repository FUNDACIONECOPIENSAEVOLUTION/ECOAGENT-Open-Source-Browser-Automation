import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {maxDocumentBytes} from './document-vault.mjs';
export async function startApprovalUI(approvals,{port=8793,vault}={}){
 const token=randomBytes(24).toString('hex');
 const host='127.0.0.1';
 let origin='http://'+host+':'+port;
 const path='/approval/'+token;
 const html=String.raw`<!doctype html><html lang="es"><meta charset="utf-8"><title>ECOAGENT autorizaciones locales</title><style>body{font:16px system-ui;max-width:720px;margin:40px auto;padding:16px}article{border:1px solid #aaa;padding:16px;margin:12px 0}button{padding:10px;margin-right:10px}small{display:block;color:#555}</style><h1>Autorizaciones ECOAGENT</h1><p>Solo pruebas con documentos sintéticos. Revisa cada acción antes de autorizar. No se realizan envíos externos.</p><section><h2>Documentos locales</h2><p>Selecciona archivos que deseas preparar en el navegador. No se envían a ninguna institución.</p><input id="file" type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.png,.jpg,.jpeg"><button id="add">Incorporar archivo</button><p id="fileStatus"></p><ul id="docs"></ul></section><main></main><script>
const base=location.pathname;const main=document.querySelector('main');
async function refresh(){const r=await fetch(base+'/list',{cache:'no-store'});if(!r.ok)return;const list=await r.json();main.replaceChildren();for(const a of list){const el=document.createElement('article');const p=document.createElement('p');p.textContent=a.description;el.append(p);const meta=document.createElement('small');meta.textContent=a.action+' · '+a.state+' · '+new Date(a.expires).toLocaleTimeString();el.append(meta);if(a.state==='pending')for(const allow of [true,false]){const b=document.createElement('button');b.textContent=allow?'Autorizar una vez':'Rechazar';b.onclick=async()=>{await fetch(base+'/decide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:a.id,allow})});await refresh()};el.append(b)}main.append(el)}if(!list.length)main.textContent='No hay solicitudes pendientes.'}
async function docs(){const r=await fetch(base+'/documents',{cache:'no-store'});if(!r.ok)return;const list=await r.json();const ul=document.querySelector('#docs');ul.replaceChildren();for(const d of list){const li=document.createElement('li');li.textContent=d.name+' ('+d.size+' bytes) ';const b=document.createElement('button');b.textContent='Retirar';b.onclick=async()=>{await fetch(base+'/documents/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id})});await docs()};li.append(b);ul.append(li)}}
document.querySelector('#add').onclick=async()=>{const f=document.querySelector('#file').files[0];const status=document.querySelector('#fileStatus');if(!f||f.size>25*1024*1024){status.textContent='Selecciona un archivo de hasta 25 MiB';return}try{const r=await fetch(base+'/documents/add',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Document-Name':encodeURIComponent(f.name)},body:f});status.textContent=r.ok?'Archivo incorporado localmente.':'No se pudo incorporar el archivo.';await docs()}catch{status.textContent='Error de conexión local'}};
refresh();docs();setInterval(refresh,2000);
</script></html>`;
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  const send=(status,value,type='application/json')=>{res.writeHead(status,{'Content-Type':type});res.end(type==='application/json'?JSON.stringify(value):value)};
  if(req.headers.host!==new URL(origin).host)return send(403,{error:'Host denied'});
  if(req.method==='GET'&&req.url===path)return send(200,html,'text/html; charset=utf-8');
  if(req.method==='GET'&&req.url===path+'/list')return send(200,approvals.list());
  if(vault&&req.method==='GET'&&req.url===path+'/documents')return send(200,vault.list());
  if(vault&&req.method==='POST'&&req.url===path+'/documents/add'){
   if(req.headers.origin!==origin||req.headers['content-type']!=='application/octet-stream')return send(403,{error:'Origin denied'});
   const length=Number(req.headers['content-length']);if(!Number.isSafeInteger(length)||length<1||length>maxDocumentBytes)return send(413,{error:'Size denied'});
   try{let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>length){send(413,{error:'Too large'});return}chunks.push(c)}if(size!==length)throw Error('Incomplete file');return send(200,vault.add(decodeURIComponent(req.headers['x-document-name']||''),Buffer.concat(chunks)))}catch{return send(400,{error:'File rejected'})}
  }
  if(vault&&req.method==='POST'&&req.url===path+'/documents/remove'){
   if(req.headers.origin!==origin||req.headers['content-type']!=='application/json')return send(403,{error:'Origin denied'});
   try{let body='';for await(const c of req){body+=c;if(body.length>1024)return send(413,{error:'Too large'})}return send(200,{removed:vault.remove(JSON.parse(body).id)})}catch{return send(400,{error:'Invalid request'})}
  }
  if(req.method==='POST'&&req.url===path+'/decide'){
   if(req.headers.origin!==origin||req.headers['content-type']!=='application/json')return send(403,{error:'Origin denied'});
   try{let body='';for await(const chunk of req){body+=chunk;if(body.length>1024){send(413,{error:'Too large'});return}}const x=JSON.parse(body);return send(200,approvals.decide(x.id,x.allow))}catch{return send(400,{error:'Invalid decision'})}
  }
  return send(404,{error:'Not found'});
 });
 server.requestTimeout=5000;server.headersTimeout=5000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve)});
 origin='http://'+host+':'+server.address().port;
 server.unref();return {url:origin+path,close:()=>new Promise(resolve=>server.close(resolve))};
}
