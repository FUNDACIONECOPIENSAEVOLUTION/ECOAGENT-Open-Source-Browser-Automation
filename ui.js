const $=id=>document.getElementById(id);let busy=false,live=false,generation=0,timer=null,blobUrl=null,screenRequest=null;
function activity(s){const p=document.createElement('div');p.textContent=new Date().toLocaleTimeString()+' · '+s;$('activity').prepend(p);while($('activity').children.length>25)$('activity').lastChild.remove()}
function clearScreen(){if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=null;$('liveImage').removeAttribute('src');$('liveImage').hidden=true;$('screenEmpty').hidden=false}
function stopLive(){live=false;generation++;clearTimeout(timer);screenRequest?.abort();clearScreen();$('liveStatus').textContent='Visor detenido'}
async function frame(g){if(!live||g!==generation)return;try{if(!busy){screenRequest=new AbortController();const r=await fetch('/api/v1/live',{headers:{Authorization:'Bearer '+$('token').value},signal:screenRequest.signal,cache:'no-store'});if(!r.ok){clearScreen();$('liveStatus').textContent='Visor no disponible (HTTP '+r.status+')';if([401,403].includes(r.status)){stopLive();return}}else{const b=await r.blob();if(!live||g!==generation)return;if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(b);$('liveImage').src=blobUrl;$('liveImage').hidden=false;$('screenEmpty').hidden=true;$('liveStatus').textContent='Captura actualizada: '+new Date().toLocaleTimeString()}}}catch(e){if(live&&g===generation){clearScreen();$('liveStatus').textContent='Sin captura: '+e.message}}finally{if(live&&g===generation)timer=setTimeout(()=>frame(g),1800)}}

async function run(steps){
 if(busy)return;if(steps.some(s=>['manual','profile_switch'].includes(s.op)))stopLive();busy=true;$('status').textContent='Ejecutando…';
 try{
 if(steps.some(s=>['click','capture','manual','profile_switch'].includes(s.op))&&!confirm('¿Autoriza estos clics? Pueden enviar datos o confirmar acciones.'))return;
 const r=await fetch('/api/v1/batch',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+$('token').value},body:JSON.stringify({steps})});
 const data=await r.json();$('result').textContent=JSON.stringify(data,null,2);
 $('status').textContent=r.ok?'Lote terminado; revise el resultado de cada paso.':data.error;
 for(const s of data.results||[]){activity(s.op+' — '+(s.ok?'correcto':'error'));if(s.op==='inspect'&&s.ok)render(s.data.elements);if(s.op==='click'&&s.ok)$('elements').replaceChildren();}
 }catch(e){$('status').textContent=e.message}finally{busy=false}
}
function render(items){$('elements').replaceChildren();for(const e of items){
 const d=document.createElement('div');d.className='element';
 const t=document.createElement('div');t.textContent=e.id+' · '+e.tag+' · '+e.label;d.append(t);
 const b=document.createElement('button');b.textContent='Clic';b.onclick=()=>run([{op:'click',id:e.id,approved:true},{op:'inspect'}]);d.append(b);
 if(['input','textarea','select'].includes(e.tag)&&!['password','file','hidden'].includes(e.type)){
 const i=document.createElement('input');i.placeholder='Valor autorizado';d.append(i);
 const f=document.createElement('button');f.textContent='Diligenciar';f.onclick=()=>run([{op:e.tag==='select'?'select':'fill',id:e.id,value:i.value}]);d.append(f);
 }$('elements').append(d);
}}
$('open').onclick=()=>run([{op:'open',url:$('url').value},{op:'inspect'}]);
$('inspect').onclick=()=>run([{op:'inspect'}]);$('back').onclick=()=>run([{op:'back'},{op:'inspect'}]);$('capture').onclick=()=>run([{op:'capture',approved:true}]);
$('run').onclick=()=>{try{run(JSON.parse($('batch').value).steps)}catch(e){$('status').textContent=e.message}};

$('switch').onclick=()=>run([{op:'profile_switch',profile:$('profile').value,channel:$('channel').value}]);
$('pause').onclick=()=>run([{op:'manual',enabled:true}]);
$('resume').onclick=()=>run([{op:'manual',enabled:false}]);
$('profileStatus').onclick=()=>run([{op:'profile_status'}]);

$('liveStart').onclick=()=>{if(live)return;if(!confirm('Mostrar capturas periódicas en este panel local. No activar durante autenticación ni en páginas confidenciales.'))return;live=true;frame(++generation)};
$('liveStop').onclick=stopLive;
$('up').onclick=()=>run([{op:'scroll',y:-500}]);$('down').onclick=()=>run([{op:'scroll',y:500}]);
$('token').addEventListener('input',stopLive);window.addEventListener('pagehide',stopLive);
