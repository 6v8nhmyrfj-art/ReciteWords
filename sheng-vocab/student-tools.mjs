export {assessment} from './mastery.mjs?v=mastery-20261106';
import {audible,quiet,speak} from './reading-audio.mjs';
import {contexts,example,choices,norm,partOfSpeech} from './word-context.mjs?v=books-periods-20261106';

function corrections(rows,E){
 const box=E('div'),missed=rows.filter(a=>!a.correct);
 box.append(E('p',missed.length?'需复习':'本轮词汇全对'));
 for(const a of missed)box.append(audible(a.word),E('small',partOfSpeech({en:a.word,zh:a.meaning,pos:a.pos})));
 return box
}
function score(rows){return [...new Set(rows.map(x=>x.type))].map(type=>{const a=rows.filter(x=>x.type===type);return type+' '+a.filter(x=>x.correct).length+' / '+a.length}).join('　·　')}
export async function profile({app,E,button,row,api,me,member,summary,tasks,due,logout,active,review}){
 const who=encodeURIComponent(me.id);
 const [trend,recent,bookTests,groupTests]=await Promise.all([
  api('/rest/v1/rpc/rw_passed_periods','POST',{}),
  api('/rest/v1/rw_answers?student=eq.'+who+'&select=word,correct,at&order=at.desc&limit=30'),
  api('/rest/v1/rw_book_tests?select=title,answers,sentence,at&order=at.desc&limit=30'),
  api('/rest/v1/rw_group_tests?select=title,answers,correct,at&order=at.desc&limit=30')
 ]);
 const tests=[...bookTests,...groupTests.map(t=>({...t,title:t.title+' · '+t.answers.length+'题组测',answers:t.answers.map(a=>({...a,type:'填空'})),sentence:{response:'',reference:'正确率 '+Math.round(100*t.correct/t.answers.length)+'% · '+(t.correct/t.answers.length>=0.9?'已通过':'待重测')}}))];
 if(!active())return;
 const hero=E('section',null,'hero'),history=E('section');
 function chart(period){
  const labels={day:'今日过关',week:'本周',month:'本月',year:'本年'},data=trend[period],values=data.points;
  hero.replaceChildren(E('small',member.display_name+' · '+(summary.cohort||'学习档案')),E('h2',(period==='day'?'今日过关':labels[period]+'过关')+' '+data.total+' 词'));
  const controls=E('div');controls.style.cssText='display:flex;gap:6px;margin:10px 0;flex-wrap:wrap';
  for(const [key,label] of Object.entries(labels)){
   const toggle=button(label,()=>chart(key));toggle.setAttribute('aria-pressed',String(key===period));
   toggle.style.cssText='padding:7px 9px;border-radius:8px;border:1px solid #85a9d5;background:'+(key===period?'white':'#17457f')+';color:'+(key===period?'#174e90':'white')+';font-weight:'+(key===period?'700':'400');
   controls.append(toggle)
  }
  hero.append(controls,E('small','只计通过组测时答对的词 · 周期内去重'));
  const viewport=E('div');viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label',labels[period]+'过关词汇折线图');
  viewport.style.cssText='width:100%;overflow-x:auto;overscroll-behavior-x:contain;margin:10px 0';
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  const peak=Math.max(1,...values.map(v=>Number(v.total)||0)),spacing=Math.max(period==='year'?22:32,String(peak).length*7+10);
  const width=Math.max(300,values.length*spacing+24),left=20,right=width-20,top=30,bottom=137;
  svg.setAttribute('viewBox','0 0 '+width+' 179');svg.style.cssText='display:block;width:100%;min-width:'+width+'px;height:179px;margin:0';
  function shape(tag,attrs,text){
   const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
   if(text!==undefined)n.textContent=text;svg.append(n);return n
  }
  shape('line',{x1:left,y1:bottom,x2:right,y2:bottom,stroke:'#8bb5e4','stroke-width':1});
  const dots=values.map((v,i)=>({v,x:left+(right-left)*i/Math.max(1,values.length-1),y:bottom-(Number(v.total)||0)/peak*(bottom-top)}));
  const actual=dots.filter(d=>d.v.total!==null);
  if(actual.length)shape('polyline',{points:actual.map(d=>d.x+','+d.y).join(' '),fill:'none',stroke:'#b8e1ff','stroke-width':2.5,'stroke-linejoin':'round'});
  for(const {v,x,y} of dots){
   const label=period==='day'?Number(v.day.slice(11,13))+'时':period==='year'?Number(v.day.slice(5,7))+'月':period==='week'?['一','二','三','四','五','六','日'][dots.findIndex(d=>d.v===v)]:String(Number(v.day.slice(8,10)));
   shape('text',{x,y:163,'text-anchor':'middle',fill:'#d6eaff','font-size':11},label);
   if(v.total===null){shape('text',{x,y:bottom-10,'text-anchor':'middle',fill:'#9db6d3','font-size':12},'—');continue}
   shape('circle',{cx:x,cy:y,r:3.5,fill:'#fff',stroke:'#b8e1ff','stroke-width':1.5});
   shape('text',{x,y:y-10,'text-anchor':'middle',fill:'#fff','font-size':12,'font-weight':600},v.total);
  }
  viewport.append(svg);hero.append(viewport,E('small',data.start+' 至 '+data.end),E('br'),
   E('small',(period==='day'?'按小时':period==='year'?'按月':'按天')+'统计过关词汇；未到时间显示 —。可左右滑动查看。'))
 }
 function records(filter,page=0){
  const items=[...recent.map(a=>({at:a.at,type:'背词',word:a.word,label:a.word+' · '+(a.correct?'答对':'待巩固')})),...tests.map(x=>({at:x.at,type:'测评',label:x.title+' · '+score(x.answers),test:x}))].filter(x=>!filter||x.type===filter).sort((a,b)=>b.at.localeCompare(a.at));
  const pages=Math.max(1,Math.ceil(items.length/10));
  page=Math.max(0,Math.min(page,pages-1));
  const controls=E('div'),previous=button('上一页',()=>records(filter,page-1)),next=button('下一页',()=>records(filter,page+1));
  previous.disabled=page===0;next.disabled=page===pages-1;
  controls.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px';
  const pageLabel=E('small','第 '+(page+1)+' / '+pages+' 页');pageLabel.setAttribute('aria-live','polite');
  controls.append(previous,pageLabel,next);
  const viewport=E('div');viewport.setAttribute('aria-label','最近学习记录');viewport.setAttribute('role','region');viewport.tabIndex=0;
  viewport.style.cssText='max-height:min(430px,52dvh);overflow-y:auto;overscroll-behavior:contain;padding:0 4px';
  history.replaceChildren(controls,E('h2','最近学习'),...['全部','背词','测评'].map((s,i)=>button(s,()=>records(i?s:''))),viewport);
  for(const item of items.slice(page*10,(page+1)*10)){const d=E('details'),label=E('summary',new Date(item.at).toLocaleDateString('zh-CN')+'　'+item.label);if(item.test){d.append(label,corrections(item.test.answers,E));if(item.test.sentence?.kind!=='mastery')d.append(E('small','你的译文'),item.test.sentence.response?audible(item.test.sentence.response):E('p','已跳过'),audible(item.test.sentence.reference));viewport.append(d)}else{const line=E('p',new Date(item.at).toLocaleDateString('zh-CN')+' · '+item.label.slice(item.word.length+3));line.append(audible(item.word));viewport.append(line)}}
  if(!items.length)viewport.append(E('p','还没有这类记录'))
 }
 chart('day');records('');
 const done=E('section'),list=E('div');done.append(E('h2','已完成任务'),list);
 list.append(button('查看打卡记录',async()=>{
  const groups=new Map();let offset=0;
  while(true){const rows=await api('/rest/v1/rw_progress?select=learned_on,task_id,word_index&user_id=eq.'+who+'&order=learned_on.desc,task_id,word_index&limit=500&offset='+offset);for(const r of rows){const key=r.learned_on+' '+r.task_id;if(!groups.has(key))groups.set(key,new Set());groups.get(key).add(r.word_index)}if(rows.length<500)break;offset+=rows.length}
  if(!active())return;list.replaceChildren();for(const [key,indices] of groups){const [date,id]=key.split(' '),task=tasks.find(t=>t.id===id);if(task&&task.words.every((_,i)=>indices.has(i)))list.append(E('p',date+'　'+task.title))}
  if(!list.childNodes.length)list.append(E('p','暂无已完成的班级任务'))
 }));
 app.append(hero,history,done,row('到期复习',due.length+' 词',review),button('退出登录',()=>{if(confirm('确认退出当前账号？学习记录已保存在云端。'))logout()}))
}
