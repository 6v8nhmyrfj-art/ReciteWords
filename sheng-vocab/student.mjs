import {groupStudy} from './group-study.mjs';
import {speak,audible,quiet} from './reading-audio.mjs';
import {example,choices,norm,partOfSpeech} from './word-context.mjs';
import {assessment,profile} from './student-tools.mjs';
export async function student(api,me,member,basic,logout){
const link=document.createElement('link');link.rel='stylesheet';link.href='./student.css';document.head.append(link);
const E=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e};
const header=E('header'),app=E('main'),nav=E('nav'),msg=E('p');msg.setAttribute('role','status');header.append(E('b','S'),E('strong','盛老师词汇训练'),E('small',member.display_name));document.body.replaceChildren(header,msg,app,nav);
let known=[],tasks=[],progress=[],due=[],summary={},tab=0,version=0,loadedDay='';
const tabs=['班级任务','自主学习','测单词','我的'];
function button(text,fn,cls='soft'){const b=E('button',text,cls);b.onclick=async()=>{b.disabled=true;msg.textContent='';try{await fn()}catch(e){msg.textContent=e.message}finally{b.disabled=false}};return b}
function row(name,detail,fn){const b=button('',fn,'row'),s=E('span');s.append(E('strong',name),E('small',detail));b.append(E('em','Aa'),s,E('b','›'));return b}
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
async function refresh(){loadedDay=day();[tasks,progress,due,summary,known]=await Promise.all([api('/rest/v1/rw_tasks?select=id,title,words&order=created_at.desc'),api('/rest/v1/rw_progress?select=task_id,word_index&learned_on=eq.'+day()),api('/rest/v1/rw_review_cards?select=word,meaning,due_at&due_at=lte.now&order=due_at.asc&limit=1000'),api('/rest/v1/rpc/rw_student_summary','POST',{}),api('/rest/v1/rw_known_checks?select=word,meaning,due_at,state&order=due_at.asc&limit=1000')]);tasks=tasks.filter(t=>t.words.length)}
const pending=t=>t.words.map((_,i)=>i).filter(i=>!progress.some(r=>r.task_id===t.id&&r.word_index===i));
async function home(i){quiet();const stamp=++version;tab=i;app.replaceChildren(E('h1',tabs[i]));nav.replaceChildren(...tabs.map((label,k)=>{const b=button('',()=>home(k),k===i?'on':'');b.append(E('span',['⌂','▤','✎','○'][k]),E('small',label));return b}));await refresh();if(stamp!==version)return;
if(i===0){const t=tasks.find(t=>pending(t).length)||tasks[0],hero=E('section',null,'hero');if(t){const count=t.words.length-pending(t).length,bar=E('span',null,'bar'),fill=E('i');fill.style.width=(100*count/t.words.length)+'%';bar.append(fill);hero.append(E('small',(summary.cohort||'班级')+' · 今日任务'),E('h2',t.title),bar,E('small','已学 '+count+' / '+t.words.length+' 词'),E('br'),button(count===t.words.length?'复习本组':'继续学习　→',()=>start(t,count===t.words.length?'self':'task'),'action'))}else hero.append(E('h2','今天还没有班级任务'),button('去自主学习',()=>home(1),'action'));app.append(hero);
const grid=E('div',null,'grid');for(const [v,k] of [[summary.today,'今日已学'],[summary.days+' 天','本周打卡'],[summary.accuracy==null?'—':summary.accuracy+'%','本周正确率']]){const d=E('div',null,'metric');d.append(E('b',v),E('small',k));grid.append(d)}app.append(grid);if(t)app.append(row('任务词汇自测',t.title,()=>start(t,'quiz')));for(const other of tasks.filter(x=>x!==t))app.append(row(other.title,'剩余 '+pending(other).length+' 词',()=>start(other,pending(other).length?'task':'self')))}
if(i===0||i===1){const n=known.filter(x=>x.state!=='relearn'&&Date.parse(x.due_at)<=Date.now()).length;if(n)app.append(row('熟词抽查',n+' 个已斩词到期',()=>start({title:'熟词抽查',words:[]},'check')));app.append(row('到期复习',due.length?due.length+' 词待巩固':'今天的到期词已清',()=>due.length?start({title:'到期复习',words:due.slice(0,20).map(r=>({en:r.word,zh:r.meaning}))},'review'):home(i)))}
if(i===1||i===2){for(const t of [basic,...tasks])app.append(row(t.title,t.words.length+' 词',()=>start(t,i===1?'self':'quiz')))}
if(i===3)await profile({app,E,button,row,api,me,member,summary,tasks,due,logout,active:()=>stamp===version,review:()=>home(1)});}
let audio;
function prepareChime(){try{const C=window.AudioContext||window.webkitAudioContext;if(C){audio??=new C();if(audio.state==='suspended')audio.resume().catch(()=>{})}}catch{}}
function feedback(b,ok){
 b.style.background=ok?'#d8f5df':'#ffe1df';b.style.color=ok?'#145c30':'#912822';b.style.borderColor=ok?'#339557':'#cd5047';b.style.opacity='1';
 if(ok&&audio?.state==='running'){const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.frequency.value=880;o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.09,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.start(t);o.stop(t+.23)}
 if(!ok&&!matchMedia('(prefers-reduced-motion: reduce)').matches)b.animate?.([{transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}],{duration:260});
}
function mix(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function start(t,mode,groupConfig){if(day()!==loadedDay)return home(tab);const stamp=groupConfig?.stamp??++version,key='rw-study:'+me.id+':'+(t.id||'basic');let list=t.words.map((_,i)=>i);if(mode==='quiz')return assessment({t,basic,app,E,button,mix,api,active:()=>stamp===version,back:()=>home(tab)});if(!groupConfig&&(mode==='task'||mode==='self'))return groupStudy({t,basic,mode,api,me,app,E,button,mix,active:()=>stamp===version,back:()=>home(tab),prepareChime,feedback,learn:(book,config)=>start(book,mode,{...config,stamp})});
if(mode==='task'&&!groupConfig)list=pending(t);if(mode==='self'&&!groupConfig){const n=Number(localStorage.getItem(key))||0;let queue;try{queue=JSON.parse(localStorage.getItem(key+':queue'))}catch{}if(Array.isArray(queue)&&queue.length&&queue.every(x=>Number.isInteger(x)&&x>=0&&x<t.words.length))list=queue;else if(n>0&&n<list.length)list=list.slice(n)}
if(groupConfig)list=[...groupConfig.list];
if(mode==='self'&&!groupConfig)list=list.filter(k=>!known.some(x=>x.word===norm(t.words[k].en)&&x.state!=='relearn'));
const total=list.length;let correct=0,tries=0,skipped=0;
const check=known.find(x=>x.state!=='relearn'&&Date.parse(x.due_at)<=Date.now());
if(check && mode!=='relearn' && mode!=='quiz'){
 const card=E('section',null,'card'),w={en:check.word,zh:check.meaning};app.replaceChildren(E('h1','熟词抽查'),card);
 card.append(E('small','之前斩过的词 · 独立回忆'),audible(w.en,'word'),E('small',partOfSpeech(tasks.flatMap(t=>t.words).find(x=>norm(x.en)===norm(w.en))||w)),E('p','选择中文意思'));speak([w.en]);
 let id=crypto.randomUUID(),choice=null,locked=false;
 for(const opt of [...choices(w,[...t.words,...basic.words],mix),{en:'',zh:'想不起来'}])card.append(button(opt.zh,async()=>{
  if(locked)return;locked=true;choice??=opt;
  try{const ok=await api('/rest/v1/rpc/rw_check_familiar','POST',{p_id:id,p_word:w.en,p_choice:choice.en});
  if(stamp!==version)return;
  if(!ok){await refresh();if(stamp!==version)return;return start({title:'重新学习',words:[w]},'relearn')}
  known=known.filter(x=>x!==check);if(mode==='check')return home(tab);draw()
  }catch(e){locked=false;throw e}
 },'option'));return
}

function draw(){if(stamp!==version)return;quiet();app.replaceChildren(button('‹ '+tabs[tab],()=>home(tab),'back'),E('h1',t.title));const card=E('section',null,'card');app.append(card);if(!list.length){if(groupConfig)return groupConfig.done();if(mode==='self'){localStorage.removeItem(key);localStorage.removeItem(key+':queue')}card.append(E('h2',mode==='task'&&!skipped?'今日任务已打卡':skipped?'本轮学习结束':'本轮完成'),E('p','作答 '+tries+' 次 · 答对 '+correct+' 次'+(skipped?' · 跳过 '+skipped+' 词，未计打卡':'')),button('返回'+tabs[tab],()=>home(tab),'primary'));return}
const index=list[0],w=t.words[index],context=example(w)||example(tasks.flatMap(x=>x.words).find(x=>norm(x.en)===norm(w.en)&&example(x))||w);
card.append(E('small','第 '+(total-list.length+1)+' / '+total+' 词'),audible(w.en,'word'),E('small',partOfSpeech({...tasks.flatMap(t=>t.words).find(x=>norm(x.en)===norm(w.en)),...w})));speak([w.en]);
const supplied=context?.en;
const target=norm(w.en);
const sentence=supplied&&(' '+norm(supplied).replace(/[^a-z0-9'-]+/g,' ')+' ').includes(' '+target+' ')?supplied:'Can you spell “'+w.en+'”?';
if(mode!=='review'||known.some(x=>x.word===target&&x.state==='relearn'))card.append(audible(sentence));
card.append(E('p','选择正确的中文意思'));
let busy=false,pendingChoice=null,requestId=null;
const options=choices(w,[...t.words,...basic.words],mix);
const hint=E('p');hint.setAttribute('role','status');
for(const choice of options){
 const option=button(choice.zh,async()=>{
  if(busy||stamp!==version)return;
  if(day()!==loadedDay)return home(tab);
  prepareChime();if(!pendingChoice&&norm(choice.en)!==target)speak([w.en,sentence]);
  busy=true;pendingChoice??=choice;requestId??=crypto.randomUUID();
  const buttons=[...card.querySelectorAll('.option')];buttons.forEach(b=>b.disabled=true);
  try{
   const ok=await api('/rest/v1/rpc/rw_practice','POST',{p_id:requestId,p_mode:groupConfig?'self':mode==='relearn'?'review':mode,p_task:groupConfig?groupConfig.refs[index].task:t.id||null,p_index:groupConfig?groupConfig.refs[index].index:index,p_word:norm(w.en),p_choice:pendingChoice.en});
   if(stamp!==version)return;
   feedback(option,ok);tries++;requestId=null;pendingChoice=null;
   if(!ok){card.querySelector('button.back')?.remove();hint.textContent=(sentence===supplied&&context?.zh?context.zh+' ':'')+w.en+' 的意思是「'+w.zh+'」。再选一次。';buttons.forEach(b=>b.disabled=false);return}
   correct++;list.shift();groupConfig?.update(list);
   if(mode==='self'&&!groupConfig){localStorage.setItem(key+':queue',JSON.stringify(list));localStorage.setItem(key,String(list[0]??0))}
   await new Promise(resolve=>setTimeout(resolve,420));draw();
  }catch(error){hint.textContent='保存失败，请点刚才的选项重试。';throw error}
  finally{busy=false}
 },'option');card.append(option)
}
card.append(hint);
if((mode==='self'||mode==='task')&&!known.some(x=>x.word===norm(w.en)))card.append(button('斩 · 这个词我很熟',async()=>{
 if(busy||pendingChoice)return;busy=true;
 try{await api('/rest/v1/rpc/rw_skip_familiar','POST',{p_task:groupConfig?groupConfig.refs[index].task:t.id||null,p_index:groupConfig?groupConfig.refs[index].index:index,p_word:norm(w.en),p_meaning:w.zh});
 if(stamp!==version)return;known.push({word:norm(w.en),state:'pending'});list.shift();skipped++;groupConfig?.update(list);
 if(mode==='self'&&!groupConfig)localStorage.setItem(key+':queue',JSON.stringify(list));
 draw();msg.textContent='已安排熟词抽查，本次跳过不计答对。'
 }finally{busy=false}
},'back'))
}
draw()}
try{await home(0)}catch(e){msg.textContent=e.message;app.append(button('重新加载',()=>home(tab)))}
}
