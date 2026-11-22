import {cloudflareAI} from './cloudflare-ai.mjs';
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export function oralHandler(env,fetchImpl=fetch){
 const base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY')||Object.values(JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}'))[0];
 const model='@cf/google/gemma-4-26b-a4b-it';
 async function db(path,method='GET',body,extra={}){const r=await fetchImpl(base+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Error('数据保存失败，请重试。');const t=await r.text();return t?JSON.parse(t):null}
 return async req=>{
 const origin=req.headers.get('Origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 if(origin==='https://6v8nhmyrfj-art.github.io'){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='authorization,apikey,content-type';headers['Access-Control-Allow-Methods']='POST,OPTIONS'}
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&origin!=='https://6v8nhmyrfj-art.github.io')return reply({error:'来源不允许'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply({error:'仅支持POST'},405);
 try{
  const auth=req.headers.get('Authorization');if(!auth?.startsWith('Bearer '))return reply({error:'请先登录'},401);
  const ur=await fetchImpl(base+'/auth/v1/user',{headers:{apikey:key,Authorization:auth}});if(!ur.ok)return reply({error:'登录已过期'},401);const user=await ur.json();
  const [member]=await db('rw_members?user_id=eq.'+encodeURIComponent(user.id)+'&select=role,password_changed');if(!member||!['teacher','student'].includes(member.role)||member.role==='student'&&!member.password_changed)return reply({error:'请先登录并修改初始密码'},403);
  const reader=req.body?.getReader();if(!reader)return reply({error:'缺少请求内容'},400);let length=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2900000){await reader.cancel();return reply({error:'录音过大，请重新录音'},413)}chunks.push(value)}const bytes=new Uint8Array(length);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length}let p;try{p=JSON.parse(new TextDecoder().decode(bytes))}catch{return reply({error:'请求格式错误'},400)}
  if(p.action==='health')return reply({configured:!!env('CLOUDFLARE_ACCOUNT_ID')&&!!env('CLOUDFLARE_API_TOKEN')});
  if(!uuid(p.session)||!Number.isInteger(p.index))return reply({error:'测试信息无效'},400);
  const [session]=await db('rw_class_sessions?id=eq.'+p.session+'&select=*');
  if(!session||session.actor!==user.id||session.response_mode!=='oral'||session.mode!=='reading'||session.final_result)return reply({error:'测试无效或已结束'},403);
  const [goal]=await db('rw_class_goals?id=eq.'+session.goal+'&select=revision');if(goal?.revision!==session.revision)return reply({error:'目标已更新，请重新开始'},409);
  const question=session.questions.find(q=>q.index===p.index);if(!question)return reply({error:'题目不在本轮测试内'},403);
  const ai=cloudflareAI({accountId:env('CLOUDFLARE_ACCOUNT_ID'),apiToken:env('CLOUDFLARE_API_TOKEN'),gradingModel:model,fetchImpl});
  if(p.action==='transcribe'){
   if(!uuid(p.id)||typeof p.audio!=='string'||p.audio.length>2800000)return reply({error:'录音参数无效'},400);
   const [old]=await db('rw_oral_answers?id=eq.'+p.id);if(old){if(old.actor!==user.id||old.session!==p.session||old.question_index!==p.index)return reply({error:'录音编号冲突'},409);return reply({id:old.id,text:old.transcript})}
   if(!await db('rpc/rw_oral_take_quota','POST',{p_actor:user.id}))return reply({error:'今日语音调用次数已达上限'},429);
   let audio;try{audio=Uint8Array.from(atob(p.audio),c=>c.charCodeAt(0))}catch{return reply({error:'录音格式错误'},400)}
   const {text}=await ai.transcribe(audio);await db('rw_oral_answers','POST',{id:p.id,session:p.session,actor:user.id,question_index:p.index,transcript:text});return reply({id:p.id,text});
  }
  if(p.action==='grade'||p.action==='typed'){
   if(p.action==='typed'){
    if(!uuid(p.id)||typeof p.text!=='string'||!p.text.trim()||p.text.trim().length>500)return reply({error:'请输入1至500字的中文答案'},400);
    const [old]=await db('rw_oral_answers?id=eq.'+p.id);
    if(old){if(old.actor!==user.id||old.session!==p.session||old.question_index!==p.index||old.transcript!==p.text.trim())return reply({error:'答案编号冲突'},409)}
    else await db('rw_oral_answers','POST',{id:p.id,session:p.session,actor:user.id,question_index:p.index,transcript:p.text.trim()});
   }
   if(!uuid(p.id))return reply({error:'答案编号无效'},400);
   let [answer]=await db('rw_oral_answers?id=eq.'+p.id);if(!answer||answer.actor!==user.id||answer.session!==p.session||answer.question_index!==p.index)return reply({error:'答案不属于本题'},403);
   if(!answer.verdict){
    if(!await db('rpc/rw_oral_take_quota','POST',{p_actor:user.id}))return reply({error:'今日语音调用次数已达上限'},429);
    const w=question.word,result=await ai.grade({word:w.en,meaning:w.zh,example:w.example||w.test_example||'',answer:answer.transcript});
    await db('rw_oral_answers?id=eq.'+p.id+'&verdict=is.null','PATCH',{verdict:result.verdict,reason:result.reason,model});[answer]=await db('rw_oral_answers?id=eq.'+p.id);
   }
   return reply({id:answer.id,verdict:answer.verdict,reason:answer.reason});
  }
  return reply({error:'不支持的操作'},400);
 }catch(e){return reply({error:e.message||'语音服务暂时不可用，请重试'},503)}
 };
}
