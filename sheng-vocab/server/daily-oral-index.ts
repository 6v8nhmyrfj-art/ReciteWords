import {cloudflareAI} from './cloudflare-ai.mjs';
Deno.serve(async req=>{
 const origin=req.headers.get('Origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store',...(origin==='https://6v8nhmyrfj-art.github.io'?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{})};
 const reply=(x,status=200)=>new Response(JSON.stringify(x),{status,headers});
 if(origin&&origin!=='https://6v8nhmyrfj-art.github.io')return reply({error:'来源不允许'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply({error:'仅支持POST'},405);
 try{
 const base=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),auth=req.headers.get('Authorization');
 if(!auth)return reply({error:'请先登录'},401);
 const ur=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:auth}});if(!ur.ok)return reply({error:'请重新登录'},401);const user=await ur.json();
 const reader=req.body.getReader();let size=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2900000){await reader.cancel();return reply({error:'录音过大'},413)}parts.push(value)}
 const p=JSON.parse(await new Blob(parts).text());if(!/^[0-9a-f-]{36}$/i.test(p.session)||typeof p.audio!=='string'||p.audio.length>2800000)return reply({error:'参数无效'},400);
 const db=async(path,method='GET',body)=>{const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('无法读取测试进度');return r.json()};
 const [s]=await db('rw_daily_oral?id=eq.'+p.session);if(!s||s.student!==user.id||s.round!==p.round||s.offset_index!==p.offset||s.attempt!==p.attempt||s.round>=s.questions.length||s.offset_index>=s.questions[s.round].length)return reply({error:'题目已变化，请刷新'},409);
 const [m]=await db('rw_members?user_id=eq.'+user.id+'&select=role,password_changed');if(m?.role!=='student'||!m.password_changed)return reply({error:'请先修改初始密码'},403);
 if(!await db('rpc/rw_oral_take_quota','POST',{p_actor:user.id}))return reply({error:'今日语音额度已用完，请稍后再试'},429);
 const ai=cloudflareAI({accountId:Deno.env.get('CLOUDFLARE_ACCOUNT_ID'),apiToken:Deno.env.get('CLOUDFLARE_API_TOKEN')});
 const {text}=await ai.transcribe(Uint8Array.from(atob(p.audio),c=>c.charCodeAt(0)),'en');return reply({text});
 }catch(e){return reply({error:e.message||'识别失败，请重试'},503)}
});
