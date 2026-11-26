const $=id=>document.getElementById(id);let busy=false;
async function run(steps){
 if(busy)return;busy=true;$('status').textContent='Ejecutando…';
 try{
 if(steps.some(s=>['click','capture','manual','profile_switch'].includes(s.op))&&!confirm('¿Autoriza estos clics? Pueden enviar datos o confirmar acciones.'))return;
 const r=await fetch('/api/v1/batch',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+$('token').value},body:JSON.stringify({steps})});
 const data=await r.json();$('result').textContent=JSON.stringify(data,null,2);
 $('status').textContent=r.ok?'Lote terminado; revise el resultado de cada paso.':data.error;
 for(const s of data.results||[])if(s.op==='inspect'&&s.ok)render(s.data.elements);
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
