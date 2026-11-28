import {cloudflareAI} from './cloudflare-ai.mjs';
import {advancePronunciation,currentPronunciationIndex} from './pronunciation-flow.mjs';
const origins=new Set((Deno.env.get('ALLOWED_ORIGINS')||'https://6v8nhmyrfj-art.github.io').split(',').map(x=>x.trim()));
const norm=s=>String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9']/g,'');
Deno.serve(async req=>{
 const origin=req.headers.get('Origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{})};
 const reply=(x,status=200)=>new Response(JSON.stringify(x),{status,headers});
 if(origin&&!origins.has(origin))return reply({error:'来源不允许'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply({error:'仅支持POST'},405);
 try{
 const base=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),auth=req.headers.get('Authorization');
 const ur=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:auth||''}});if(!ur.ok)return reply({error:'请重新登录'},401);const user=await ur.json();
 const reader=req.body.getReader();let size=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2900000){await reader.cancel();return reply({error:'录音过大'},413)}parts.push(value)}
 const p=JSON.parse(await new Blob(parts).text());if(!/^[0-9a-f-]{36}$/i.test(p.session)||typeof p.audio!=='string'||p.audio.length>2800000||!Number.isInteger(p.version))return reply({error:'参数无效'},400);
 const db=async(path,body)=>{const r=await fetch(base+'/rest/v1/'+path,{method:body?'POST':'GET',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('无法保存发音进度，请重试');return r.json()};
 const [s]=await db('rw_pronunciation_sessions?id=eq.'+p.session);if(!s||s.student!==user.id)return reply({error:'无法访问测试'},403);
 const [m]=await db('rw_members?user_id=eq.'+user.id+'&select=role,password_changed,cohort');if(m?.role!=='student'||!m.password_changed)return reply({error:'请先修改初始密码'},403);
 const [item]=await db('rw_weekly_items?id=eq.'+s.item);const [target]=await db('rw_weekly_targets?id=eq.'+item.target);const [goal]=await db('rw_class_goals?id=eq.'+target.goal+'&select=revision');
 if(target.cohort!==m.cohort||goal.revision!==s.revision)return reply({error:'任务已调整，请重新进入'},409);
 if(s.version!==p.version||s.state.phase==='complete')return reply(s);
 const index=currentPronunciationIndex(s.state),word=s.words[index-1];
 if(!await db('rpc/rw_oral_take_quota',{p_actor:user.id}))return reply({error:'今日语音额度已用完，请稍后再试'},429);
 const ai=cloudflareAI({accountId:Deno.env.get('CLOUDFLARE_ACCOUNT_ID'),apiToken:Deno.env.get('CLOUDFLARE_API_TOKEN')});
 const {text}=await ai.transcribe(Uint8Array.from(atob(p.audio),c=>c.charCodeAt(0)),'en');
 // No target prompt is sent to ASR and no client transcript/verdict is accepted.
 const correct=norm(text)===norm(word.en);
 const next=advancePronunciation(s.state,s.state.phase==='practice'?{index,kind:'practised'}:{index,kind:'judged',verdict:correct?'correct':'incorrect'});
 const result=await db('rpc/rw_pronunciation_commit',{p_id:s.id,p_student:user.id,p_version:s.version,p_state:next});
 return reply({...result,feedback:{text,correct,practice:s.state.phase==='practice'}});
 }catch(e){return reply({error:e.message||'识别失败，请重试'},503)}
});
