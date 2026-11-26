// Automatic mode is deliberately public, anonymous, read-only.
export function automatic(batch,enabled){
 return enabled===true&&Array.isArray(batch?.steps)&&batch.steps.length>0&&batch.steps[0].op==='open'&&batch.steps.every(a=>['open','read','close'].includes(a.op));
}
export function safeReadURL(raw){const u=new URL(raw);return u.origin+u.pathname}
