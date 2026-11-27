import {randomUUID} from 'node:crypto';
import {readURL,requestAllowed,pageOutcome} from './desktop-policy.mjs';
import {canDraft,validateDraft,findRef} from './desktop-live-policy.mjs';
import {sensitiveField} from '../privacy.mjs';
import {createHash} from 'node:crypto';
const fixture='https://example.org/ecoagent-local-fixture';
const html='<html><head><title>ECOAGENT local form fixture</title></head><body><h1>Draft only</h1><form><label>Project <input name="project" required></label><label>Summary <textarea name="summary"></textarea></label><label>Category <select name="category"><option>Research</option><option>Environment</option></select></label><label>Password <input type="password" name="password"></label><button type="submit">Submit</button></form></body></html>';
export function createLive(root,{ttl=300000}={}){
 let session=null;
 async function close(){const s=session;session=null;if(s){clearTimeout(s.timer);await s.browser.close().catch(()=>{})}return {closed:!!s}}
 function arm(s){clearTimeout(s.timer);s.timer=setTimeout(()=>{if(session===s&&!s.active)void close();else if(session===s)arm(s)},ttl);s.timer.unref()}
 function lookup(id){if(!session||session.id!==id)throw Error('Unknown live session');return session}
 async function inspect(s){
  if(!s.demo){const u=readURL(s.page.url());if(u.origin!==s.origin)throw Error('Origin changed');for(const frame of s.page.frames()){if(await frame.locator('input[type=password],input[autocomplete=one-time-code]').count())throw Error('Authentication screen; manual access required')}}
  for(const r of s.refs.values())await r.handle.dispose().catch(()=>{});s.refs.clear();s.snapshot=randomUUID();
  const fields=[];const nodes=await s.page.locator('input,textarea,select,button,a[href]').elementHandles();
  try{
   for(const handle of nodes.slice(0,150)){
    if(fields.length>=60||!await handle.isVisible().catch(()=>false))continue;
    const info=await handle.evaluate(e=>({tag:e.tagName.toLowerCase(),type:e.type||'',name:e.name||'',label:e.getAttribute('aria-label')||Array.from(e.labels||[]).map(l=>l.innerText).join(' ')||e.getAttribute('placeholder')||((e.tagName==='BUTTON'||e.tagName==='A')?e.innerText:'')||'',autocomplete:e.autocomplete||'',required:!!e.required,disabled:!!e.disabled,readOnly:!!e.readOnly,href:e.tagName==='A'?e.href:''})).catch(()=>null);
    if(!info||sensitiveField(info))continue;
    const id=randomUUID();let href=null;if(info.href&&!s.demo)try{const u=readURL(info.href);if(u.origin===s.origin)href=u.href}catch{}
    const draft=s.demo&&canDraft(info);
    s.refs.set(id,{handle,info,href});fields.push({id,tag:info.tag,type:info.type,label:String(info.label).slice(0,160),required:info.required,draft,follow:!!href});
   }
  }finally{for(const h of nodes)if(![...s.refs.values()].some(r=>r.handle===h))await h.dispose().catch(()=>{})}
  return {session:s.id,snapshot:s.snapshot,demo:s.demo,url:s.page.url(),title:await s.page.title(),status:s.status,outcome:pageOutcome(s.status),text:(await s.page.locator('body').innerText({timeout:5000})).slice(0,5000),elements:fields};
 }
 async function navigate(s,url){const r=await s.page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});s.status=r?.status()??null;return inspect(s)}
 async function run(id,fn){const s=lookup(id);s.active=true;try{return await fn(s)}catch(e){await close();throw e}finally{s.active=false;if(session===s)arm(s)}}
 return {
 async open(url,demo=false){
  if(session)throw Error('Close current live session first');const u=readURL(demo?fixture:url);
  // Import lazily: health and invalid-input tests work without browser installation.
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true,chromiumSandbox:true,timeout:15000,env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)/i.test(k))),});
  const s={id:randomUUID(),browser,origin:u.origin,demo,refs:new Map(),active:true};session=s;
  try{
   const c=await browser.newContext({acceptDownloads:false,serviceWorkers:'block',javaScriptEnabled:!demo});
   await c.route('**/*',async r=>{
    if(demo){if(r.request().url()===fixture&&r.request().method()==='GET')return r.fulfill({status:200,contentType:'text/html',body:html});return r.abort()}
    if(!requestAllowed(r.request().url(),s.origin,r.request().method()))return r.abort();
    try{const res=await r.fetch({maxRedirects:0,timeout:10000});try{if(res.status()>=300&&res.status()<400)await r.fulfill({status:403,contentType:'text/plain',body:'Redirect blocked'});else await r.fulfill({response:res})}finally{await res.dispose()}}catch{await r.abort().catch(()=>{})}
   });
   await c.routeWebSocket('**/*',ws=>ws.close());
   s.page=await c.newPage();c.on('page',p=>{if(p!==s.page)void p.close().catch(()=>{})});return await navigate(s,u.href);
  }catch(e){await close();throw e}finally{s.active=false;if(session===s)arm(s)}
 },
 inspect:id=>run(id,inspect),
 follow:(id,ref,element)=>run(id,async s=>{const r=findRef(ref,s.snapshot,s.refs,element);if(!r.href||s.demo)throw Error('Only approved public links');return navigate(s,r.href)}),
 fill:(id,ref,element,value)=>run(id,async s=>{if(!s.demo)throw Error('Draft interaction is fixture-only');const r=findRef(ref,s.snapshot,s.refs,element);validateDraft(r.info,value);if(r.info.tag==='select')await r.handle.selectOption({label:value},{timeout:5000});else await r.handle.fill(value,{timeout:5000});return inspect(s)}),
 review:(id)=>run(id,async s=>{
  if(!s.demo)throw Error('Review limited to offline fixture');
  const fields=await s.page.locator('input,textarea,select').evaluateAll(nodes=>nodes.filter(e=>['project','summary','category'].includes(e.name)).map(e=>({name:e.name,required:e.required,filled:!!e.value.trim(),valid:e.validity.valid})));
  return {session:s.id,demo:true,fields,ready:fields.every(f=>f.valid&&(!f.required||f.filled)),submitted:false};
 }),
 capture:(id)=>run(id,async s=>{
  if(!s.demo)throw Error('Capture limited to offline fixture');
  const bytes=await s.page.screenshot({type:'jpeg',quality:55,timeout:5000});
  if(bytes.length>512000)throw Error('Capture too large');
  return {data:bytes.toString('base64'),mimeType:'image/jpeg',sha256:createHash('sha256').update(bytes).digest('hex')};
 }),
 verify:(id,ref,element,value)=>run(id,async s=>{
  if(!s.demo)throw Error('Verification limited to offline fixture');
  const r=findRef(ref,s.snapshot,s.refs,element);validateDraft(r.info,value);
  const matches=await r.handle.evaluate((e,v)=>e.tagName==='SELECT'?e.selectedOptions[0]?.label===v:e.value===v,value);
  return {matches,submitted:false};
 }),
 async close(id){lookup(id);return close()}
 };
}
