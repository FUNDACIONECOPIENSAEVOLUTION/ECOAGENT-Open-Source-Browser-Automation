// Independent isolated browser instances, bounded to conserve local resources.
const operations=['inspect','locate','reveal','scroll','clickLink','reload','history','follow','fill','tabs','newTab','switchTab','closeTab','click','toggle','attachmentTarget','attachDocument','attachDocuments','attachDemo','downloadDemo','preview','review','capture','verify','close'];
export function createLivePool({factory,onClose=()=>{},limit=4}){
 const sessions=new Map();let selected=null,opening=0;
 function remove(id){if(!sessions.delete(id))return;if(selected===id)selected=[...sessions.keys()].at(-1)??null;onClose(id)}
 const pool={
  async open(...args){
   if(sessions.size+opening>=limit)throw Error('Independent browser session limit reached');
   opening++;
   let browser;
   try{
    browser=factory(remove);
    const result=await browser.open(...args);
    sessions.set(result.session,browser);selected=result.session;return result;
   }catch(e){const state=browser?.current();if(state)await browser.close(state.session).catch(()=>{});throw e}
   finally{opening--}
  },
  current(){return sessions.get(selected)?.current()??null},
  list(){return {selected,limit,sessions:[...sessions.values()].map(b=>b.current()).filter(Boolean)}}
 };
 for(const operation of operations)pool[operation]=async(id,...args)=>{
  const browser=sessions.get(id);if(!browser)throw Error('Unknown live session');
  if(operation!=='preview')selected=id;
  try{return await browser[operation](id,...args)}
  finally{if(!browser.current())remove(id)}
 };
 return pool;
}
