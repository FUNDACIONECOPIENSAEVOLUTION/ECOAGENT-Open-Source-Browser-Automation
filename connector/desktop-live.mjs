import {randomUUID} from 'node:crypto';
import {readURL,requestAllowed,pageOutcome} from './desktop-policy.mjs';
import {canDraft,validateDraft,findRef} from './desktop-live-policy.mjs';
import {sensitiveField} from '../privacy.mjs';
import {createHash} from 'node:crypto';
const fixture='https://example.org/ecoagent-local-fixture';
const fixtureNext=fixture+'/next';
const fixtureDownload=fixture+'/document.txt';
const sampleDocument=Buffer.from('ECOAGENT synthetic document for offline testing.\n','utf8');
const sampleHash=createHash('sha256').update(sampleDocument).digest('hex');
const html='<html><head><title>ECOAGENT local form fixture</title></head><body><h1>Draft only</h1><form><label>Project <input name="project" required></label><label>Summary <textarea name="summary"></textarea></label><label>Category <select name="category"><option>Research</option><option>Environment</option></select></label><label>Accept demo <input type="checkbox" name="demoConsent"></label><label>Sample document <input type="file" name="demoDocument"></label><label>Password <input type="password" name="password"></label><button type="submit">Submit</button><a href="'+fixtureNext+'">Next page</a></form></body></html>';
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
    if(!info)continue;
    const attachment=(s.demo||s.draftMode)&&s.status===200&&info.tag==='input'&&info.type==='file'&&!info.disabled;
    if(!attachment&&sensitiveField(info))continue;
    const id=randomUUID();let href=null;if(info.href)try{const u=readURL(info.href);if(u.origin===s.origin&&(!s.demo||u.href===fixtureNext||u.href===fixture))href=u.href}catch{}
    const draft=(s.demo||s.draftMode)&&canDraft(info)&&s.status===200;
    const toggle=(s.demo||s.draftMode)&&s.status===200&&info.tag==='input'&&['checkbox','radio'].includes(info.type)&&!info.disabled&&!info.readOnly;
    s.refs.set(id,{handle,info,href});fields.push({id,tag:info.tag,type:info.type,label:String(info.label).replace(/\s+/g,' ').trim().slice(0,160),required:info.required,draft,toggle,attachment,follow:!!href});
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
   const c=await browser.newContext({acceptDownloads:demo,serviceWorkers:'block',javaScriptEnabled:!demo&&!draftMode});
   await c.route('**/*',async r=>{
    if(demo){if(r.request().url()===fixtureDownload&&r.request().method()==='GET')return r.fulfill({status:200,headers:{'content-type':'text/plain','content-disposition':'attachment; filename="ecoagent-demo.txt"'},body:sampleDocument});if([fixture,fixtureNext].includes(r.request().url())&&r.request().method()==='GET')return r.fulfill({status:200,contentType:'text/html',body:r.request().url()===fixture?html:'<html><title>Second page</title><body>Offline navigation successful</body></html>'});return r.abort()}
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
 toggle:(id,ref,element,checked)=>run(id,async s=>{
  if(!(s.demo||s.draftMode)||s.status!==200)throw Error('Static draft mode required');
  const r=findRef(ref,s.snapshot,s.refs,element);
  if(sensitiveField(r.info)||r.info.tag!=='input'||!['checkbox','radio'].includes(r.info.type)||(!checked&&r.info.type==='radio'))throw Error('Not an eligible toggle');
  const current=await r.handle.evaluate(e=>({connected:e.isConnected,type:e.type,disabled:e.disabled,readOnly:e.readOnly,checked:e.checked}));
  if(!current.connected||current.disabled||current.readOnly||current.type!==r.info.type)throw Error('Control changed');
  if(current.checked!==checked)await r.handle.click({timeout:5000});
  if(await r.handle.evaluate(e=>e.checked)!==checked)throw Error('Click did not set requested state');
  return {...await inspect(s),checked};
 }),
 attachmentTarget:(id,ref,element)=>run(id,async s=>{
  if(!(s.demo||s.draftMode)||s.status!==200)throw Error('Static draft required');
  const r=findRef(ref,s.snapshot,s.refs,element);
  if(r.info.tag!=='input'||r.info.type!=='file'||r.info.disabled||!await r.handle.evaluate(e=>e.isConnected&&e.type==='file'&&!e.disabled))throw Error('Invalid file input');
  return {session:s.id,snapshot:s.snapshot,element,url:s.page.url(),tab:s.tabs.indexOf(s.page)+1,label:String(r.info.label).trim().slice(0,160)};
 }),
 attachDocument:(id,ref,element,document)=>run(id,async s=>{
  if(!(s.demo||s.draftMode)||s.status!==200)throw Error('Static draft required');
  const r=findRef(ref,s.snapshot,s.refs,element);
  if(r.info.tag!=='input'||r.info.type!=='file'||r.info.disabled||!await r.handle.evaluate(e=>e.isConnected&&e.type==='file'&&!e.disabled))throw Error('Invalid file input');
  await r.handle.setInputFiles({name:document.name,mimeType:document.mimeType,buffer:document.buffer},{timeout:10000});
  const f=await r.handle.evaluate(e=>({count:e.files.length,name:e.files[0]?.name,size:e.files[0]?.size}));
  if(f.count!==1||f.name!==document.name||f.size!==document.size)throw Error('Attachment mismatch');
  return {attached:true,submitted:false,document:document.id,name:f.name,size:f.size,sha256:document.sha256};
 }),
 attachDemo:(id)=>run(id,async s=>{
  if(!s.demo||s.page.url()!==fixture)throw Error('Offline demo form required');
  const input=s.page.locator('input[type=file][name=demoDocument]');
  await input.setInputFiles({name:'ecoagent-demo.txt',mimeType:'text/plain',buffer:sampleDocument});
  const file=await input.evaluate(e=>({name:e.files[0]?.name,size:e.files[0]?.size,count:e.files.length}));
  if(file.count!==1||file.size!==sampleDocument.length)throw Error('Attachment verification failed');
  return {demo:true,attached:true,submitted:false,name:file.name,size:file.size,sha256:sampleHash};
 }),
 downloadDemo:(id)=>run(id,async s=>{
  if(!s.demo||s.page.url()!==fixture)throw Error('Offline demo form required');
  // The anchor is a fixed trusted test element, not supplied by the remote caller.
  await s.page.evaluate(url=>{const a=document.createElement('a');a.id='ecoagent-demo-download';a.href=url;a.textContent='Download demo document';document.body.appendChild(a)},fixtureDownload);
  const [d]=await Promise.all([s.page.waitForEvent('download',{timeout:10000}),s.page.locator('#ecoagent-demo-download').first().click({timeout:5000})]);
  try{
   const stream=await d.createReadStream();let size=0;const h=createHash('sha256');
   for await(const chunk of stream){size+=chunk.length;if(size>4096)throw Error('Demo download too large');h.update(chunk)}
   const sha256=h.digest('hex');if(sha256!==sampleHash)throw Error('Download hash mismatch');
   return {demo:true,downloaded:true,name:d.suggestedFilename(),size,sha256};
  }finally{await d.delete().catch(()=>{});await s.page.locator('#ecoagent-demo-download').first().evaluate(e=>e.remove()).catch(()=>{})}
 }),
 preview:(id)=>run(id,async s=>{
  if(!(s.demo||s.draftMode)||s.status!==200)throw Error('Static draft mode required');
  if(!s.demo)await inspect(s);
  const bytes=await s.page.screenshot({type:'jpeg',quality:50,timeout:5000,mask:[s.page.locator('input,textarea,select,[contenteditable],iframe')],maskColor:'#777777'});
  if(bytes.length>512000)throw Error('Preview too large');
  return {data:bytes.toString('base64'),mimeType:'image/jpeg',sha256:createHash('sha256').update(bytes).digest('hex')};
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
