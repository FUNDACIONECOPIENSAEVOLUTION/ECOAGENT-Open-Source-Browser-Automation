// Session-local counters only: no URLs, headers, credentials or response content.
const reasons=['policy_block','draft_url_block','redirect_block','upstream_error'];
const types=['document','stylesheet','image','media','font','script','texttrack','xhr','fetch','eventsource','websocket','manifest','other'];
export function createResourceDiagnostics(){
 const counts=new Map();
 return {record(reason,type){if(!reasons.includes(reason))return;const key=reason+':'+(types.includes(type)?type:'other');counts.set(key,Math.min(1000000,(counts.get(key)||0)+1))},snapshot(){return {scope:'session',counts:Object.fromEntries([...counts].sort(([a],[b])=>a.localeCompare(b)))}}};
}
