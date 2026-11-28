import {randomUUID} from 'node:crypto';
import {classifyReadError} from './navigation-diagnostics.mjs';
import {readURL,requestAllowed,pageOutcome,safeReadRedirect} from './desktop-policy.mjs';
import {createResourceDiagnostics} from './resource-diagnostics.mjs';
import {canDraft,validateDraft,findRef,StaleReferenceError} from './desktop-live-policy.mjs';
import {sensitiveField} from '../privacy.mjs';
import {createHash} from 'node:crypto';
import {createPostPermit} from './submission-permit.mjs';
import {authEndpoint,safeAuthRedirect} from './human-auth-policy.mjs';
import {createSubmissionLedger} from './submission-ledger.mjs';
import {storeReceipt} from './receipt-store.mjs';
import {join} from 'node:path';
const fixture='https://example.org/ecoagent-local-fixture';
const fixtureNext=fixture+'/next';
const fixtureDownload=fixture+'/document.txt';
const fixtureSubmit=fixture+'/submit';
const sampleDocument=Buffer.from('ECOAGENT synthetic document for offline testing.\n','utf8');
const sampleHash=createHash('sha256').update(sampleDocument).digest('hex');
const html='<html><head><title>ECOAGENT local form fixture</title></head><body><h1>Draft only</h1><form method="post" enctype="multipart/form-data" action="'+fixtureSubmit+'"><label>Project <input name="project" required></label><label>Summary <textarea name="summary"></textarea></label><label>Category <select name="category"><option>Research</option><option>Environment</option></select></label><label>Accept demo <input type="checkbox" name="demoConsent"></label><label>Sample document <input type="file" name="demoDocument" multiple></label><label>Password <input type="password" name="password"></label><button type="submit">Submit</button><a href="'+fixtureNext+'">Next page</a></form></body></html>';
const dynamicHTML='<html><head><title>ECOAGENT dynamic fixture</title></head><body><form id="draft"><label>Project <input name="project" required></label><button type="button" id="expand">Add details</button><section id="details" hidden><label>Summary <textarea name="summary" required></textarea></label></section><button type="button" id="nextStage">Next stage</button><section id="budgetStage" hidden><label>Budget <input name="budget" type="number" min="1" required></label><button type="button" id="previousStage">Previous stage</button></section><button type="submit">Submit</button></form><script>document.getElementById("expand").addEventListener("click",()=>{document.getElementById("details").hidden=false});document.getElementById("nextStage").addEventListener("click",()=>{const f=document.getElementById("draft");const project=f.elements.project;const summary=f.elements.summary;if(!project.value.trim()||!summary.value.trim())return;document.getElementById("budgetStage").hidden=false;document.getElementById("details").hidden=true;project.closest("label").hidden=true;document.getElementById("expand").hidden=true;document.getElementById("nextStage").hidden=true});document.getElementById("previousStage").addEventListener("click",()=>{document.getElementById("budgetStage").hidden=true;document.getElementById("details").hidden=false;document.querySelector("[name=project]").closest("label").hidden=false;document.getElementById("expand").hidden=false;document.getElementById("nextStage").hidden=false});document.getElementById("draft").addEventListener("submit",e=>e.preventDefault());</script></body></html>';
export const maxTabs=80;
export function createLive(root,{ttl=300000,onClose=()=>{},visible=false,ledger=createSubmissionLedger(),approvalDeadline=()=>0}={}){
 let session=null;
 async function close(){const s=session;session=null;if(s){clearTimeout(s.timer);try{await s.browser.close().catch(()=>{})}finally{onClose(s.id)}}return {closed:!!s}}
 function arm(s){clearTimeout(s.timer);s.timer=setTimeout(()=>{if(session!==s)return;if(s.active||approvalDeadline(s.id)>Date.now())arm(s);else void close()},s.handoff?Math.max(ttl,900000):ttl);s.timer.unref()}
 function lookup(id){if(!session||session.id!==id)throw Error('Unknown live session');return session}
 async function authenticationRequired(s){
  if(s.demo)return false;
  for(const frame of s.page.frames())if(await frame.locator('input[type=password],input[autocomplete=one-time-code]').count())return true;
  return false;
 }
 async function assertSafePage(s){
  if(s.demo)return;
  const u=readURL(s.page.url());
  if(u.origin!==s.origin)throw Error('Origin changed');
  if(await authenticationRequired(s))throw new StaleReferenceError('Authentication screen; manual access required');
 }
 async function inspect(s){
  if(!s.demo){const u=readURL(s.page.url());if(u.origin!==s.origin)throw Error('Origin changed');}
  if(await authenticationRequired(s)){
   for(const r of s.refs.values())await r.handle.dispose().catch(()=>{});s.refs.clear();s.snapshot=randomUUID();s.handoff=true;
   return {session:s.id,snapshot:s.snapshot,blocked:true,reason:'authentication_required',manualRequired:true,submitted:false,elements:[]};
  }
  if(!s.humanAuth)s.handoff=false;await assertSafePage(s);
  for(const r of s.refs.values())await r.handle.dispose().catch(()=>{});s.refs.clear();s.snapshot=randomUUID();
  const fields=[];const nodes=await s.page.locator('input,textarea,select,button,a[href],img[alt],[role=button],[role=menuitem]').elementHandles();
  try{
   for(const handle of nodes.slice(0,150)){
    if(fields.length>=60||!await handle.isVisible().catch(()=>false))continue;
    const info=await handle.evaluate(e=>({tag:e.tagName.toLowerCase(),type:e.type||'',name:e.name||'',label:e.getAttribute('aria-label')||Array.from(e.labels||[]).map(l=>{const copy=l.cloneNode(true);copy.querySelectorAll('input,textarea,select,button').forEach(n=>n.remove());return copy.textContent||''}).join(' ')||e.getAttribute('placeholder')||e.getAttribute('alt')||((e.tagName==='BUTTON'||e.tagName==='A'||e.hasAttribute('role'))?e.innerText:'')||'',autocomplete:e.autocomplete||'',required:!!e.required,disabled:!!e.disabled,readOnly:!!e.readOnly,href:e.tagName==='A'?e.href:''})).catch(()=>null);
    if(!info)continue;
    const attachment=(s.demo||s.draftMode)&&s.status===200&&info.tag==='input'&&info.type==='file'&&!info.disabled;
    if(!attachment&&sensitiveField(info))continue;
    const id=randomUUID();let href=null;if(info.href)try{const u=readURL(info.href);if(u.origin===s.origin&&(!s.demo||u.href===fixtureNext||u.href===fixture))href=u.href}catch{}
    const draft=(s.demo||s.draftMode)&&canDraft(info)&&s.status===200;
    const toggle=(s.demo||s.draftMode)&&s.status===200&&info.tag==='input'&&['checkbox','radio'].includes(info.type)&&!info.disabled&&!info.readOnly;
    s.refs.set(id,{handle,info,href});fields.push({id,tag:info.tag,type:info.type,label:String(info.label).replace(/\s+/g,' ').trim().slice(0,160),required:info.required,draft,toggle,attachment,follow:!!href,inViewport:await handle.evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth}),click:!!(s.dynamicDemo&&s.page.url()===fixture&&info.tag==='button'&&info.type==='button'&&!info.disabled&&await handle.evaluate(e=>['expand','nextStage','previousStage'].includes(e.id)))});
   }
  }finally{for(const h of nodes)if(![...s.refs.values()].some(r=>r.handle===h))await h.dispose().catch(()=>{})}
  return {session:s.id,snapshot:s.snapshot,demo:s.demo,draftMode:s.draftMode,dynamicDraft:!!s.dynamicDraft,tab:s.tabs.indexOf(s.page)+1,url:s.page.url(),title:await s.page.title(),status:s.status,outcome:pageOutcome(s.status),resourceDiagnostics:s.resources.snapshot(),text:(await s.page.locator('body').innerText({timeout:5000})).slice(0,5000),elements:fields};
 }
 async function recordNavigation(s,r){s.status=r?.status()??null;s.statuses ||= new Map();s.statuses.set(s.page,s.status);return inspect(s)}
 async function navigate(s,url){const r=await s.page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});return recordNavigation(s,r)}
 async function navigationGuard(s,discard){
  if(!(s.demo||s.draftMode))return null;
  const changed=await s.page.locator('input,textarea,select').evaluateAll(nodes=>nodes.filter(e=>{
   if(e.type==='file')return e.files.length>0;
   if(['checkbox','radio'].includes(e.type))return e.checked!==e.defaultChecked;
   if(e.tagName==='SELECT')return Array.from(e.options).some(o=>o.selected!==o.defaultSelected)&&!(e.selectedIndex===0&&!Array.from(e.options).some(o=>o.defaultSelected));
   return e.value!==e.defaultValue&&typeof e.defaultValue==='string';
  }).length);
  if(changed&&!discard)return {blocked:true,reason:'unsaved_draft',changedFields:changed,session:s.id,snapshot:s.snapshot,submitted:false};
  return null;
 }
 async function submissionPlan(s,ref,element){
  await assertSafePage(s);
  if(!s.draftMode&&!s.demo||s.dynamicDraft||s.dynamicDemo||s.status!==200)throw new StaleReferenceError('Static draft required');
  const r=findRef(ref,s.snapshot,s.refs,element);
  const f=await r.handle.evaluate(async e=>{
   const form=e.form;if(!e.isConnected||e.disabled||e.type!=='submit'||!form||!form.checkValidity()||e.hasAttribute('formaction')||e.hasAttribute('formmethod')||e.hasAttribute('formenctype')||e.hasAttribute('formtarget')||form.noValidate||e.formNoValidate)return null;
   if(form.target&&form.target!=='_self')return null;
   const entries=[];for(const [key,value] of new FormData(form,e)){if(typeof value==='string')entries.push([key,value]);else{const hash=await crypto.subtle.digest('SHA-256',await value.arrayBuffer());entries.push([key,value.name,value.size,Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')]);}}
   const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(entries)));
   return {action:form.action,method:form.method,enctype:form.enctype,fieldCount:entries.length,digest:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')};
  });
  if(!f||f.method!=='post'||!['multipart/form-data','application/x-www-form-urlencoded'].includes(f.enctype)||readURL(f.action).origin!==s.origin||(s.demo&&f.action!==fixtureSubmit))throw new StaleReferenceError('Unsupported submission target');
  return {session:s.id,snapshot:s.snapshot,element,tab:s.tabs.indexOf(s.page)+1,url:s.page.url(),...f,demo:s.demo};
 }
 async function run(id,fn){const s=lookup(id);s.active=true;try{return await fn(s)}catch(e){if(!(e instanceof StaleReferenceError))await close();throw e}finally{s.active=false;if(session===s)arm(s)}}
 return {
 async open(url,demo=false,draftMode=false,dynamicDemo=false,dynamicDraft=false){
  if(session)throw Error('Close current live session first');const u=readURL(demo?fixture:url);
  // Import lazily: health and invalid-input tests work without browser installation.
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:!visible,chromiumSandbox:true,timeout:15000,env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)/i.test(k))),});
  const s={id:randomUUID(),browser,origin:u.origin,demo,draftMode,dynamicDemo:demo&&dynamicDemo,dynamicDraft:!demo&&draftMode&&dynamicDraft,tabs:[],refs:new Map(),active:true,resources:createResourceDiagnostics()};session=s;
  try{
   const c=await browser.newContext({acceptDownloads:demo,serviceWorkers:'block',javaScriptEnabled:s.dynamicDemo||s.dynamicDraft||(!demo&&!draftMode)});
   await c.route('**/*',async r=>{
    const req=r.request();
    if(s.humanAuth&&Date.now()<s.humanAuth.expires&&s.humanAuth.permit.consume({url:req.url(),method:req.method(),main:req.isNavigationRequest()&&req.frame()===s.page.mainFrame()})){
     try{
      const res=await r.fetch({maxRedirects:0,maxRetries:0,timeout:15000});
      try{
       const status=res.status();
       if(status>=300&&status<400){
        const next=safeAuthRedirect(res.headers().location,req.url(),status);
        if(!next)return await r.fulfill({status:409,contentType:'text/plain',body:'Authentication redirect requires manual review'});
        return await r.fulfill({response:res});
       }
       return await r.fulfill({response:res});
      }finally{await res.dispose()}
     }catch{await r.abort().catch(()=>{});return}
    }
    if(s.localInteraction&&!demo){s.localInteraction.blocked++;return r.abort()}
    if(s.postPermit?.consume({url:req.url(),method:req.method(),main:req.isNavigationRequest()&&req.frame()===s.page.mainFrame()})){
     if(demo){s.postStatus=200;return r.fulfill({status:200,contentType:'text/html',body:'<html><title>Synthetic receipt</title><body>OFFLINE TEST ONLY <a href="'+fixtureDownload+'">Download synthetic receipt</a></body></html>'})}
     try{const res=await r.fetch({maxRedirects:0,maxRetries:0,timeout:15000});try{s.postStatus=res.status();if(res.status()>=300&&res.status()<400)return r.fulfill({status:409,contentType:'text/plain',body:'Submission response redirect requires manual review'});return await r.fulfill({response:res})}finally{await res.dispose()}}catch{await r.abort().catch(()=>{});return}
    }
    if(demo){if(r.request().url()===fixtureDownload&&r.request().method()==='GET')return r.fulfill({status:200,headers:{'content-type':'text/plain','content-disposition':'attachment; filename="ecoagent-demo.txt"'},body:sampleDocument});if([fixture,fixtureNext].includes(r.request().url())&&r.request().method()==='GET')return r.fulfill({status:200,contentType:'text/html',body:r.request().url()===fixture?(s.dynamicDemo?dynamicHTML:html):'<html><title>Second page</title><body>Offline navigation successful</body></html>'});return r.abort()}
    if(!requestAllowed(req.url(),s.origin,req.method())){s.resources.record('policy_block',req.resourceType());return r.abort()}
    if(s.draftMode){try{readURL(req.url())}catch{s.resources.record('draft_url_block',req.resourceType());return r.abort()}}
    try{const res=await r.fetch({maxRedirects:0,maxRetries:0,timeout:15000});try{if(res.status()>=300&&res.status()<400&&res.status()!==304){const next=safeReadRedirect(res.headers().location,req.url(),s.origin,res.status(),req.method());if(!next){s.resources.record('redirect_block',req.resourceType());return await r.fulfill({status:403,contentType:'text/plain',body:'Read redirect blocked by origin or URL policy'})}let hops=0;for(let prev=req.redirectedFrom();prev;prev=prev.redirectedFrom())hops++;if(hops>=4)return await r.fulfill({status:508,contentType:'text/plain',body:'Read redirect limit reached'});return await r.fulfill({response:res,headers:{...res.headers(),location:next}})}return await r.fulfill({response:res})}finally{await res.dispose()}}catch(error){s.resources.record('upstream_error',req.resourceType());if(req.isNavigationRequest()){const diagnostic=classifyReadError(error);await r.fulfill({status:diagnostic==='upstream_timeout'?504:502,contentType:'text/plain',body:'ECOAGENT read diagnostic: '+diagnostic}).catch(()=>r.abort().catch(()=>{}))}else await r.abort().catch(()=>{})}
   });
   await c.routeWebSocket('**/*',ws=>ws.close());
   s.context=c;s.page=await c.newPage();s.tabs.push(s.page);c.on('page',p=>{if(!s.creating&&!s.tabs.includes(p))void p.close().catch(()=>{})});return await navigate(s,u.href);
  }catch(e){await close();throw e}finally{s.active=false;if(session===s)arm(s)}
 },
 humanTake:(id)=>run(id,async s=>{
  if(!visible)throw new StaleReferenceError('Visible browser required');
  if(!s.demo&&await authenticationRequired(s)){
   const forms=await s.page.locator('form').evaluateAll(nodes=>nodes.filter(f=>f.querySelector('input[type=password],input[autocomplete=one-time-code]')).map(f=>({action:f.action,method:f.method,target:f.target,override:!!f.querySelector('[formaction],[formmethod],[formtarget]')})));
   if(forms.length!==1)throw new StaleReferenceError('One native authentication form required');
   const endpoint=authEndpoint(forms[0],s.origin);
   s.humanAuth={permit:createPostPermit(endpoint),expires:Date.now()+120000};
  }
  s.handoff=true;await s.page.bringToFront();return {humanReady:true,authenticationPermit:!!s.humanAuth};
 }),
 humanRelease:(id)=>run(id,async s=>{
  s.humanAuth=null;
  if(await authenticationRequired(s))return {blocked:true,reason:'authentication_required'};
  const state=await inspect(s);s.handoff=false;return state;
 }),
 current:()=>session?{session:session.id,tab:session.tabs.indexOf(session.page)+1,demo:session.demo,draftMode:session.draftMode,handoff:!!session.handoff,visible}:null,
 inspect:id=>run(id,inspect),
 locate:(id,query)=>run(id,async s=>{
  await assertSafePage(s);
  if(s.status!==200)return {blocked:true,reason:'page_unavailable',session:s.id};
  const needle=String(query).trim().toLowerCase();
  if(!needle||needle.length>160)throw new StaleReferenceError('Invalid search');
  const matches=await s.page.locator('a[href],button,input,textarea,select,[role=button],[role=menuitem],img[alt],h1,h2,h3,label').evaluateAll((nodes,q)=>nodes.flatMap(e=>{
   if(!e.getClientRects().length||e.closest('[hidden]')||e.matches('input[type=password],input[type=hidden],input[autocomplete=one-time-code]'))return [];
   const label=(e.getAttribute('aria-label')||e.getAttribute('alt')||e.getAttribute('placeholder')||Array.from(e.labels||[]).map(l=>l.textContent||'').join(' ')||((e.matches('input,textarea,select'))?'':e.innerText)||'').trim().replace(/\s+/g,' ').slice(0,160);
   if(!label.toLowerCase().includes(q))return [];
   const r=e.getBoundingClientRect();return [{label,tag:e.tagName.toLowerCase(),inViewport:r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth}];
  }).slice(0,40),needle);
  // Search only approved navigation links; keep other matches informational.
  // Refresh references on each search so no stale handles survive.
  const fresh=await inspect(s);
  if(fresh.blocked)return fresh;
  const links=await s.page.locator('a[href]').elementHandles();
  const retained=new Set();const actionable=[];
  try{
   for(const handle of links.slice(0,1000)){
    if(actionable.length>=40)break;
    if(!await handle.isVisible().catch(()=>false))continue;
    const info=await handle.evaluate(e=>({tag:'a',type:'',name:'',label:(e.getAttribute('aria-label')||e.innerText||e.querySelector('img[alt]')?.alt||'').trim().replace(/\s+/g,' ').slice(0,160),href:e.href,download:e.hasAttribute('download')})).catch(()=>null);
    if(!info||info.download||!info.label.toLowerCase().includes(needle)||sensitiveField(info))continue;
    let href;try{const u=readURL(info.href);if(u.origin!==s.origin||(s.demo&&![fixture,fixtureNext].includes(u.href)))continue;href=u.href}catch{continue}
    const ref=randomUUID();s.refs.set(ref,{handle,info,href});retained.add(handle);
    actionable.push({id:ref,label:info.label,tag:'a',follow:true,inViewport:await handle.evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth})});
   }
  }finally{for(const h of links)if(!retained.has(h))await h.dispose().catch(()=>{})}
  return {session:s.id,snapshot:s.snapshot,matches,actionable,truncated:matches.length===40||actionable.length===40||links.length>1000};
 }),
 reveal:(id,ref,element)=>run(id,async s=>{
  await assertSafePage(s);
  if(s.status!==200)return {blocked:true,reason:'page_unavailable',session:s.id};
  const r=findRef(ref,s.snapshot,s.refs,element);
  if(!await r.handle.isVisible())throw new StaleReferenceError('Element not visible');
  await r.handle.scrollIntoViewIfNeeded({timeout:5000});
  return {...await inspect(s),revealed:true,submitted:false};
 }),
 scroll:(id,direction,amount)=>run(id,async s=>{
  await assertSafePage(s);
  if(s.status!==200)return {blocked:true,reason:'page_unavailable',session:s.id};
  if(!['up','down','top','bottom'].includes(direction)||!Number.isInteger(amount)||amount<100||amount>2000)throw new StaleReferenceError('Invalid scroll');
  const position=await s.page.evaluate(({direction,amount})=>{
   const root=document.scrollingElement||document.documentElement;
   const before=root.scrollTop;
   const target=direction==='top'?0:direction==='bottom'?root.scrollHeight:before+(direction==='up'?-amount:amount);
   root.scrollTop=target;
   return {before,y:root.scrollTop,height:root.scrollHeight,viewport:root.clientHeight};
  },{direction,amount});
  return {...await inspect(s),position,submitted:false};
 }),
 clickLink:(id,ref,element)=>run(id,async s=>{
  await assertSafePage(s);
  const r=findRef(ref,s.snapshot,s.refs,element);
  if(s.status!==200||r.info.tag!=='a'||!r.href)throw new StaleReferenceError('Only inspected approved navigation links');
  const blocked=await navigationGuard(s,false);if(blocked)return blocked;
  if(!await r.handle.evaluate((e,url)=>e.isConnected&&e.tagName==='A'&&e.href===url&&!e.hasAttribute('download'),r.href))throw new StaleReferenceError('Link changed');
  return {...await navigate(s,r.href),submitted:false};
 }),
 reload:(id,discard=false)=>run(id,async s=>{
  const blocked=await navigationGuard(s,discard);if(blocked)return blocked;
  const u=readURL(s.page.url());if(u.origin!==s.origin)throw Error('Origin changed');
  const r=await s.page.reload({waitUntil:'domcontentloaded',timeout:20000});return {...await recordNavigation(s,r),reloaded:true,submitted:false};
 }),
 history:(id,direction,discard=false)=>run(id,async s=>{
  const blocked=await navigationGuard(s,discard);if(blocked)return blocked;
  if(!['back','forward'].includes(direction))throw Error('Invalid history direction');
  const r=await (direction==='back'?s.page.goBack({waitUntil:'domcontentloaded',timeout:20000}):s.page.goForward({waitUntil:'domcontentloaded',timeout:20000}));
  const u=readURL(s.page.url());if(u.origin!==s.origin)throw Error('Origin changed');
  if(!r)return {...await inspect(s),history:direction,navigationConfirmed:false,submitted:false};
  return {...await recordNavigation(s,r),history:direction,navigationConfirmed:true,submitted:false};
 }),
 follow:(id,ref,element)=>run(id,async s=>{
  await assertSafePage(s);
  const r=findRef(ref,s.snapshot,s.refs,element);
  if(!r.href||s.status!==200)throw new StaleReferenceError('Only approved links');
  if(!await r.handle.evaluate((e,url)=>e.isConnected&&e.tagName==='A'&&e.href===url&&!e.hasAttribute('download'),r.href))throw new StaleReferenceError('Link changed');
  const blocked=await navigationGuard(s,false);
  if(blocked)return blocked;
  return navigate(s,r.href);
 }),
 fill:(id,ref,element,value)=>run(id,async s=>{if(!(s.demo||s.draftMode)||s.status!==200)throw new StaleReferenceError('Draft mode required');await assertSafePage(s);const r=findRef(ref,s.snapshot,s.refs,element);validateDraft(r.info,value);if(!await r.handle.evaluate(e=>e.isConnected&&!e.disabled&&!e.readOnly))throw Error('Field changed');if(r.info.tag==='select')await r.handle.selectOption({label:value},{timeout:5000});else await r.handle.fill(value,{timeout:5000});return inspect(s)}),
 tabs:(id)=>run(id,async s=>({session:s.id,tabs:await Promise.all(s.tabs.map(async(p,i)=>({tab:i+1,active:p===s.page,url:p.url(),title:await p.title()})))})),
 newTab:(id,ref,element)=>run(id,async s=>{
  const r=findRef(ref,s.snapshot,s.refs,element);if(!r.href||s.status!==200)throw new StaleReferenceError('Invalid link');
  if(s.tabs.length>=maxTabs)return {blocked:true,reason:'tab_limit',limit:maxTabs,session:s.id,snapshot:s.snapshot};
  s.creating=true;try{s.page=await s.context.newPage();s.tabs.push(s.page)}finally{s.creating=false}
  return navigate(s,r.href);
 }),
 switchTab:(id,tab)=>run(id,async s=>{if(!s.tabs[tab-1])throw new StaleReferenceError('Unknown tab');s.page=s.tabs[tab-1];if(visible)await s.page.bringToFront();s.status=s.statuses?.get(s.page)??null;return inspect(s)}),
 closeTab:(id,tab)=>run(id,async s=>{
  if(!s.tabs[tab-1])throw new StaleReferenceError('Unknown tab');
  if(s.tabs.length===1)return {blocked:true,reason:'last_tab',session:s.id};
  const previous=s.page,target=s.tabs[tab-1];s.page=target;
  try{const blocked=await navigationGuard(s,false);if(blocked)return {...blocked,tab}}finally{s.page=previous}
  await target.close();s.tabs.splice(tab-1,1);s.statuses?.delete(target);
  if(previous===target)s.page=s.tabs[Math.min(tab-1,s.tabs.length-1)];
  s.status=s.statuses?.get(s.page)??null;
  return {...await inspect(s),closedTab:tab};
 }),
 click:(id,ref,element)=>run(id,async s=>{
  if(!s.demo)throw Error('Button click restricted to offline demo');
  const r=findRef(ref,s.snapshot,s.refs,element);
  if(s.dynamicDemo&&s.page.url()===fixture&&r.info.tag==='button'&&r.info.type==='button'&&await r.handle.evaluate(e=>e.isConnected&&['expand','nextStage','previousStage'].includes(e.id)&&e.type==='button'&&!e.disabled)){
   await r.handle.click({timeout:5000});return {...await inspect(s),submitted:false};
  }
  if(r.info.tag!=='a'||!r.href)throw Error('Only offline navigation link clicks or fixed dynamic demo button; submit disabled');
  const blocked=await navigationGuard(s,false);
  if(blocked)return blocked;
  await Promise.all([s.page.waitForURL(r.href,{timeout:5000}),r.handle.click({timeout:5000})]);s.status=200;s.statuses.set(s.page,200);return inspect(s);
 }),
 dynamicControlPlan:(id,ref,element)=>run(id,async s=>{
  await assertSafePage(s);
  if(!(s.dynamicDraft||s.dynamicDemo)||s.status!==200)throw new StaleReferenceError('Dynamic draft required');
  const r=findRef(ref,s.snapshot,s.refs,element);
  if(r.info.tag!=='button'||r.info.type!=='button'||!await r.handle.isVisible())throw new StaleReferenceError('Explicit non-submit button required');
  const info=await r.handle.evaluate(e=>({valid:e.isConnected&&!e.disabled&&e.type==='button'&&!e.hasAttribute('formaction')&&!e.hasAttribute('formmethod')&&!e.hasAttribute('formtarget'),label:(e.getAttribute('aria-label')||e.innerText||'').trim().slice(0,160)}));
  if(!info.valid||!info.label)throw new StaleReferenceError('Button unavailable');
  return {session:s.id,snapshot:s.snapshot,element,tab:s.tabs.indexOf(s.page)+1,url:s.page.url(),label:info.label,demo:s.demo};
 }),
 dynamicControlClick:(id,ref,element,expected)=>run(id,async s=>{
  await assertSafePage(s);
  if(!(s.dynamicDraft||s.dynamicDemo)||s.status!==200)throw new StaleReferenceError('Dynamic draft required');
  const r=findRef(ref,s.snapshot,s.refs,element);
  const valid=await r.handle.evaluate((e,label)=>e.isConnected&&!e.disabled&&e.tagName==='BUTTON'&&e.type==='button'&&!e.hasAttribute('formaction')&&!e.hasAttribute('formmethod')&&!e.hasAttribute('formtarget')&&(e.getAttribute('aria-label')||e.innerText||'').trim().slice(0,160)===label,expected.label);
  if(!valid||expected.session!==s.id||expected.snapshot!==s.snapshot||expected.element!==element||expected.url!==s.page.url()||expected.tab!==s.tabs.indexOf(s.page)+1)throw new StaleReferenceError('Control changed');
  const before=s.page.url();s.localInteraction={blocked:0};
  let blocked=0;
  try{await r.handle.click({timeout:5000});await s.page.waitForTimeout(300);if(s.page.url()!==before)throw new StaleReferenceError('Unexpected navigation');blocked=s.localInteraction.blocked}
  finally{s.localInteraction=null}
  return {...await inspect(s),networkRequestsBlocked:blocked,externalActionConfirmed:false,submitted:false};
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
  return {session:s.id,snapshot:s.snapshot,element,url:s.page.url(),tab:s.tabs.indexOf(s.page)+1,label:String(r.info.label).trim().slice(0,160),existingFiles:await r.handle.evaluate(e=>e.files.length),multiple:await r.handle.evaluate(e=>e.multiple),accept:await r.handle.evaluate(e=>e.accept)};
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
 attachDocuments:(id,ref,element,documents)=>run(id,async s=>{
  await assertSafePage(s);
  if(!(s.demo||s.draftMode)||s.status!==200)throw new StaleReferenceError('Draft required');
  const r=findRef(ref,s.snapshot,s.refs,element);
  if(r.info.tag!=='input'||r.info.type!=='file'||!Array.isArray(documents)||documents.length<1||documents.length>4)throw new StaleReferenceError('Invalid attachment');
  const state=await r.handle.evaluate(e=>({valid:e.isConnected&&e.type==='file'&&!e.disabled,multiple:e.multiple,count:e.files.length}));
  if(!state.valid||(documents.length>1&&!state.multiple)||state.count)throw new StaleReferenceError('Input unavailable, single-file only or already populated');
  await r.handle.setInputFiles(documents.map(d=>({name:d.name,mimeType:d.mimeType,buffer:d.buffer})),{timeout:10000});
  const files=await r.handle.evaluate(async e=>Promise.all(Array.from(e.files,async f=>{
   const digest=await crypto.subtle.digest('SHA-256',await f.arrayBuffer());
   return {name:f.name,size:f.size,sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')};
  })));
  if(files.length!==documents.length||files.some((f,i)=>f.name!==documents[i].name||f.size!==documents[i].size||f.sha256!==documents[i].sha256))throw Error('Attachment verification failed');
  return {attached:true,files,submitted:false,externalUploadConfirmed:false};
 }),
 submissionPlan:(id,ref,element)=>run(id,s=>submissionPlan(s,ref,element)),
 submitForm:(id,ref,element,expected)=>run(id,async s=>{
  const plan=await submissionPlan(s,ref,element);if(JSON.stringify(plan)!==JSON.stringify(expected))throw new StaleReferenceError('Form changed');
  const r=findRef(ref,s.snapshot,s.refs,element);
  const entry=ledger.reserve(plan);
  s.postPermit=createPostPermit(plan.action);s.postStatus=null;
  try{await r.handle.click({timeout:15000});await s.page.waitForLoadState('domcontentloaded',{timeout:15000})}catch{}finally{
   const attempted=s.postPermit.used();s.postPermit=null;
   s.lastSubmission=ledger.record(entry.id,{attempted,httpStatus:s.postStatus});
   s.status=s.postStatus;s.statuses?.set(s.page,s.status);
  }
  return s.lastSubmission;
 }),
 submissionEvidence:(id)=>run(id,async s=>{
  if(!s.lastSubmission)throw new StaleReferenceError('No submission attempt');
  const entry=s.lastSubmission;
  if(!entry.attempted||entry.httpStatus===null)return {...entry,evidenceAvailable:false};
  await assertSafePage(s);
  const url=readURL(s.page.url());if(url.href!==entry.endpoint)return {...entry,evidenceAvailable:false,reason:'page_changed'};
  const title=(await s.page.title()).slice(0,300);
  const body=(await s.page.locator('body').innerText({timeout:5000})).slice(0,12000);
  return {...entry,evidenceAvailable:true,title,text:body,evidenceSHA256:createHash('sha256').update(JSON.stringify([url.href,title,body])).digest('hex'),confirmed:false,submitted:false};
 }),
 receiptDownload:(id,ref,element)=>run(id,async s=>{
  await assertSafePage(s);
  const entry=s.lastSubmission;
  if(!entry?.attempted||entry.httpStatus<200||entry.httpStatus>=300||s.page.url()!==entry.endpoint)throw new StaleReferenceError('Current response required');
  const r=findRef(ref,s.snapshot,s.refs,element);
  if(r.info.tag!=='a'||!await r.handle.isVisible())throw new StaleReferenceError('Visible receipt link required');
  const href=await r.handle.evaluate(e=>e.href);
  const u=readURL(href);
  if(u.origin!==s.origin||s.demo&&u.href!==fixtureDownload)throw new StaleReferenceError('Receipt origin not approved');
  if(s.demo)return storeReceipt({entry,url:u.href,bytes:sampleDocument,mime:'text/plain',demo:true});
  const response=await s.context.request.get(u.href,{maxRedirects:0,maxRetries:0,timeout:10000});
  try{
   if(response.status()!==200)throw new StaleReferenceError('Receipt unavailable');
   const headers=response.headers(),length=Number(headers['content-length']);
   if(!Number.isSafeInteger(length)||length<1||length>10*1024*1024||headers['content-encoding'])throw new StaleReferenceError('Receipt requires bounded uncompressed response');
   const bytes=await response.body();
   if(bytes.length!==length)throw new StaleReferenceError('Receipt length mismatch');
   return storeReceipt({entry,url:u.href,bytes,mime:headers['content-type'],directory:join(root,'local-config','receipts')});
  }finally{await response.dispose()}
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
  if(s.status!==200)throw new StaleReferenceError('Page unavailable');
  await assertSafePage(s);
  const bytes=await s.page.screenshot({type:'jpeg',quality:50,timeout:5000,mask:[s.page.locator('input,textarea,select,[contenteditable],iframe,[role=textbox]')],maskColor:'#777777'});
  if(bytes.length>512000)throw Error('Preview too large');
  return {data:bytes.toString('base64'),mimeType:'image/jpeg',sha256:createHash('sha256').update(bytes).digest('hex')};
 }),
 review:(id)=>run(id,async s=>{
  if(!(s.demo||s.draftMode))throw Error('Draft mode required');
  const fields=await s.page.locator('input,textarea,select').evaluateAll((nodes,dynamic)=>nodes.filter(e=>!e.disabled&&e.type!=='hidden'&&(dynamic||e.getClientRects().length)).map(e=>({required:e.required,filled:e.type==='checkbox'||e.type==='radio'?e.checked:!!e.value.trim(),valid:e.validity.valid})),s.dynamicDemo);
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
