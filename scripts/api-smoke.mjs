import http from 'node:http';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {mkdtemp,rm,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scratch=await mkdtemp(resolve(root,'api-test-'));
const fixture=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(`<!doctype html><meta charset="utf-8"><title>Prueba ECOAGENT</title><label>Organizacion<input id="org"></label><label>Pais<select id="country"><option>Seleccione</option><option>Colombia</option></select></label><label>Proyecto<textarea id="project"></textarea></label><label>Confirmar prueba<input id="check" type="checkbox"></label><button id="submit">Enviar prueba</button><button id="status" disabled>Sin confirmar</button><script>document.querySelector('#submit').onclick=()=>{if(document.querySelector('#org').value==='Organizacion de prueba'&&document.querySelector('#country').value==='Colombia'&&document.querySelector('#project').value==='ECOAGENT test'&&document.querySelector('#check').checked)document.querySelector('#status').textContent='FORMULARIO COMPLETADO'}</script>`)});
let child;
try{
 fixture.listen(0,'127.0.0.1');await once(fixture,'listening');
 const reservation=http.createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 if(port<1024)throw Error('Puerto de prueba inválido');
 const base='http://127.0.0.1:'+port;
 child=fork(resolve(root,'server.mjs'),[],{cwd:root,env:{...process.env,LOCALAPPDATA:scratch,ECOAGENT_LOCAL_PORT:String(port)},silent:true});
 const token=await new Promise((ok,fail)=>{let buf='';const timer=setTimeout(()=>fail(Error('Servidor no arrancó')),15000);child.stdout.on('data',chunk=>{buf+=chunk.toString();const m=/Token temporal \(solo local\): ([a-f0-9]{64})/.exec(buf);if(m){clearTimeout(timer);ok(m[1])}});child.stderr.on('data',()=>{});child.once('error',e=>{clearTimeout(timer);fail(e)});child.once('exit',()=>{clearTimeout(timer);fail(Error('Servidor terminó inesperadamente'))})});
 const post=async(steps,auth=token)=>{const r=await fetch(base+'/api/v1/batch',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth},body:JSON.stringify({steps}),signal:AbortSignal.timeout(90000)});return {status:r.status,data:await r.json()}};
 const batch=async steps=>{const r=await post(steps);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.results.length,steps.length,JSON.stringify(r.data));for(const x of r.data.results)assert.equal(x.ok,true,JSON.stringify(x));return r.data.results.map(x=>x.data)};
 assert.equal((await post([{op:'profile_status'}],'invalid')).status,401);console.log('API: autenticacion correcta');
 await batch([{op:'profile_switch',profile:'smoke',channel:'chromium'}]);
 const blocked=await post([{op:'inspect'}]);assert.equal(blocked.data.results[0].ok,false);console.log('API: modo privado bloquea inspeccion');
 await batch([{op:'manual',enabled:false},{op:'open',url:'http://127.0.0.1:'+fixture.address().port}]);
 const [view]=await batch([{op:'inspect'}]);const id=label=>{const found=view.elements.filter(e=>e.label.trim()===label);assert.equal(found.length,1,label);return found[0].id};
 await batch([{op:'fill',id:id('Organizacion'),value:'Organizacion de prueba'},{op:'select',id:id('Pais'),value:'Colombia'},{op:'fill',id:id('Proyecto'),value:'ECOAGENT test'}]);console.log('API: campos y seleccion correctos');
 await batch([{op:'click',id:id('Confirmar prueba'),approved:true}]);
 const [v2]=await batch([{op:'inspect'}]);const submit=v2.elements.find(e=>e.label.trim()==='Enviar prueba');assert.ok(submit);
 await batch([{op:'click',id:submit.id,approved:true}]);
 const [v3]=await batch([{op:'inspect'}]);assert.ok(v3.elements.some(e=>e.label.trim()==='FORMULARIO COMPLETADO'));console.log('API: clic y resultado verificados');
 const [capture]=await batch([{op:'capture',approved:true}]);await access(resolve(scratch,'ECOAGENT',capture.file));console.log('API: captura verificada');
 console.log('PRUEBA INTEGRAL API EXITOSA');
}finally{
 if(child&&child.exitCode===null){const done=once(child,'exit');try{child.send({type:'ecoagent-shutdown'})}catch{};const timeout=setTimeout(()=>child.kill(),10000);await done.catch(()=>{});clearTimeout(timeout)}
 await new Promise(r=>fixture.close(r));await rm(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:300}).catch(()=>{console.error('No se pudo borrar directorio temporal de prueba:',scratch)});
}
