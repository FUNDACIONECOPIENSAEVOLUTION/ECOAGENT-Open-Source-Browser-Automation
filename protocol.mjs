const ops=new Set(['open','inspect','tabs','tab','back','scroll','capture','wait','fill','select','click','profile_status','profile_switch','manual']);
export function validateBatch(body){
 if(!body||!Array.isArray(body.steps)||!body.steps.length||body.steps.length>20)throw Error('Se requieren 1–20 pasos');
 return body.steps.map(a=>{
  if(!a||!ops.has(a.op))throw Error('Operación inválida');
  if(a.op==='profile_switch'&&(!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(a.profile||'')||!['chrome','chromium'].includes(a.channel)))throw Error('Perfil inválido');
  if(a.op==='manual'&&typeof a.enabled!=='boolean')throw Error('Modo inválido');
  if(a.op==='capture'&&a.approved!==true)throw Error('Captura requiere autorización');
  if(a.op==='open'&&(typeof a.url!=='string'||a.url.length>2048))throw Error('URL inválida');
  if(['fill','select','click'].includes(a.op)&&(typeof a.id!=='string'||!/^\d+:\d+$/.test(a.id)))throw Error('ID inválido');
  if(['fill','select'].includes(a.op)&&(typeof a.value!=='string'||a.value.length>8000))throw Error('Valor inválido');
  if(a.op==='click'&&a.approved!==true)throw Error('Aprobación requerida para clic');
  if(a.op==='tab'&&(!Number.isInteger(a.index)||a.index<0))throw Error('Pestaña inválida');
  if(a.op==='scroll'&&(!Number.isFinite(a.y)||Math.abs(a.y)>3000))throw Error('Desplazamiento inválido');
  if(a.op==='wait'&&(!Number.isInteger(a.ms)||a.ms<0||a.ms>5000))throw Error('Espera inválida');
  return a;
 });
}
