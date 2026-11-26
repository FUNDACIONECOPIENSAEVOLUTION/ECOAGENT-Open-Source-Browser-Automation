import http from 'node:http';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {parseOrigins,allowed,validate} from './policy.mjs';
const port=Number(process.env.PORT||8080), key=process.env.ECOAGENT_OPERATOR_KEY||'', client=process.env.ECOAGENT_CLIENT_KEY||'';
if(key.length<32||client.length<32||key===client)throw Error('Set distinct keys of 32+ characters');
const origins=parseOrigins(process.env.ECOAGENT_ALLOWED_ORIGINS||'https://example.org');
let browser,context,page,busy=false,snapshot='',refs=[],last=Date.now();
const jobs=new Map();
const eq=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
const send=(r,s,d)=>{r.writeHead(s,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});r.end(JSON.stringify(d))};
async function close(){if(browser)await browser.close();browser=context=page=null;refs=[];snapshot=''}
async function start(){if(page)return;browser=await chromium.launch({headless:true,chromiumSandbox:true});context=await browser.newContext({acceptDownloads:false,serviceWorkers:'block'});await context.route('**/*',r=>allowed(r.request().url(),origins)?r.continue():r.abort());page=await context.newPage();context.on('page',p=>{if(p!==page)p.close().catch(()=>{})});}
const sensitive=e=>/password|hidden|file|one-time-code|cc-|username|webauthn|secret|token|contrase|otp/i.test([e.type,e.autocomplete,e.name,e.label].join(' '));
async function execute(a){
 if(a.op==='close'){await close();return {closed:true}}
 await start();last=Date.now();
 if(a.op==='open'){await page.goto(a.url,{waitUntil:'domcontentloaded',timeout:20000});refs=[];snapshot='';return {origin:new URL(page.url()).origin}}
 if(!allowed(page.url(),origins))throw Error('Open allowed site first');
 if(await page.locator('input[type=password],input[autocomplete=one-time-code]').count())throw Error('Authentication pages are not supported in this prototype');
 if(a.op==='inspect'){
 refs=[];snapshot=randomUUID();const loc=page.locator('a[href],button,input,textarea,select');const count=Math.min(await loc.count(),180);
 for(let i=0;i<count&&refs.length<60;i++){const h=await loc.nth(i).elementHandle();if(!h||!await h.isVisible())continue;const meta=await h.evaluate(e=>({tag:e.tagName.toLowerCase(),type:e.type||'',autocomplete:e.autocomplete||'',name:e.name||'',label:(e.getAttribute('aria-label')||Array.from(e.labels||[]).map(l=>l.innerText).join(' ')||e.placeholder||e.innerText||e.name||'').trim().slice(0,120)}));if(!sensitive(meta))refs.push({h,meta})}
 return {snapshot,origin:new URL(page.url()).origin,elements:refs.map(({meta},id)=>({id,tag:meta.tag,type:meta.type,label:meta.label}))}
 }
 if(snapshot!==a.snapshot||!refs[a.id])throw Error('Snapshot expired');
 const {h,meta}=refs[a.id];if(!await h.isVisible())throw Error('Element changed');
 const current=await h.evaluate(e=>({type:e.type||'',autocomplete:e.autocomplete||'',name:e.name||'',label:(e.getAttribute('aria-label')||Array.from(e.labels||[]).map(l=>l.innerText).join(' ')||e.placeholder||e.innerText||e.name||'').trim().slice(0,120)}));
 if(sensitive(current)||current.label!==meta.label)throw Error('Element changed');
 if(a.op==='fill'){if(meta.tag==='select')await h.selectOption({label:a.value},{timeout:5000});else await h.fill(a.value,{timeout:5000});}
 if(a.op==='click')await h.click({timeout:5000});
 refs=[];snapshot='';return {ok:true,origin:new URL(page.url()).origin};
}
setInterval(()=>{for(const [id,j] of jobs)if(Date.now()-j.created>900000)jobs.delete(id);if(!busy&&browser&&Date.now()-last>300000){busy=true;close().catch(()=>{}).finally(()=>busy=false)}},30000).unref();
async function body(q){let s='';for await(const c of q){s+=c;if(Buffer.byteLength(s)>16000)throw Error('Too large')}return JSON.parse(s||'{}')}
http.createServer(async(q,r)=>{try{
 const path=q.url;if(q.method==='GET'&&path==='/health')return send(r,200,{ok:true,mode:'single-operator-preview'});
 if(q.method==='GET'&&['/','/ui.js','/style.css'].includes(path)){r.writeHead(200,{'Content-Type':path==='/'?'text/html; charset=utf-8':path.endsWith('.js')?'text/javascript':'text/css','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; img-src 'self' blob:; script-src 'self'; style-src 'self'; frame-ancestors 'none'"});return r.end(await readFile(new URL(path==='/'?'./index.html':'.'+path,import.meta.url)))}
 const operator=eq(q.headers.authorization,'Bearer '+key), requester=eq(q.headers.authorization,'Bearer '+client);
 if(!operator&&!requester)return send(r,401,{error:'Authorization required'});
 if(q.method==='POST'&&path==='/api/jobs'&&requester){if(jobs.size>=20)return send(r,429,{error:'Queue full'});const a=validate(await body(q),origins),id=randomUUID();jobs.set(id,{id,a,status:'pending',created:Date.now()});return send(r,201,{id,status:'pending'})}
 if(q.method==='GET'&&path==='/api/jobs'&&operator)return send(r,200,{jobs:[...jobs.values()].filter(j=>j.status==='pending')});
 const m=/^\/api\/jobs\/([a-f0-9-]+)(?:\/(approve|reject))?$/.exec(path||'');
 if(m&&jobs.has(m[1])){const j=jobs.get(m[1]);if(q.method==='GET'&&!m[2])return send(r,200,{id:j.id,status:j.status,result:j.result});
 if(q.method==='POST'&&operator&&j.status==='pending'&&m[2]==='reject'){j.status='rejected';return send(r,200,{ok:true})}
 if(q.method==='POST'&&operator&&j.status==='pending'&&m[2]==='approve'){if(busy)return send(r,409,{error:'Busy'});busy=true;j.status='running';try{const b=await body(q);const result=await execute(j.a);j.result=b.share===true?result:undefined;j.status='completed';return send(r,200,{result})}catch(e){j.status='failed';return send(r,400,{error:String(e.message).slice(0,150)})}finally{busy=false}}
 }
 if(q.method==='GET'&&path==='/api/screen'&&operator){if(busy||!page||!allowed(page.url(),origins))return send(r,409,{error:'No available screen'});busy=true;try{if(await page.locator('input[type=password],input[autocomplete=one-time-code]').count())return send(r,403,{error:'Authentication screen blocked'});const png=await page.screenshot({timeout:5000});r.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});return r.end(png)}finally{busy=false}}
 return send(r,404,{error:'Not found'});
 }catch(e){return send(r,400,{error:String(e.message).slice(0,150)})}}).listen(port,'0.0.0.0');
