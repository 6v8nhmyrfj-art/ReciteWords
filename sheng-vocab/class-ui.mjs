import {createClassClient,loginIdentity} from './class-api.mjs';
const el=id=>document.getElementById(id);
const storageKey='rw-cloud-session-v1';
function readSession(){try{return JSON.parse(localStorage.getItem(storageKey))||{}}catch{return {}}}
let saved=readSession(),token=saved.access_token||'',member,refreshing;
function remember(s){saved={access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at||Math.floor(Date.now()/1000)+s.expires_in};token=saved.access_token;localStorage.setItem(storageKey,JSON.stringify(saved))}
function clearSession(){localStorage.removeItem(storageKey);sessionStorage.removeItem('rw-session');token='';saved={}}
function loginScreen(){clearSession();location.reload()}
const raw=createClassClient(async (url,{method,headers,body})=>{
 const r=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined});
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
 const me=await api('/auth/v1/user');
 [member]=await api('/rest/v1/rw_members?user_id=eq.'+encodeURIComponent(me.id)+'&select=display_name,role,password_changed');
 if(!member)throw Error('此账号尚未加入班级，请联系老师。');
 if(member.role==='student'&&!member.password_changed){el('login').hidden=true;el('welcome').hidden=true;el('change').hidden=false;el('room').hidden=true;el('msg').textContent='';return}
 el('change').hidden=true;
 const tasks=await api('/rest/v1/rw_tasks?select=id,title,words&order=created_at.desc');
 sets=[basic,...tasks.filter(t=>t.words.length)];el('tasks').replaceChildren();if(!tasks.length)el('tasks').textContent='还没有任务。';
 for(const task of tasks){const d=document.createElement('details'),s=document.createElement('summary');s.textContent=task.title;d.append(s);
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
const progress=member.role==='student'?await api('/rest/v1/rw_progress?select=word_index&task_id=eq.'+task.id+'&learned_on=eq.'+today):[];
const seen=new Set(progress.map(row=>row.word_index));
if(member.role==='teacher'){
 const check=document.createElement('button'),report=document.createElement('div');
 check.textContent='查看今日打卡';check.onclick=guard(async()=>{
 const rows=await api('/rest/v1/rpc/rw_today','POST',{p_task:task.id});
 report.replaceChildren();if(!rows.length)report.textContent='班级内暂无学生。';
 for(const row of rows){const line=document.createElement('p');line.textContent=row.student_name+' · '+row.learned+'/'+task.words.length+(Number(row.learned)===task.words.length?' · 已打卡':'');report.append(line)}
 });d.append(check,report);
}
task.words.forEach((w,i)=>{const p=document.createElement('p');p.textContent=w.en+' · '+w.zh+' ';if(member.role==='student'){const b=document.createElement('button');b.disabled=seen.has(i);b.textContent=b.disabled?'今日已学':'记为已学';b.onclick=guard(async()=>{await api('/rest/v1/rw_progress','POST',{user_id:me.id,task_id:task.id,word_index:i});b.disabled=true;b.textContent='已保存'});p.append(b)}d.append(p)});el('tasks').append(d)}
 el('welcome').hidden=true;el('nav').hidden=member.role==='teacher';el('logout').hidden=member.role==='student';el('enroll').hidden=member.role!=='teacher';el('person').textContent=member.display_name;el('publish').hidden=member.role!=='teacher';el('room').hidden=false;el('login').hidden=true;el('msg').textContent='';showTab('班级任务');
}
el('login').onsubmit=guard(async e=>{token='';const data=Object.fromEntries(new FormData(e.target));data.email=loginIdentity(data.email);const session=await api('/auth/v1/token?grant_type=password','POST',data);remember(session);e.target.reset();await loadRoom()});
el('publish').onsubmit=guard(async e=>{const f=new FormData(e.target),words=f.get('words').trim().split(/\r?\n/).map(line=>{const [en,zh]=line.trim().split(/\t+/);if(!en||!zh)throw Error('请从表格复制英文和释义两列。');return {en,zh}});await api('/rest/v1/rw_tasks','POST',{title:f.get('title').trim(),words});e.target.reset();await loadRoom();el('msg').textContent='任务已发布'});
el('enroll').onsubmit=guard(async e=>{const form=e.target,button=form.querySelector('button');button.disabled=true;try{await api('/functions/v1/rw-create-student','POST',Object.fromEntries(new FormData(form)));form.reset();el('msg').textContent='学生账号已创建，可以用学号和初始密码登录。'}finally{button.disabled=false}});
el('logout').onclick=guard(async()=>{try{await api('/auth/v1/logout','POST')}finally{loginScreen()}});
const basic={title:'基础词汇',words:[{"en":"discover","zh":"发现；发觉"},{"en":"balloon","zh":"气球"},{"en":"wheel","zh":"轮子"},{"en":"central","zh":"中心的"},{"en":"although","zh":"虽然；尽管"},{"en":"attach","zh":"系上；连接"},{"en":"pull","zh":"拉；拖"},{"en":"international","zh":"国际的"},{"en":"path","zh":"小路；路径"},{"en":"technique","zh":"技术；技巧"},{"en":"depend","zh":"依靠；取决于"},{"en":"describe","zh":"描述"},{"en":"decide","zh":"决定"},{"en":"develop","zh":"发展；培养"},{"en":"practice","zh":"练习"},{"en":"improve","zh":"提高；改善"},{"en":"knowledge","zh":"知识"},{"en":"journey","zh":"旅程"},{"en":"prepare","zh":"准备"},{"en":"remember","zh":"记住"}]};let sets=[basic];
function button(label,action){const b=document.createElement('button');b.textContent=label;b.onclick=action;return b}
function showTab(label){
 const extra=el('extra');extra.replaceChildren();el('taskpanel').hidden=label!=='班级任务';
 for(const b of el('nav').children)b.setAttribute('aria-current',String(b.textContent===label));
 if(label==='班级任务')return;
 const title=document.createElement('h2');title.textContent=label;extra.append(title);
 if(label==='我的'){const p=document.createElement('p');p.textContent=member.display_name+' · 学生';extra.append(p,button('退出登录',()=>el('logout').click()));return}
 const choice=document.createElement('select');for(const set of sets){const option=document.createElement('option');option.textContent=set.title;choice.append(option)}extra.append(choice);
 const card=document.createElement('article');extra.append(card);
 function start(){const list=sets[choice.selectedIndex].words.slice();let index=0,score=0;
 function draw(){card.replaceChildren();if(index===list.length){card.textContent=label==='测单词'?'本次答对 '+score+' / '+list.length:'已完成本轮学习';card.append(button('再来一轮',start));return}
 const w=list[index];const question=document.createElement('h3');question.textContent=label==='测单词'?w.zh:w.en;card.append(question);
 const next=()=>{index++;draw()};
 if(label==='自主学习'){card.append(button('查看释义',()=>{card.replaceChildren(question,document.createTextNode(w.zh),button('下一词',next))}));return}
 const form=document.createElement('form'),input=document.createElement('input'),submit=document.createElement('button');input.required=true;input.placeholder='输入英文单词';input.autocomplete='off';submit.textContent='核对';form.append(input,submit);card.append(form);form.onsubmit=e=>{e.preventDefault();const ok=input.value.trim().toLowerCase()===w.en.toLowerCase();if(ok)score++;form.replaceWith(document.createTextNode(ok?'答对了':'正确拼写：'+w.en),button('下一题',next))};
 }draw()}choice.onchange=start;start()
}
for(const label of ['班级任务','自主学习','测单词','我的'])el('nav').append(button(label,()=>showTab(label)));

el('switch').onclick=()=>el('logout').click();
el('change').onsubmit=guard(async e=>{
 const form=e.target,data=new FormData(form),password=data.get('password');
 if(password!==data.get('confirm'))throw Error('两次输入的密码不一致。');
 const submit=form.querySelector('button');submit.disabled=true;
 try{await api('/auth/v1/user','PUT',{password});form.reset();await loadRoom()}finally{submit.disabled=false}
});
if(token)guard(loadRoom)();
