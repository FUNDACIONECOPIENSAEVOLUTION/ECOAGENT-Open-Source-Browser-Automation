export function validateControl(a){
 if(!a||typeof a!=='object')throw Error('Control inválido');
 if(a.op==='take'||a.op==='release'||a.op==='status')return {op:a.op};
 if(!['click','scroll','text','key'].includes(a.op)||typeof a.frame!=='string'||!a.frame)throw Error('Acción o captura inválida');
 if(a.op==='click'&&(!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.x<0||a.x>=1||a.y<0||a.y>=1))throw Error('Coordenadas inválidas');
 if(a.op==='scroll'&&(!Number.isFinite(a.y)||Math.abs(a.y)>1200))throw Error('Desplazamiento inválido');
 if(a.op==='text'&&(typeof a.value!=='string'||!a.value.length||a.value.length>2000))throw Error('Texto inválido');
 if(a.op==='key'&&!['Tab','Shift+Tab','Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Escape','Enter','Space'].includes(a.key))throw Error('Tecla inválida');
 return a;
}
