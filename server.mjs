import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {validateBatch} from './protocol.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const home=resolve(root,'private');
await mkdir(home,{recursive:true});
const token=randomBytes(32).toString('hex');
const port=8790, origin='http://127.0.0.1:'+port;
let context,page,busy=false,revision=0;
const refs=new Map();
const clips=s=>String(s??'').slice(0,180);
function allowed(raw){const u=new URL(raw);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Solo HTTP(S) sin credenciales en URL');return u.href}
async function boot(){
 if(context)return;
 context=await chromium.launchPersistentContext(resolve(home,'browser'),{headless:false,acceptDownloads:true,viewport:{width:1360,height:850}});
 page=context.pages()[0]||await context.newPage();
 context.on('close',()=>{context=null;page=null;refs.clear()});
}
async function inspect(){
 refs.clear();revision++;
 const frames=page.frames().slice(0,12), elements=[];
 for(const frame of frames){
  const loc=frame.locator('a[href],button,input:not([type=hidden]),textarea,select,[role=button],[role=checkbox],[contenteditable=true]');
  const count=Math.min(await loc.count(),350);
  for(let i=0;i<count&&elements.length<100;i++){
   const l=loc.nth(i);if(!await l.isVisible().catch(()=>false))continue;
   const info=await l.evaluate(e=>({tag:e.tagName.toLowerCase(),type:e.getAttribute('type')||'',label:e.getAttribute('aria-label')||Array.from(e.labels||[]).map(x=>x.innerText).join(' ')||e.getAttribute('placeholder')||e.innerText||e.getAttribute('name')||'',required:e.required||e.getAttribute('aria-required')==='true'})).catch(()=>null);
   if(!info)continue;
   const id=revision+':'+elements.length;
   // Retain an element handle, not a shifting nth index.
   const handle=await l.elementHandle().catch(()=>null);if(!handle)continue;
   refs.set(id,{handle,info});elements.push({...info,label:clips(info.label),id});
  }
 }
 return {url:page.url(),title:await page.title(),text:(await page.locator('body').innerText({timeout:5000}).catch(()=>'' )).slice(0,6000),elements};
}
async function action(a){
 if(a.op==='open'){await page.goto(allowed(a.url),{waitUntil:'domcontentloaded',timeout:30000});refs.clear();return {url:page.url()}}
 if(a.op==='inspect')return inspect();
 if(a.op==='tabs')return context.pages().map((p,i)=>({index:i,url:p.url()}));
 if(a.op==='tab'){const p=context.pages()[a.index];if(!p)throw Error('Pestaña inexistente');page=p;refs.clear();return {url:p.url()}}
 if(a.op==='back'){await page.goBack({waitUntil:'domcontentloaded',timeout:15000});refs.clear();return {url:page.url()}}
 if(a.op==='scroll'){await page.mouse.wheel(0,a.y);return {ok:true}}
 if(a.op==='capture'){const name='capture-'+Date.now()+'.png';await page.screenshot({path:resolve(home,name)});return {file:name}}
 if(a.op==='wait'){await page.waitForTimeout(a.ms);return {ok:true}}
 const r=refs.get(a.id);if(!r)throw Error('Referencia caducada: inspeccione de nuevo');
 const h=r.handle;
 if(a.op==='fill'){if(/password|file|hidden/i.test(r.info.type))throw Error('Campo reservado: interacción manual');await h.fill(a.value,{timeout:8000});return {ok:true}}
 if(a.op==='select'){await h.selectOption({label:a.value},{timeout:8000});return {ok:true}}
 if(a.op==='click'){
  // All clicks require operator approval; no guessed distinction between submit and navigation.
  if(!a.approved)throw Error('Clic requiere autorización local explícita');
  await h.click({timeout:8000});refs.clear();return {url:page.url()};
 }
 throw Error('Operación no soportada');
}
function auth(req){const got=Buffer.from(req.headers.authorization||'');const want=Buffer.from('Bearer '+token);return got.length===want.length&&timingSafeEqual(got,want)}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!=='127.0.0.1:'+port)return json(res,403,{error:'Host no permitido'});
  if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'"});return res.end(await readFile(resolve(root,'index.html')))}
  if(req.method==='GET'&&['/ui.js','/style.css'].includes(req.url)){res.writeHead(200,{'Content-Type':req.url.endsWith('.js')?'text/javascript':'text/css'});return res.end(await readFile(resolve(root,req.url.slice(1))))}
  if(req.method!=='POST'||req.url!=='/api/v1/batch')return json(res,404,{error:'Ruta desconocida'});
  if(req.headers.origin&&req.headers.origin!==origin)return json(res,403,{error:'Origen no permitido'});
  if(!auth(req))return json(res,401,{error:'Token requerido'});
  if(busy)return json(res,409,{error:'Motor ocupado'});
  busy=true;
  try{
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536)throw Error('Solicitud demasiado grande')}
   const steps=validateBatch(JSON.parse(raw));
   await boot();
   const results=[];
   for(const a of steps){
    try{results.push({op:a.op,ok:true,data:await action(a)})}
    catch(e){results.push({op:a.op,ok:false,error:clips(e.message)});break}
   }
   // Only operation names and outcomes, never inputs or page contents.
   await writeFile(resolve(home,'last-run.json'),JSON.stringify({time:new Date().toISOString(),results:results.map(({op,ok})=>({op,ok}))}));
   return json(res,200,{results});
  }finally{busy=false}
 }catch(e){return json(res,400,{error:clips(e.message)})}
});
server.listen(port,'127.0.0.1',()=>console.log('ECOAGENT '+origin+'\nToken temporal (solo local): '+token));
