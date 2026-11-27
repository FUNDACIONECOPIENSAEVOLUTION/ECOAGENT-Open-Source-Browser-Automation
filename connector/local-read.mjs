import {chromium} from 'playwright';
import {readURL,requestAllowed,cleanLinks} from './desktop-policy.mjs';
const u=readURL(process.argv[2]||'');
const b=await chromium.launch({headless:true,chromiumSandbox:true});
try{
 const c=await b.newContext({acceptDownloads:false,serviceWorkers:'block'});
 await c.route('**/*',r=>requestAllowed(r.request().url(),u.origin,r.request().method())?r.continue():r.abort());
 await c.routeWebSocket('**/*',ws=>ws.close());
 const p=await c.newPage();c.on('page',other=>{if(other!==p)other.close().catch(()=>{})});
 const response=await p.goto(u.href,{waitUntil:'domcontentloaded',timeout:20000});
 const final=readURL(p.url());if(final.origin!==u.origin)throw Error('Origin blocked');
 if(await p.locator('input[type=password],input[autocomplete=one-time-code]').count())throw Error('Authentication not supported');
 const links=await p.locator('a[href]').evaluateAll(nodes=>nodes.slice(0,500).map(a=>({url:a.href,label:a.innerText||a.getAttribute('aria-label')||''})));
 console.log(JSON.stringify({url:final.href,status:response?.status()??null,title:await p.title(),text:(await p.locator('body').innerText({timeout:5000})).slice(0,10000),links:cleanLinks(links,u.origin),truncated:true},null,2));
}finally{await b.close()}
