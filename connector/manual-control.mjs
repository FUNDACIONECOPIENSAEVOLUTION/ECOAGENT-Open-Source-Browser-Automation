export function createControl(){
 let mode='ai',session=null,requested=false;
 return {
 request(id){if(mode==='human'||requested)throw Error('Control already requested');session=id;requested=true;return this.status()},
 status(){return {mode,session,requested}},
 take(){if(!requested||!session||mode!=='ai')throw Error('No pending takeover');mode='human';requested=false;return this.status()},
 release(){mode='ai';session=null;requested=false;return this.status()},
 sessionClosed(id){if(session===id)this.release();return this.status()},
 assertAI(){if(mode!=='ai')throw Error('Human control active')},
 assertHuman(){if(mode!=='human'||!session)throw Error('Human control not active');return session}
 };
}
