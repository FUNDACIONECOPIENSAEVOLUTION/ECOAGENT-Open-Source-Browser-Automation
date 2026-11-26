export function validateJob(input){
 if(!input||typeof input!=='object'||!Array.isArray(input.steps)||input.steps.length<1||input.steps.length>20)throw Error('Lote de 1 a 20 pasos');
 const u=new URL(input.origin);if(!['http:','https:'].includes(u.protocol)||u.origin!==input.origin)throw Error('Origen HTTP(S) exacto requerido');
 const steps=input.steps.map(s=>{
 if(!s||!['inspect','fill','click'].includes(s.op))throw Error('Operación no permitida');
 if(s.op==='inspect')return {op:'inspect'};
 if(typeof s.label!=='string'||!s.label.trim()||s.label.length>160)throw Error('Etiqueta exacta requerida');
 if(s.op==='fill'&&(typeof s.value!=='string'||s.value.length>8000))throw Error('Valor inválido');
 return {op:s.op,label:s.label,...(s.op==='fill'?{value:s.value}:{})};
 });
 return {origin:u.origin,steps};
}
