import {backendConfig} from './backend-config.mjs?v=performance-20261106';
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
const readRPC=new Set(['rw_student_summary','rw_passed_periods','rw_mastery_books','rw_dashboard','rw_library_catalog','rw_task_catalog','rw_completed_tasks']);
const durableRPC=new Set(['rw_practice','rw_check_familiar','rw_submit_five','rw_submit_review_batch','rw_submit_group','rw_finish_mastery']);
// A client instance belongs to ONE authenticated account. No global personal-data cache.
export function createDataClient(transport,userId,{storage=globalThis.localStorage,now=()=>Date.now()}={}){
 const cache=new Map(),flights=new Map(),writes=new Map();let generation=0,calendar=day();
 const namespace='rw-data-v1:'+backendConfig.environment+':'+userId+':',outboxKey=namespace+'pending';
 let pending=[];try{const v=JSON.parse(storage.getItem(outboxKey));if(Array.isArray(v))pending=v.filter(x=>durableRPC.has(x.path.split('/').pop())&&x.body&&(x.body.p_id||x.body.p_test))}catch{}
 const persist=()=>{
  try{storage.setItem(outboxKey,JSON.stringify(pending));return}catch{}
  // Pending answers take priority over replaceable vocabulary caches.
  try{for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith(namespace+'book:'))storage.removeItem(key)}storage.setItem(outboxKey,JSON.stringify(pending))}
  catch{throw Error('本机存储不可用，作答暂未安全保存。请释放空间或允许网站存储后重试。')}
 };
 function invalidate(predicate=()=>true){generation++;for(const key of cache.keys())if(predicate(key))cache.delete(key);flights.clear()}
 function mutation(path){
  if(/rw_libraries|rw_tasks/.test(path))return invalidate();
  if(/rw_bookshelf/.test(path))return invalidate(k=>/rw_bookshelf|rw_mastery_books/.test(k));
  if(/rw_begin_mastery/.test(path))return;
  invalidate(k=>!/rw_(library_catalog|task_catalog|libraries\?|tasks\?|bookshelf)/.test(k));
 }
 async function send(path,method,body,entry){
  const key=entry?.id; if(key&&writes.has(key))return writes.get(key);
  mutation(path);
  const promise=transport(path,method,body).then(result=>{
   if(entry){pending=pending.filter(x=>x.id!==key);persist()}mutation(path);return result;
  }).finally(()=>{if(key)writes.delete(key)});
  if(key)writes.set(key,promise);return promise;
 }
 async function call(path,method='GET',body){
  if(day()!==calendar){calendar=day();invalidate()}
  const rpc=path.split('/').pop(),read=method==='GET'||(method==='POST'&&readRPC.has(rpc));
  if(!read){
   let entry;
   if(durableRPC.has(rpc)){
    const id=path+':'+(body.p_id||body.p_test);entry=pending.find(x=>x.id===id);
    if(entry&&JSON.stringify(entry.body)!==JSON.stringify(body))throw Error('这次作答已有待保存答案，请先重试保存。');
    if(!entry){entry={id,path,body,created_at:new Date(now()).toISOString(),schema_version:1};pending.push(entry)}
    persist();
   }
   return send(path,method,body,entry)
  }
  const key=method+':'+path+':'+JSON.stringify(body??null),ttl=/rw_(library_catalog|task_catalog)/.test(path)?60000:30000;
  const hit=cache.get(key);if(hit&&now()-hit.at<ttl)return structuredClone(hit.value);
  if(flights.has(key))return structuredClone(await flights.get(key));
  const stamp=generation,promise=transport(path,method,body).then(value=>{if(stamp===generation)cache.set(key,{at:now(),value:structuredClone(value)});return value}).finally(()=>{if(flights.get(key)===promise)flights.delete(key)});
  flights.set(key,promise);return structuredClone(await promise);
 }
 call.invalidate=()=>invalidate();
 call.pendingCount=()=>pending.length;
 call.flushPending=async()=>{for(const entry of [...pending])await send(entry.path,'POST',entry.body,entry)};
 call.clear=()=>{invalidate();for(let i=storage.length-1;i>=0;i--){const k=storage.key(i);if(k?.startsWith(namespace)&&k!==outboxKey)storage.removeItem(k)}};
 // Versioned vocabulary only; personal scores/history remain in memory.
 call.loadBook=async(kind,metadata)=>{
  const table=kind==='library'?'rw_libraries':'rw_tasks',key=namespace+'book:'+kind+':'+metadata.id;
  try{const hit=JSON.parse(storage.getItem(key));if(metadata.updated_at&&hit?.version===metadata.updated_at&&now()-hit.at<300000)return hit.value}catch{}
  const rows=await transport('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(metadata.id)+'&select=id,title,words,category,updated_at');
  if(!rows?.[0])throw Error('词书不可用，请刷新列表。');const value={...metadata,...rows[0],kind};
  try{const data=JSON.stringify({version:value.updated_at,at:now(),value});if(data.length<500000){
   const keys=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k?.startsWith(namespace+'book:'))keys.push(k)}
   while(keys.length>=6)storage.removeItem(keys.shift());storage.setItem(key,data)
  }}catch{}
  return value;
 };
 return call;
}
