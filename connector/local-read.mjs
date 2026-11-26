import {chromium} from 'playwright';
const u=new URL(process.argv[2]||'');
if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.origin!=='https://example.org')throw Error('Preview only permits https://example.org without query or credentials');
const b=await chromium.launch({headless:true,chromiumSandbox:true});
try{
 const c=await b.newContext({acceptDownloads:false,serviceWorkers:'block'});
 await c.route('**/*',r=>{const t=new URL(r.request().url());return t.origin===u.origin&&['GET','HEAD'].includes(r.request().method())?r.continue():r.abort()});
 await c.routeWebSocket('**/*',ws=>ws.close());
 const p=await c.newPage();c.on('page',other=>{if(other!==p)other.close().catch(()=>{})});
 await p.goto(u.href,{waitUntil:'domcontentloaded',timeout:20000});
 if(new URL(p.url()).origin!==u.origin)throw Error('Origin blocked');
 if(await p.locator('input[type=password],input[autocomplete=one-time-code]').count())throw Error('Authentication not supported');
 console.log(JSON.stringify({url:new URL(p.url()).origin+new URL(p.url()).pathname,title:await p.title(),text:(await p.locator('body').innerText({timeout:5000})).slice(0,4000)},null,2));
}finally{await b.close()}
