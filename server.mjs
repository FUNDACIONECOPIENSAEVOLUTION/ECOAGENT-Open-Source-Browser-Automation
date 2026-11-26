import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
import {profilePath, safeUrl, sensitiveField} from './privacy.mjs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {validateBatch} from './protocol.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const home=resolve(process.env.LOCALAPPDATA || (process.platform==='win32'?resolve(homedir(),'AppData','Local'):resolve(homedir(),'.local','share')),'ECOAGENT');
await mkdir(home,{recursive:true});
const token=randomBytes(32).toString('hex');
const port=Number(process.env.ECOAGENT_LOCAL_PORT||8790);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Puerto inválido');const origin='http://127.0.0.1:'+port;
let context,page,busy=false,revision=0,activeProfile='institutional',browserChannel='chrome',manual=false;
const refs=new Map();
const clips=s=>String(s??'').slice(0,180);
function allowed(raw){const u=new URL(raw);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Solo HTTP(S) sin credenciales en URL');return u.href}
async function boot(){
 if(context)return;
 const profile=profilePath(home,activeProfile);
 await mkdir(profile,{recursive:true,mode:0o700});
 context=await chromium.launchPersistentContext(profile,{...(browserChannel==='chrome'?{channel:'chrome'}:{}),headless:false,acceptDownloads:false,viewport:{width:1360,height:850}});
 page=context.pages()[0]||await context.newPage();
 context.on('close',()=>{context=null;page=null;refs.clear()});
}
async function inspect(){
 if(manual)throw Error('Modo privado activo: inspección deshabilitada');
 refs.clear();revision++;
 const frames=page.frames().slice(0,12), elements=[];
 for(const frame of frames){
  const loc=frame.locator('a[href],button,input:not([type=hidden]),textarea,select,[role=button],[role=checkbox],[contenteditable=true]');
  const count=Math.min(await loc.count(),350);
  for(let i=0;i<count&&elements.length<100;i++){
   const l=loc.nth(i);if(!await l.isVisible().catch(()=>false))continue;
   const info=await l.evaluate(e=>({tag:e.tagName.toLowerCase(),type:e.getAttribute('type')||'',label:e.getAttribute('aria-label')||Array.from(e.labels||[]).map(l=>{const c=l.cloneNode(true);c.querySelectorAll('input,select,textarea,button,script,style').forEach(n=>n.remove());return (c.textContent||'').replace(/\s+/g,' ').trim()}).join(' ').trim()||e.getAttribute('placeholder')||e.innerText||e.getAttribute('name')||'',required:e.required||e.getAttribute('aria-required')==='true',autocomplete:e.getAttribute('autocomplete')||'',name:e.getAttribute('name')||''})).catch(()=>null);
   if(!info||sensitiveField(info))continue;
   const id=revision+':'+elements.length;
   // Retain an element handle, not a shifting nth index.
   const handle=await l.elementHandle().catch(()=>null);if(!handle)continue;
   refs.set(id,{handle,info});elements.push({...info,label:clips(info.label),id});
  }
 }
 return {url:safeUrl(page.url()),title:await page.title(),elements};
}
async function action(a){
 if(a.op==='profile_status')return {profile:activeProfile,channel:browserChannel,manual};
 if(a.op==='profile_switch'){if(context)await context.close();activeProfile=a.profile;browserChannel=a.channel;manual=true;await boot();return {profile:activeProfile,channel:browserChannel,manual};}
 if(a.op==='manual'){manual=a.enabled;refs.clear();if(manual)await page.bringToFront();return {manual};}
 if(manual)throw Error('Modo privado activo: termine el inicio de sesión localmente y reactive la automatización');
 if(a.op==='open'){await page.goto(allowed(a.url),{waitUntil:'domcontentloaded',timeout:30000});refs.clear();return {url:safeUrl(page.url())}}
 if(a.op==='inspect')return inspect();
 if(a.op==='tabs')return context.pages().map((p,i)=>({index:i,url:safeUrl(p.url())}));
 if(a.op==='tab'){const p=context.pages()[a.index];if(!p)throw Error('Pestaña inexistente');page=p;refs.clear();return {url:safeUrl(p.url())}}
 if(a.op==='back'){await page.goBack({waitUntil:'domcontentloaded',timeout:15000});refs.clear();return {url:safeUrl(page.url())}}
 if(a.op==='scroll'){await page.mouse.wheel(0,a.y);return {ok:true}}
 if(a.op==='capture'){if(!a.approved)throw Error('Captura requiere autorización');const name='capture-'+Date.now()+'.png';await page.screenshot({path:resolve(home,name)});return {file:name}}
 if(a.op==='wait'){await page.waitForTimeout(a.ms);return {ok:true}}
 const r=refs.get(a.id);if(!r)throw Error('Referencia caducada: inspeccione de nuevo');
 const h=r.handle;
 if(a.op==='fill'){if(sensitiveField(r.info))throw Error('Campo reservado: interacción manual');await h.fill(a.value,{timeout:8000});return {ok:true}}
 if(a.op==='select'){await h.selectOption({label:a.value},{timeout:8000});return {ok:true}}
 if(a.op==='click'){
  // All clicks require operator approval; no guessed distinction between submit and navigation.
  if(!a.approved)throw Error('Clic requiere autorización local explícita');
  await h.click({timeout:8000});refs.clear();return {url:safeUrl(page.url())};
 }
 throw Error('Operación no soportada');
}
function auth(req){const got=Buffer.from(req.headers.authorization||'');const want=Buffer.from('Bearer '+token);return got.length===want.length&&timingSafeEqual(got,want)}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!=='127.0.0.1:'+port)return json(res,403,{error:'Host no permitido'});
  if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'"});return res.end(await readFile(resolve(root,'local-panel.html')))}
  if(req.method==='GET'&&['/ui.js','/style.css'].includes(req.url)){res.writeHead(200,{'Content-Type':req.url.endsWith('.js')?'text/javascript':'text/css'});return res.end(await readFile(resolve(root,req.url.slice(1))))}
  if(req.method==='GET'&&req.url==='/api/v1/live'){
   if(req.headers.origin&&req.headers.origin!==origin)return json(res,403,{error:'Origen no permitido'});
   if(!auth(req))return json(res,401,{error:'Token requerido'});
   if(manual||!page||busy)return json(res,409,{error:'Visor no disponible: modo privado, navegador cerrado o motor ocupado'});
   busy=true;
   try{
    for(const frame of page.frames()){
     if(await frame.locator('input[type=password],input[autocomplete=one-time-code],input[autocomplete=current-password],input[autocomplete=new-password]').count())return json(res,403,{error:'Visor bloqueado en página de autenticación'});
    }
    const png=await page.screenshot({type:'jpeg',quality:65,timeout:5000});
    res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(png);
   }finally{busy=false}
  }
  if(req.method!=='POST'||req.url!=='/api/v1/batch')return json(res,404,{error:'Ruta desconocida'});
  if(req.headers.origin&&req.headers.origin!==origin)return json(res,403,{error:'Origen no permitido'});
  if(!auth(req))return json(res,401,{error:'Token requerido'});
  if(busy)return json(res,409,{error:'Motor ocupado'});
  busy=true;
  try{
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536)throw Error('Solicitud demasiado grande')}
   const steps=validateBatch(JSON.parse(raw));
   if(steps.some(a=>!['profile_status','profile_switch'].includes(a.op)))await boot();
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

// Only an explicitly forked parent can request this test/maintenance shutdown.
if(process.send)process.on('message',async m=>{if(m?.type!=='ecoagent-shutdown')return;try{if(context)await context.close()}finally{server.close(()=>process.exit(0))}});
