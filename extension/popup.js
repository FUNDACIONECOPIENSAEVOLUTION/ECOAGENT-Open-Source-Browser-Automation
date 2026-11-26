// activeTab grants access only after the user opens the extension on a tab.
const $=id=>document.getElementById(id);
let tabId=null, snapshot=null,busy=false;
async function active(){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id||!/^https?:/.test(tab.url||''))throw Error('Abra una pestaña HTTP(S) normal.');return tab}
async function operate(op,arg){
 const tab=await active();
 if(tabId!==tab.id){snapshot=null;tabId=tab.id}
 const [r]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:pageOperation,args:[op,arg||{}]});
 return r.result;
}
// Isolated world; no access to Chrome password store, cookies API or storage API.
function pageOperation(op,arg){
 const sensitive=e=>{const t=(e.getAttribute('type')||'').toLowerCase(),a=e.getAttribute('autocomplete')||'',n=[e.name,e.id,e.getAttribute('aria-label'),e.placeholder,...Array.from(e.labels||[]).map(l=>l.innerText)].join(' ');return /password|hidden|file/i.test(t)||/password|username|one-time-code|cc-|webauthn/i.test(a)||/password|passwd|contrase|otp|secret|token|verification.code|security.code|c[oó]digo de verificaci[oó]n|pin.code/i.test(n)};
 const authPage=()=>!!document.querySelector('input[type=password],input[autocomplete=one-time-code],input[autocomplete=current-password],input[autocomplete=new-password]');
 const visible=e=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
 const label=e=>(e.getAttribute('aria-label')||Array.from(e.labels||[]).map(l=>l.innerText).join(' ')||e.placeholder||e.innerText||e.name||'').trim().slice(0,160);
 if(authPage())return {ok:false,error:'Página de autenticación: usa Chrome manualmente y vuelve a inspeccionar.'};
 if(op==='inspect'){
  const elements=Array.from(document.querySelectorAll('a[href],button,input,textarea,select,[role=button]')).filter(e=>visible(e)&&!sensitive(e)).slice(0,100);
  const nonce=crypto.randomUUID();globalThis.__ecoagent={nonce,elements};
  return {ok:true,nonce,origin:location.origin,elements:elements.map((e,id)=>({id,tag:e.tagName.toLowerCase(),type:e.type||'',label:label(e)}))};
 }
 const state=globalThis.__ecoagent;
 if(!state||state.nonce!==arg.nonce||!Number.isInteger(arg.id))return {ok:false,error:'Inspección caducada'};
 const e=state.elements[arg.id];
 if(!e||!e.isConnected||!visible(e)||sensitive(e))return {ok:false,error:'Elemento no disponible'};
 if(op==='click'){if(arg.label!==label(e))return {ok:false,error:'El elemento cambió; inspecciona otra vez.'};globalThis.__ecoagent=null;e.click();return {ok:true}}
 if(op==='fill'){
  if(typeof arg.value!=='string'||arg.value.length>8000||!['INPUT','TEXTAREA','SELECT'].includes(e.tagName)||e.disabled||e.readOnly)return {ok:false,error:'Campo no editable'};
  if(e.tagName==='SELECT'){const option=Array.from(e.options).find(o=>o.label===arg.value||o.value===arg.value);if(!option)return {ok:false,error:'Opción no encontrada'};e.value=option.value}
  else {if(!['text','email','tel','url','number','search','date','textarea'].includes(e.type))return {ok:false,error:'Tipo no admitido'};const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,arg.value)}
  e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return {ok:true};
 }
 return {ok:false,error:'Operación no admitida'};
}
function render(data){snapshot=data.ok?data:null;$('elements').replaceChildren();if(!snapshot)return;
 for(const e of data.elements){const d=document.createElement('div');d.className='item';const t=document.createElement('div');t.textContent=e.id+' · '+e.tag+' · '+e.label;d.append(t);
 const b=document.createElement('button');b.textContent='Clic';b.onclick=()=>run([{op:'click',id:e.id}]);d.append(b);
 if(['input','textarea','select'].includes(e.tag)){const i=document.createElement('input');i.placeholder='Valor autorizado';d.append(i);const f=document.createElement('button');f.textContent='Diligenciar';f.onclick=()=>run([{op:'fill',id:e.id,value:i.value}]);d.append(f)}
 $('elements').append(d)}
}
async function run(steps){if(busy)return;busy=true;try{if(!Array.isArray(steps)||steps.length<1||steps.length>20)throw Error('Lote de 1 a 20 pasos');const results=[];
 for(const a of steps){if(!['inspect','fill','click'].includes(a.op))throw Error('Operación no permitida');if(a.op==='inspect'){const r=await operate('inspect');render(r);results.push(r);if(!r.ok)break;continue}
 const tab=await active();if(tab.id!==tabId||!snapshot)throw Error('Inspecciona primero la pestaña actual');const e=snapshot.elements.find(e=>e.id===a.id);if(!e)throw Error('ID inválido');
 if(!confirm('Autorizar '+a.op+' en '+snapshot.origin+'\n'+e.label))break;
 const r=await operate(a.op,{id:a.id,nonce:snapshot.nonce,label:e.label,value:a.value});results.push(r);if(a.op==='click'){snapshot=null;$('elements').replaceChildren()}if(!r.ok)break;
 }$('result').textContent=JSON.stringify(results,null,2);$('status').textContent='Lote terminado; verifica cada resultado.';
 }catch(e){$('status').textContent=e.message}finally{busy=false}}
$('inspect').onclick=()=>run([{op:'inspect'}]);$('run').onclick=()=>{try{run(JSON.parse($('batch').value).steps)}catch(e){$('status').textContent=e.message}};

async function bridge(path,method='GET',body){
 const r=await fetch('http://127.0.0.1:8791'+path,{method,headers:{Authorization:'Bearer '+$('operatorKey').value,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(d.error||'Error de puente');return d;
}
async function loadJobs(){try{const d=await bridge('/v1/pending');$('jobs').replaceChildren();for(const j of d.jobs){
 const item=document.createElement('div');item.className='item';const t=document.createElement('pre');t.textContent=JSON.stringify({origin:j.origin,steps:j.steps},null,2);item.append(t);
 const accept=document.createElement('button');accept.textContent='Revisar y ejecutar';accept.onclick=()=>executeJob(j);item.append(accept);
 const reject=document.createElement('button');reject.textContent='Rechazar';reject.onclick=async()=>{try{await bridge('/v1/jobs/'+j.id+'/reject','POST');await loadJobs()}catch(e){$('status').textContent=e.message}};item.append(reject);$('jobs').append(item)
 }if(!d.jobs.length)$('status').textContent='Sin solicitudes pendientes';}catch(e){$('status').textContent=e.message}}
async function executeJob(j){
 if(busy)return;busy=true;let claimed=false,results=[],status='completed';
 try{
 const tab=await active();const target=tab.id;if(new URL(tab.url).origin!==j.origin)throw Error('Abre el origen exacto de la solicitud');
 if(!confirm('¿Ejecutar solicitud en '+j.origin+'? Revisa cada acción.'))return;
 await bridge('/v1/jobs/'+j.id+'/claim','POST');claimed=true;
 for(const a of j.steps){
 const current=await active();if(current.id!==target||new URL(current.url).origin!==j.origin)throw Error('La pestaña u origen cambió');
 const snap=await operate('inspect');if(!snap.ok||snap.origin!==j.origin)throw Error(snap.error||'Origen no coincide');
 if(a.op==='inspect'){results.push({op:'inspect',elements:snap.elements});continue}
 const matches=snap.elements.filter(e=>e.label===a.label);if(matches.length!==1)throw Error('Etiqueta ausente o ambigua: '+a.label);
 if(!confirm('Autorizar '+a.op+' en '+j.origin+'\n'+a.label+(a.op==='fill'?'\nValor: '+a.value:''))){status='cancelled';break}
 const after=await active();if(after.id!==target||new URL(after.url).origin!==j.origin)throw Error('Pestaña cambió');
 const r=await operate(a.op,{id:matches[0].id,nonce:snap.nonce,label:a.label,value:a.value});results.push({op:a.op,ok:r.ok,error:r.error});if(!r.ok){status='failed';break}
 }
 }catch(e){status='failed';results.push({error:e.message});$('status').textContent=e.message}
 finally{if(claimed){try{const share=confirm('¿Compartir con el cliente los resultados mostrados? Las etiquetas pueden contener datos privados.');$('result').textContent=JSON.stringify(results,null,2);await bridge('/v1/jobs/'+j.id+'/finish','POST',{status,results:share?results:[]});}catch(e){$('status').textContent=e.message}}busy=false;await loadJobs()}
}
$('pending').onclick=loadJobs;
