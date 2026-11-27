import {chromium} from 'playwright';
import {readURL,requestAllowed,cleanLinks,pageOutcome,cleanFields} from './desktop-policy.mjs';
const u=readURL(process.argv[2]||'');
const b=await chromium.launch({headless:true,chromiumSandbox:true});
try{
 const c=await b.newContext({acceptDownloads:false,serviceWorkers:'block'});
 // Intercept redirects before Chromium can request a new origin. No automatic redirect following.
 await c.route('**/*',async r=>{
  if(!requestAllowed(r.request().url(),u.origin,r.request().method()))return r.abort();
  try{
   const res=await r.fetch({maxRedirects:0,timeout:15000});
   if(res.status()>=300&&res.status()<400){await r.fulfill({status:403,contentType:'text/plain',body:'Redirect blocked by ECOAGENT policy'});}
   else await r.fulfill({response:res});
   await res.dispose();
  }catch{await r.abort().catch(()=>{})}
 });
 await c.routeWebSocket('**/*',ws=>ws.close());
 const p=await c.newPage();c.on('page',other=>{if(other!==p)other.close().catch(()=>{})});
 const response=await p.goto(u.href,{waitUntil:'domcontentloaded',timeout:20000});
 const final=readURL(p.url());if(final.origin!==u.origin)throw Error('Origin blocked');
 if(await p.locator('input[type=password],input[autocomplete=one-time-code]').count())throw Error('Authentication not supported');
 const links=await p.locator('a[href]').evaluateAll(nodes=>nodes.slice(0,500).map(a=>({url:a.href,label:a.innerText||a.getAttribute('aria-label')||''})));
 const status=response?.status()??null;
 const body=await p.locator('body').innerText({timeout:5000});
 const fields=await p.locator('input,textarea,select,button').evaluateAll(nodes=>nodes.slice(0,100).filter(e=>e.getClientRects().length>0).map(e=>({tag:e.tagName.toLowerCase(),type:e.type,label:e.getAttribute('aria-label')||Array.from(e.labels||[]).map(l=>l.innerText).join(' ')||e.getAttribute('placeholder')||(e.tagName==='BUTTON'?e.innerText:'')||'',required:e.required,disabled:e.disabled})));
 console.log(JSON.stringify({url:final.href,status,outcome:pageOutcome(status),title:await p.title(),text:body.slice(0,10000),links:cleanLinks(links,u.origin),fields:cleanFields(fields),truncated:body.length>10000||links.length>80||fields.length>80},null,2));
}finally{await b.close()}
