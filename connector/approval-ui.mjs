import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {maxDocumentBytes} from './document-vault.mjs';
export async function startApprovalUI(approvals,{port=8793,vault,manual}={}){
 const token=randomBytes(24).toString('hex');
 const host='127.0.0.1';
 let origin='http://'+host+':'+port;
 const path='/approval/'+token;
 const html=String.raw`<!doctype html><html lang="es"><meta charset="utf-8"><title>ECOAGENT autorizaciones locales</title><style>body{font:16px system-ui;max-width:720px;margin:40px auto;padding:16px}article{border:1px solid #aaa;padding:16px;margin:12px 0}button{padding:10px;margin-right:10px}small{display:block;color:#555}</style><h1>Autorizaciones ECOAGENT</h1><p>Revisa el destino y el tipo de acción antes de autorizar. Una autorización de envío externo permite una única operación posterior; las pruebas sintéticas no se envían a instituciones. Autorizar no confirma una postulación.</p><section><h2>Documentos locales</h2><p>Selecciona archivos que deseas preparar en el navegador. No se envían a ninguna institución.</p><input id="file" type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.png,.jpg,.jpeg"><button id="add">Incorporar archivo</button><p id="fileStatus"></p><ul id="docs"></ul></section><section><h2>Control manual</h2><p id="mode"></p><button id="take">Tomar control</button><button id="release">Devolver control</button><button id="view">Ver página</button><label><input type="checkbox" id="observe"> Vista actualizada automáticamente</label><button id="reload">Recargar</button><button id="back">Atrás</button><button id="forward">Adelante</button><p id="manualStatus"></p><img id="preview" style="max-width:100%" alt="Vista del navegador"><div id="elements"></div></section><main></main><script>
const base=location.pathname;const main=document.querySelector('main');
async function refresh(){const r=await fetch(base+'/list',{cache:'no-store'});if(!r.ok)return;const list=await r.json();main.replaceChildren();for(const a of list){const el=document.createElement('article');const p=document.createElement('p');p.textContent=a.description;el.append(p);const meta=document.createElement('small');meta.textContent=a.action+' · '+a.state+' · '+new Date(a.expires).toLocaleTimeString();el.append(meta);if(a.state==='pending')for(const allow of [true,false]){const b=document.createElement('button');b.textContent=allow?'Autorizar una vez':'Rechazar';b.onclick=async()=>{await fetch(base+'/decide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:a.id,allow})});await refresh()};el.append(b)}main.append(el)}if(!list.length)main.textContent='No hay solicitudes pendientes.'}
async function docs(){const r=await fetch(base+'/documents',{cache:'no-store'});if(!r.ok)return;const list=await r.json();const ul=document.querySelector('#docs');ul.replaceChildren();for(const d of list){const li=document.createElement('li');li.textContent=d.name+' ('+d.size+' bytes) ';const b=document.createElement('button');b.textContent='Retirar';b.onclick=async()=>{await fetch(base+'/documents/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:d.id})});await docs()};li.append(b);ul.append(li)}}
document.querySelector('#add').onclick=async()=>{const f=document.querySelector('#file').files[0];const status=document.querySelector('#fileStatus');if(!f||f.size>25*1024*1024){status.textContent='Selecciona un archivo de hasta 25 MiB';return}try{const r=await fetch(base+'/documents/add',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Document-Name':encodeURIComponent(f.name)},body:f});status.textContent=r.ok?'Archivo incorporado localmente.':'No se pudo incorporar el archivo.';await docs()}catch{status.textContent='Error de conexión local'}};
async function manualStatus(){const r=await fetch(base+'/manual/status');if(!r.ok)return;const s=await r.json();document.querySelector('#mode').textContent=s.mode==='human'?'Control humano activo':s.requested?'Solicitud de control pendiente':'Control IA'}
async function act(action,args={}){const r=await fetch(base+'/manual/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,args})});const s=await r.json();document.querySelector('#manualStatus').textContent=r.ok?(s.blocked?'Hay cambios pendientes. No se recargó.':'Operación completada'):'Operación no disponible';await manualStatus();return r.ok?s:null}
async function view(){const s=await act('inspect');if(!s)return;const p=await act('preview');if(p)document.querySelector('#preview').src='data:image/jpeg;base64,'+p.data;const el=document.querySelector('#elements');el.replaceChildren();for(const e of s.elements){if(!e.draft&&!e.toggle&&!e.follow&&!e.click)continue;const row=document.createElement('p');row.textContent=e.label+' ';const b=document.createElement('button');b.textContent=e.follow?'Abrir':e.click?'Clic':e.toggle?'Marcar':'Escribir';b.onclick=async()=>{const args={snapshot:s.snapshot,element:e.id};if(e.follow)await act('follow',args);else if(e.click)await act('click',args);else if(e.toggle)await act('toggle',{...args,checked:true});else{const v=prompt('Valor para '+e.label);if(v===null)return;await act('fill',{...args,value:v})}await view()};row.append(b);if(e.toggle&&e.type==='checkbox'){const off=document.createElement('button');off.textContent='Desmarcar';off.onclick=async()=>{await act('toggle',{snapshot:s.snapshot,element:e.id,checked:false});await view()};row.append(off)}el.append(row)}}
for(const a of ['take','release','reload','back','forward'])document.querySelector('#'+a).onclick=async()=>{await act(a);if(a!=='release')await view();else{document.querySelector('#elements').replaceChildren();document.querySelector('#preview').removeAttribute('src')}};
document.querySelector('#view').onclick=view;
let observing=false;async function observe(){if(observing||!document.querySelector('#observe').checked)return;observing=true;try{const r=await fetch(base+'/manual/observe',{cache:'no-store'});if(!r.ok)return;const s=await r.json();if(s.available)document.querySelector('#preview').src='data:image/jpeg;base64,'+s.data;else if(!s.busy)document.querySelector('#preview').removeAttribute('src')}finally{observing=false}}refresh();docs();manualStatus();setInterval(()=>{refresh();manualStatus();observe()},2000);
</script></html>`;
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; frame-ancestors 'none'; base-uri 'none'");
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
  if(manual?.observe&&req.method==='GET'&&req.url===path+'/manual/observe'){try{return send(200,await manual.observe())}catch{return send(400,{error:'Preview unavailable'})}}
  if(manual&&req.method==='GET'&&req.url===path+'/manual/status')return send(200,manual.status());
  if(manual&&req.method==='POST'&&req.url===path+'/manual/action'){
   if(req.headers.origin!==origin||req.headers['content-type']!=='application/json')return send(403,{error:'Origin denied'});
   try{let body='';for await(const c of req){body+=c;if(body.length>8192)return send(413,{error:'Too large'})}const x=JSON.parse(body);return send(200,await manual.execute(x.action,x.args||{}))}catch{return send(400,{error:'Manual action denied'})}
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
