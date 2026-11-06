import {createDataClient} from './data-client.mjs?v=performance-20261106';
import {backendConfig} from './backend-config.mjs?v=performance-20261106';
import {createClassClient,loginIdentity} from './class-api.mjs?v=performance-20261106';
const el=id=>document.getElementById(id);
const storageKey='rw-cloud-session-v2:'+backendConfig.environment;
if(backendConfig.environment==='nnooeadfgsvbddrjwyan'&&!localStorage.getItem(storageKey)&&localStorage.getItem('rw-cloud-session-v1')){localStorage.setItem(storageKey,localStorage.getItem('rw-cloud-session-v1'));localStorage.removeItem('rw-cloud-session-v1')}
let dataClient;
function readSession(){try{return JSON.parse(localStorage.getItem(storageKey))||{}}catch{return {}}}
let saved=readSession(),token=saved.access_token||'',member,memberId,refreshing;
function remember(s){saved={access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at||Math.floor(Date.now()/1000)+s.expires_in};token=saved.access_token;localStorage.setItem(storageKey,JSON.stringify(saved))}
function clearSession(){dataClient?.clear();localStorage.removeItem(storageKey);if(backendConfig.environment==='nnooeadfgsvbddrjwyan')localStorage.removeItem('rw-cloud-session-v1');sessionStorage.removeItem('rw-session');token='';saved={}}
function loginScreen(){clearSession();location.reload()}
const raw=createClassClient(async (url,{method,headers,body})=>{
 let r;try{r=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)})}catch{throw Error('网络连接超时或中断，请重试。未确认保存的作答会保留。')}
 const t=await r.text();return {status:r.status,data:t?JSON.parse(t):null};
},()=>token);
async function api(path,method,body){
 if(!path.startsWith('/auth/v1/token') && saved.refresh_token && saved.expires_at*1000<Date.now()+60000){
  refreshing??=raw('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:saved.refresh_token}).then(remember).catch(e=>{if([400,401,403].includes(e.status))loginScreen();throw e}).finally(()=>{refreshing=null});
  await refreshing;
 }
 return raw(path,method,body)
}
function guard(fn){return async e=>{e?.preventDefault();try{await fn(e)}catch(err){el('msg').textContent=err.message}}}
async function loadRoom(){
 const me=await api('/auth/v1/user');memberId=me.id;
 [member]=await api('/rest/v1/rw_members?user_id=eq.'+encodeURIComponent(me.id)+'&select=display_name,role,password_changed');
 if(!member)throw Error('此账号尚未加入班级，请联系老师。');
 if(member.role==='student'&&!member.password_changed){el('login').hidden=true;el('welcome').hidden=true;el('change').hidden=false;el('room').hidden=true;el('msg').textContent='';return}
 dataClient=createDataClient(api,me.id);
 if(member.role==='teacher'){const {teacher}=await import('./teacher.mjs?v=performance-20261106');const signout=el('logout');await teacher(dataClient,()=>signout.click(),el('enroll'));return}
 const {student}=await import('./student.mjs?v=performance-20261106');const signout=el('logout');await student(dataClient,me,member,basic,()=>signout.click());
}
el('login').onsubmit=guard(async e=>{token='';const data=Object.fromEntries(new FormData(e.target));data.email=loginIdentity(data.email);const session=await api('/auth/v1/token?grant_type=password','POST',data);remember(session);e.target.reset();await loadRoom()});
el('publish').onsubmit=guard(async e=>{const f=new FormData(e.target),words=f.get('words').trim().split(/\r?\n/).map(line=>{const [en,zh]=line.trim().split(/\t+/);if(!en||!zh)throw Error('请从表格复制英文和释义两列。');return {en,zh}});await api('/rest/v1/rw_tasks','POST',{title:f.get('title').trim(),words});e.target.reset();await loadRoom();el('msg').textContent='任务已发布'});
el('enroll').onsubmit=guard(async e=>{const form=e.target,button=form.querySelector('button');button.disabled=true;try{await api('/functions/v1/rw-create-student','POST',Object.fromEntries(new FormData(form)));form.reset();el('msg').textContent='学生账号已创建，可以用学号和初始密码登录。'}finally{button.disabled=false}});
el('logout').onclick=guard(async()=>{try{await api('/auth/v1/logout','POST')}finally{loginScreen()}});
const basic={title:'基础词汇',words:[{"en":"discover","zh":"发现；发觉"},{"en":"balloon","zh":"气球"},{"en":"wheel","zh":"轮子"},{"en":"central","zh":"中心的"},{"en":"although","zh":"虽然；尽管"},{"en":"attach","zh":"系上；连接"},{"en":"pull","zh":"拉；拖"},{"en":"international","zh":"国际的"},{"en":"path","zh":"小路；路径"},{"en":"technique","zh":"技术；技巧"},{"en":"depend","zh":"依靠；取决于"},{"en":"describe","zh":"描述"},{"en":"decide","zh":"决定"},{"en":"develop","zh":"发展；培养"},{"en":"practice","zh":"练习"},{"en":"improve","zh":"提高；改善"},{"en":"knowledge","zh":"知识"},{"en":"journey","zh":"旅程"},{"en":"prepare","zh":"准备"},{"en":"remember","zh":"记住"}]};
el('switch').onclick=()=>el('logout').click();
el('change').onsubmit=guard(async e=>{
 const form=e.target,data=new FormData(form),password=data.get('password');
 if(password!==data.get('confirm'))throw Error('两次输入的密码不一致。');
 const submit=form.querySelector('button');submit.disabled=true;
 try{await api('/auth/v1/user','PUT',{password});form.reset();await loadRoom()}finally{submit.disabled=false}
});
if(token)guard(loadRoom)();

