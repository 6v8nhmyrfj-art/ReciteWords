import {audible,quiet,speak} from './reading-audio.mjs';
import {contexts,example,choices,norm,partOfSpeech} from './word-context.mjs';

function corrections(rows,E){
 const box=E('div'),missed=rows.filter(a=>!a.correct);
 box.append(E('p',missed.length?'需复习':'本轮词汇全对'));
 for(const a of missed)box.append(audible(a.word),E('small',partOfSpeech({en:a.word,zh:a.meaning,pos:a.pos})));
 return box
}
export function assessment({t,basic,app,E,button,mix,api,active,back}){
 const unique=[...new Map(t.words.map(w=>[norm(w.en),w])).values()];
 const rank=w=>Number.isFinite(w.difficulty)?w.difficulty:contexts.get(norm(w.en))?.rank??100;
 const words=mix(unique).slice(0,20).sort((a,b)=>rank(a)-rank(b));
 const answers=[],id=crypto.randomUUID(),card=E('section',null,'card');
 app.replaceChildren(button('‹ 返回',back,'back'),E('h1',t.title+' · 测评'),card);
 function record(w,type,value){
  answers.push({word:w.en,meaning:w.zh,pos:partOfSpeech(w),type,correct:norm(value)===norm(w.en)});
  next()
 }
 function next(){quiet();
  const i=answers.length;
  if(i===words.length){translation();return}
  const w=words[i],read=i%2===0,bar=E('progress');bar.max=words.length;bar.value=i;
  card.replaceChildren(E('small','第 '+(i+1)+' / '+words.length+' 词'),E('br'),bar,E('p',read?'阅读 · 选择中文意思':'写作 · 拼出本书对应的英文'),audible(read?w.en:w.zh,'word',read?'en-US':'zh-CN'),E('small',partOfSpeech(w)));
  speak([read?w.en:w.zh],read?'en-US':'zh-CN');
  if(read){for(const opt of choices(w,[...unique,...basic.words],mix))card.append(button(opt.zh,()=>record(w,'阅读',opt.en),'option'))}
  else{
   const form=E('form'),input=E('input'),submit=E('button','提交','primary');input.required=true;input.placeholder='输入英文';input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;
   form.append(input,submit);form.onsubmit=e=>{e.preventDefault();record(w,'拼写',input.value)};card.append(form)
  }
  card.append(button('不会，跳过',()=>record(w,read?'阅读':'拼写',''),'back'))
 }
 function translation(){
  const w=[...words].reverse().find(example);
  const sentence=w?example(w):{en:'How do you spell the word "'+words[0].en+'"?',zh:'你怎么拼写表示“'+words[0].zh+'”的这个英语单词？'};
  const input=E('textarea'),hint=E('p','可用键盘听写或打字。点语音后，浏览器可能使用其语音服务。');input.maxLength=600;input.placeholder='用英语翻译，可在提交前修改';input.style.width='100%';input.rows=3;
  let rec=null,payload;
  function stop(){if(rec){rec.onresult=null;rec.abort();rec=null}}
  const observer=new MutationObserver(()=>{if(!card.isConnected){stop();observer.disconnect()}});observer.observe(app,{childList:true});
  const mic=button('说出英文',()=>{
   quiet();if(rec){rec.stop();return}
   const R=window.SpeechRecognition||window.webkitSpeechRecognition;
   if(!R){hint.textContent='请使用手机键盘上的听写按钮，或直接输入。';input.focus();return}
   const r=new R();r.lang='en-US';r.onresult=e=>{input.value=(input.value+' '+e.results[0][0].transcript).trim().slice(0,600)};
   r.onerror=()=>{hint.textContent='未收到清晰的录音，可以重试或打字。'};r.onend=()=>{rec=null;mic.textContent='说出英文'};r.start();rec=r;mic.textContent='结束录音'
  });
  async function finish(skip){
   if(!skip&&!input.value.trim()){input.focus();return}
   stop();observer.disconnect();
   payload??={id,title:t.title.slice(0,200),answers,sentence:{prompt:sentence.zh,reference:sentence.en,response:skip?'':input.value.trim()}};
   const buttons=[...card.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);input.disabled=true;
   try{await api('/rest/v1/rw_book_tests','POST',payload)}catch(e){
    if(e.status!==409||!(await api('/rest/v1/rw_book_tests?id=eq.'+id+'&select=id')).length){hint.textContent='未确认保存，请重试。';throw e}
   }
   if(!active())return;
   card.replaceChildren(E('h2','本次抽测结果'),E('p',score(answers)),corrections(answers,E),E('small','你的译文'),payload.sentence.response?audible(payload.sentence.response):E('p','已跳过'),E('small','参考译文'),audible(sentence.en),E('small','对照意思核对译文；句子单列，不计入词汇正确率。'),button('返回',back,'primary'))
  }
  card.replaceChildren(E('small','词汇 '+words.length+' / '+words.length+' 已完成'),E('h2','最后一题 · 汉译英'),audible(sentence.zh,'','zh-CN'),input,mic,button('确认并保存',()=>finish(false),'primary'),button('跳过并保存',()=>finish(true),'back'),hint)
 }
 next()
}
function score(rows){return ['阅读','拼写'].map(type=>{const a=rows.filter(x=>x.type===type);return type+' '+a.filter(x=>x.correct).length+' / '+a.length}).join('　·　')}
export async function profile({app,E,button,row,api,me,member,summary,tasks,due,logout,active,review}){
 const who=encodeURIComponent(me.id);
 const [trend,recent,tests]=await Promise.all([
  api('/rest/v1/rpc/rw_vocabulary_trend','POST',{}),
  api('/rest/v1/rw_answers?student=eq.'+who+'&select=word,correct,at&order=at.desc&limit=30'),
  api('/rest/v1/rw_book_tests?select=title,answers,sentence,at&order=at.desc&limit=30')
 ]);
 if(!active())return;
 const hero=E('section',null,'hero'),history=E('section');
 function chart(n){
  const values=trend.slice(-n),last=Number(values.at(-1)?.total||0),first=Number(values[0]?.total||0);
  hero.replaceChildren(E('small',member.display_name+' · '+(summary.cohort||'学习档案')),E('h2','累计答对 '+last+' 词'),E('small','按单词去重 · 近 '+n+' 天趋势'));
  const bars=E('div');bars.style.cssText='height:48px;display:flex;align-items:end;gap:2px;margin:10px 0';
  for(const v of values){const b=E('i');b.title=v.day+' · '+v.total+' 词';b.style.cssText='flex:1;background:#c8e7ff;border-radius:2px;height:'+Math.max(2,100*(v.total-first)/Math.max(1,last-first))+'%';bars.append(b)}
  hero.append(bars,E('small',(values[0]?.day||'')+' 至 '+(values.at(-1)?.day||'')+'　期内净增 '+(last-first)+' 词'),E('br'),button('7 天',()=>chart(7)),button('30 天',()=>chart(30)))
 }
 function records(filter){
  const items=[...recent.map(a=>({at:a.at,type:'背词',word:a.word,label:a.word+' · '+(a.correct?'答对':'待巩固')})),...tests.map(x=>({at:x.at,type:'测评',label:x.title+' · '+score(x.answers),test:x}))].filter(x=>!filter||x.type===filter).sort((a,b)=>b.at.localeCompare(a.at));
  history.replaceChildren(E('h2','最近学习'),...['全部','背词','测评'].map((s,i)=>button(s,()=>records(i?s:''))));
  for(const item of items.slice(0,30)){const d=E('details'),label=E('summary',new Date(item.at).toLocaleDateString('zh-CN')+'　'+item.label);if(item.test){d.append(label,corrections(item.test.answers,E),E('small','你的译文'),item.test.sentence.response?audible(item.test.sentence.response):E('p','已跳过'),audible(item.test.sentence.reference));history.append(d)}else{const line=E('p',new Date(item.at).toLocaleDateString('zh-CN')+' · '+item.label.slice(item.word.length+3));line.append(audible(item.word));history.append(line)}}
  if(!items.length)history.append(E('p','还没有这类记录'))
 }
 chart(7);records('');
 const done=E('section'),list=E('div');done.append(E('h2','已完成任务'),list);
 list.append(button('查看打卡记录',async()=>{
  const groups=new Map();let offset=0;
  while(true){const rows=await api('/rest/v1/rw_progress?select=learned_on,task_id,word_index&user_id=eq.'+who+'&order=learned_on.desc,task_id,word_index&limit=500&offset='+offset);for(const r of rows){const key=r.learned_on+' '+r.task_id;if(!groups.has(key))groups.set(key,new Set());groups.get(key).add(r.word_index)}if(rows.length<500)break;offset+=rows.length}
  if(!active())return;list.replaceChildren();for(const [key,indices] of groups){const [date,id]=key.split(' '),task=tasks.find(t=>t.id===id);if(task&&task.words.every((_,i)=>indices.has(i)))list.append(E('p',date+'　'+task.title))}
  if(!list.childNodes.length)list.append(E('p','暂无已完成的班级任务'))
 }));
 app.append(hero,history,done,row('到期复习',due.length+' 词',review),button('退出登录',()=>{if(confirm('确认退出当前账号？学习记录已保存在云端。'))logout()}))
}
