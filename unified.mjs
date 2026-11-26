import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {access} from 'node:fs/promises';
const root=fileURLToPath(new URL('./',import.meta.url));
const key=()=>randomBytes(32).toString('hex');
const env={...process.env,ECOAGENT_HIDE_TOKENS:'true',ECOAGENT_OPERATOR_KEY:key(),ECOAGENT_CLIENT_KEY:key(),ECOAGENT_CONNECTOR_KEY:key(),ECOAGENT_CLOUD_BIND:'127.0.0.1',CONNECTOR_BIND:'127.0.0.1',PORT:'8080',CONNECTOR_PORT:'8081',ECOAGENT_API_URL:'http://127.0.0.1:8080',ECOAGENT_PUBLIC_READ_AUTO:'false',ECOAGENT_ALLOWED_ORIGINS:'https://example.org',ECOAGENT_LOCAL_PORT:'8790'};
const specs=[['local','server.mjs',8790],['bridge','bridge.mjs',8791],['cloud','cloud/app.mjs',8080],['connector','connector/remote.mjs',8081]];
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const c of children)c.kill();process.exitCode=code;}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
for(const [,file,port] of specs){await access(root+file);await new Promise((resolve,reject)=>{const s=createServer();s.once('error',()=>reject(Error('Puerto ocupado: '+port)));s.listen(port,'127.0.0.1',()=>s.close(resolve))})}
for(const [name,file] of specs){
 const c=spawn(process.execPath,[root+file],{cwd:root,env,stdio:['ignore','inherit','inherit']});children.push(c);c.on('error',()=>stop(1));c.on('exit',code=>{if(!stopping){console.error(name+' stopped: '+code);stop(1)}})
}
try{
 for(const port of [8080,8081]){let ready=false;for(let i=0;i<80&&!stopping;i++){try{if((await fetch('http://127.0.0.1:'+port+'/health',{signal:AbortSignal.timeout(500)})).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}if(!ready)throw Error('Health failed: '+port)}
 console.log('ECOAGENT UNIFIED: Cloud + Connector health OK. Local panel: http://127.0.0.1:8790');
 console.log('Local-only preview. Auto read disabled; no remote access. Ctrl+C stops all services. Manual panel tokens hidden; use standalone launcher if needed.');
}catch(e){console.error(e.message);stop(1)}
