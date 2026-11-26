export async function readTask(client,url,{timeout=45000,interval=1000,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const job=await client.read(url);const deadline=now()+timeout;
 let result=job;
 while(result.status==='running'&&now()<deadline){await sleep(interval);result=await client.status(job.id)}
 return {...result,id:job.id};
}
