import {randomUUID} from 'node:crypto';
import {readURL,requestAllowed,pageOutcome} from './desktop-policy.mjs';
import {canDraft,validateDraft,findRef} from './desktop-live-policy.mjs';
import {sensitiveField} from '../privacy.mjs';
import {createHash} from 'node:crypto';
const fixture='https://example.org/ecoagent-local-fixture';
const fixtureNext=fixture+'/next';
const html='<html><head><title>ECOAGENT local form fixture</title></head><body><h1>Draft only</h1><form><label>Project <input name="project" required></label><label>Summary <textarea name="summary"></textarea></label><label>Category <select name="category"><option>Research</option><option>Environment</option></select></label><label>Password <input type="password" name="password"></label><button type="submit">Submit</button><a href="'+fixtureNext+'">Next page</a></form></body></html>';
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
    const info=await handle.evaluate(e=>({tag:e.tagName.toLowerCase(),type:e.type||'',name:e.name||'',label:e.getAttribute('aria-label')||Array.from(e.labels||[]).map(l=>{const copy=l.cloneNode(true);copy.querySelectorAll('input,textarea,select,button').forEach(n=>n.remove());return copy.textContent||''}).join(' ')||e.getAttribute('placeholder')||((e.tagName==='BUTTON'||e.tagName==='A')?e.innerText:'')||'',autocomplete:e.autocomplete||'',required:!!e.required,disabled:!!e.disabled,readOnly:!!e.readOnly,href:e.tagName==='A'?e.href:''})).catch(()=>null);
    if(!info||sensitiveField(info))continue;
    const id=randomUUID();let href=null;if(info.href)try{const u=readURL(info.href);if(u.origin===s.origin&&(!s.demo||u.href===fixtureNext||u.href===fixture))href=u.href}catch{}
    const draft=(s.demo||s.draftMode)&&canDraft(info)&&s.status===200;
    s.refs.set(id,{handle,info,href});fields.push({id,tag:info.tag,type:info.type,label:String(info.label).replace(/\s+/g,' ').trim().slice(0,160),required:info.required,draft,follow:!!href});
   }
  }finally{for(const h of nodes)if(![...s.refs.values()].some(r=>r.handle===h))await h.dispose().catch(()=>{})}
  return {session:s.id,snapshot:s.snapshot,demo:s.demo,draftMode:s.draftMode,tab:s.tabs.indexOf(s.page)+1,url:s.page.url(),title:await s.page.title(),status:s.status,outcome:pageOutcome(s.status),text:(await s.page.locator('body').innerText({timeout:5000})).slice(0,5000),elements:fields};
 }
 async function navigate(s,url){const r=await s.page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});s.status=r?.status()??null;s.statuses ||= new Map();s.statuses.set(s.page,s.status);return inspect(s)}
 async function run(id,fn){const s=lookup(id);s.active=true;try{return await fn(s)}catch(e){await close();throw e}finally{s.active=false;if(session===s)arm(s)}}
 return {
 async open(url,demo=false,draftMode=false){
  if(session)throw Error('Close current live session first');const u=readURL(demo?fixture:url);
  // Import lazily: health and invalid-input tests work without browser installation.
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true,chromiumSandbox:true,timeout:15000,env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)/i.test(k))),});
  const s={id:randomUUID(),browser,origin:u.origin,demo,draftMode,tabs:[],refs:new Map(),active:true};session=s;
  try{
   const c=await browser.newContext({acceptDownloads:false,serviceWorkers:'block',javaScriptEnabled:!demo&&!draftMode});
   await c.route('**/*',async r=>{
    if(demo){if([fixture,fixtureNext].includes(r.request().url())&&r.request().method()==='GET')return r.fulfill({status:200,contentType:'text/html',body:r.request().url()===fixture?html:'<html><title>Second page</title><body>Offline navigation successful</body></html>'});return r.abort()}
    if(!requestAllowed(r.request().url(),s.origin,r.request().method()))return r.abort();
    if(s.draftMode){try{readURL(r.request().url())}catch{return r.abort()}}
    try{const res=await r.fetch({maxRedirects:0,timeout:10000});try{if(res.status()>=300&&res.status()<400)await r.fulfill({status:403,contentType:'text/plain',body:'Redirect blocked'});else await r.fulfill({response:res})}finally{await res.dispose()}}catch{await r.abort().catch(()=>{})}
   });
   await c.routeWebSocket('**/*',ws=>ws.close());
   s.context=c;s.page=await c.newPage();s.tabs.push(s.page);c.on('page',p=>{if(!s.creating&&!s.tabs.includes(p))void p.close().catch(()=>{})});return await navigate(s,u.href);
  }catch(e){await close();throw e}finally{s.active=false;if(session===s)arm(s)}
 },
 inspect:id=>run(id,inspect),
 follow:(id,ref,element)=>run(id,async s=>{const r=findRef(ref,s.snapshot,s.refs,element);if(!r.href||s.status!==200)throw Error('Only approved links');return navigate(s,r.href)}),
 fill:(id,ref,element,value)=>run(id,async s=>{if(!(s.demo||s.draftMode)||s.status!==200)throw Error('Draft mode required');const r=findRef(ref,s.snapshot,s.refs,element);validateDraft(r.info,value);if(!await r.handle.evaluate(e=>e.isConnected&&!e.disabled&&!e.readOnly))throw Error('Field changed');if(r.info.tag==='select')await r.handle.selectOption({label:value},{timeout:5000});else await r.handle.fill(value,{timeout:5000});return inspect(s)}),
 tabs:(id)=>run(id,async s=>({session:s.id,tabs:await Promise.all(s.tabs.map(async(p,i)=>({tab:i+1,active:p===s.page,url:p.url(),title:await p.title()})))})),
 newTab:(id,ref,element)=>run(id,async s=>{
  const r=findRef(ref,s.snapshot,s.refs,element);if(!r.href||s.status!==200||s.tabs.length>=4)throw Error('Tab limit or invalid link');
  s.creating=true;try{s.page=await s.context.newPage();s.tabs.push(s.page)}finally{s.creating=false}
  return navigate(s,r.href);
 }),
 switchTab:(id,tab)=>run(id,async s=>{if(!s.tabs[tab-1])throw Error('Unknown tab');s.page=s.tabs[tab-1];s.status=s.statuses?.get(s.page)??null;return inspect(s)}),
 click:(id,ref,element)=>run(id,async s=>{
  if(!s.demo)throw Error('Button click restricted to offline demo');
  const r=findRef(ref,s.snapshot,s.refs,element);
  if(r.info.tag!=='a'||!r.href)throw Error('Only offline navigation link clicks; submit disabled');
  await Promise.all([s.page.waitForURL(r.href,{timeout:5000}),r.handle.click({timeout:5000})]);s.status=200;return inspect(s);
 }),
 review:(id)=>run(id,async s=>{
  if(!(s.demo||s.draftMode))throw Error('Draft mode required');
  const fields=await s.page.locator('input,textarea,select').evaluateAll(nodes=>nodes.filter(e=>!e.disabled&&e.type!=='hidden'&&e.getClientRects().length).map(e=>({required:e.required,filled:e.type==='checkbox'||e.type==='radio'?e.checked:!!e.value.trim(),valid:e.validity.valid})));
  return {session:s.id,demo:s.demo,fields,ready:fields.every(f=>f.valid&&(!f.required||f.filled)),submitted:false};
 }),
 capture:(id)=>run(id,async s=>{
  if(!s.demo)throw Error('Capture limited to offline fixture');
  const bytes=await s.page.screenshot({type:'jpeg',quality:55,timeout:5000});
  if(bytes.length>512000)throw Error('Capture too large');
  return {data:bytes.toString('base64'),mimeType:'image/jpeg',sha256:createHash('sha256').update(bytes).digest('hex')};
 }),
 verify:(id,ref,element,value)=>run(id,async s=>{
  if(!(s.demo||s.draftMode))throw Error('Draft mode required');
  const r=findRef(ref,s.snapshot,s.refs,element);validateDraft(r.info,value);
  const matches=await r.handle.evaluate((e,v)=>e.tagName==='SELECT'?e.selectedOptions[0]?.label===v:e.value===v,value);
  return {matches,submitted:false};
 }),
 async close(id){lookup(id);return close()}
 };
}
