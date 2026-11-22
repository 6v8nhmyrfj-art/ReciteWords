import {speak,quiet} from './reading-audio.mjs';
import {partOfSpeech,example,norm as wordNorm} from './word-context.mjs?v=books-periods-20261106';
import {backendConfig} from './backend-config.mjs?v=classroom-20261120';
const norm=s=>wordNorm(s).replace(/[’‘]/g,"'");
const E=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n};
export function selectClassWords(goal,passes,size,from,to){
 const all=Array.from({length:goal.end-goal.start+1},(_,i)=>goal.start+i),done=new Set(passes.map(x=>x.index));
 if(size==='custom'){
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<goal.start||to>goal.end||to-from+1<10)return {error:'自选范围至少 10 个，且须在老师指定范围内',selected:[],pending:[]};
  const selected=all.filter(i=>i>=from&&i<=to);return {selected,pending:selected.filter(i=>!done.has(i))};
 }
 const selected=all.filter(i=>!done.has(i)).slice(0,Number(size));return {selected,pending:selected};
}
export async function classroom(api,options={}){
 if(document.querySelector('.cr-root'))return;
 if(!document.querySelector('#classroom-css')){const l=E('link');l.id='classroom-css';l.rel='stylesheet';l.href='./classroom.css?v=classroom-20261120';document.head.append(l)}
 const root=E('div',null,'cr-root'),main=E('div',null,'cr-main');root.setAttribute('role','dialog');root.setAttribute('aria-label','课堂过关');root.setAttribute('aria-modal','true');root.append(main);document.body.append(root);
 const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';const focused=document.activeElement;
 let catalog,teacher=false,cohort='',student='',library='',goal,detail,mode='reading',size='10',from=1,to=10,seq=0,closed=false,working=false;
 let session=null,run=null,storageKey='',audio,notice;
 const rpc=(action,p={})=>api('/rest/v1/rpc/rw_classroom','POST',{p_action:action,p_payload:p});
 const btn=(text,fn,cls='cr-soft')=>{const b=E('button',text,cls);b.type='button';b.onclick=async()=>{if(b.disabled)return;b.disabled=true;try{await fn()}catch(e){showError(e)}finally{if(b.isConnected)b.disabled=false}};return b};
 function showError(e){if(closed)return;if(notice?.isConnected)notice.textContent=e.message||String(e);else main.append(E('p',e.message||String(e),'cr-error'))}
 function close(){closed=true;seq++;quiet();root.remove();document.body.style.overflow=oldOverflow;focused?.focus?.();Promise.resolve(options.onClose?.()).catch(()=>{})}
 function top(title,back=close){const t=E('div',null,'cr-top');t.append(btn('‹ 返回',back,'cr-link'),E('strong',title));return t}
 function status(){notice=E('p',null,'cr-status');notice.setAttribute('role','status');return notice}
 function persist(){try{localStorage.setItem(storageKey,JSON.stringify(run))}catch{throw Error('本机无法保存测试进度，请释放存储空间后重试；已确认的云端过关不会丢失。')}}
 function forget(){try{localStorage.removeItem(storageKey)}catch{}run=null;session=null}
 function feedback(b,ok){b.classList.add(ok?'cr-correct':'cr-wrong');if(!ok)b.classList.add('cr-shake');else if(audio?.state==='running'){const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.connect(g);g.connect(audio.destination);o.frequency.value=880;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.09,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.start();o.stop(t+.23)}}
 function chime(){try{const C=window.AudioContext||window.webkitAudioContext;if(C){audio??=new C();audio.resume().catch(()=>{})}}catch{}}
 async function init(){main.replaceChildren(top('课堂过关'),E('p','正在加载课堂数据…'));catalog=await rpc('catalog');if(closed)return;teacher=catalog.role==='teacher';storageKey='rw-classroom-v1:'+backendConfig.environment+':'+catalog.member.user_id+(options.weeklyItem?':weekly:'+options.weeklyItem:'');
  try{run=JSON.parse(localStorage.getItem(storageKey));if(!run?.session)run=null}catch{run=null}
  if(options.weeklyItem){if(run){await resumeRun();return}session=await api('/rest/v1/rpc/rw_weekly','POST',{p_action:'begin',p_payload:{id:crypto.randomUUID(),item:options.weeklyItem}});run={session:session.id,offset:session.next_offset,answers:[],pending:null,result:null,title:options.title||'班级任务',studentName:catalog.member.display_name};persist();drawTest();return}
  if(teacher){cohort=catalog.members.find(m=>m.cohort)?.cohort||'';student=catalog.members.find(m=>m.cohort===cohort)?.user_id||'';library=catalog.goals.find(g=>g.cohort===cohort)?.library||catalog.libraries[0]?.id||''}
  else{cohort=catalog.member.cohort;student=catalog.member.user_id;library=catalog.goals[0]?.library||''}
  await load();
 }
 async function load(){if(options.weeklyItem){close();return}const stamp=++seq;working=true;goal=catalog.goals.find(g=>g.cohort===cohort&&g.library===library);detail=null;render();
  try{if(goal&&student){const d=await rpc('detail',{goal:goal.id,student,mode});if(stamp!==seq||closed)return;detail=d;goal={...goal,...d.goal};from=Math.max(goal.start,Math.min(from,goal.end-9));to=Math.max(from+9,Math.min(to,goal.end));}}
  finally{if(stamp===seq&&!closed){working=false;render()}}
 }
 function select(label,values,value,onchange){const l=E('label',label),s=E('select');s.setAttribute('aria-label',label);values.forEach(([v,t])=>{const o=E('option',t);o.value=v;s.append(o)});s.value=value;s.onchange=()=>Promise.resolve(onchange(s.value)).catch(showError);l.append(s);return l}
 function number(label,value,oninput){const l=E('label',label),n=E('input');n.type='number';n.inputMode='numeric';n.value=value;n.setAttribute('aria-label',label);n.oninput=()=>oninput(Number(n.value));l.append(n);return l}
 function modeButtons(){const box=E('div',null,'cr-modes');for(const [m,title,sub] of [['reading','英翻中','看英文 · 选中文'],['writing','中翻英','看中文 · 默写英文']]){const b=btn('',()=>{mode=m;return load()},m===mode?'cr-mode cr-on':'cr-mode');b.setAttribute('aria-pressed',String(m===mode));b.append(E('b',title),E('small',sub));box.append(b)}return box}
 function render(){if(closed||session)return;main.className='cr-main';main.replaceChildren(top(teacher?'教师版 · 课堂过关':'我的课堂过关'));
  const identity=E('div',null,'cr-identity');identity.append(E('h1',teacher?'课堂过关':catalog.member.display_name),E('small',teacher?'选学生进行课堂测试或认定过关':cohort||'待分班'));main.append(identity);main.firstChild.append(btn('刷新',async()=>{catalog=await rpc('catalog');return load()},'cr-link'));
  const sources=E('section',null,'cr-panel');
  if(teacher){const pair=E('div',null,'cr-pair');pair.append(select('班级',[...new Set(catalog.members.map(m=>m.cohort).filter(Boolean))].map(x=>[x,x]),cohort,v=>{cohort=v;student=catalog.members.find(m=>m.cohort===v)?.user_id||'';return load()}),select('学生',catalog.members.filter(m=>m.cohort===cohort).map(m=>[m.user_id,m.display_name]),student,v=>{student=v;return load()}));sources.append(pair)}
  const books=teacher?catalog.libraries.map(l=>[l.id,l.title]):catalog.goals.map(g=>[g.library,g.title]);sources.append(select('课堂词书',books,library,v=>{library=v;return load()}));main.append(sources);
  if(!goal){main.append(E('section',teacher?'尚未发布这本词书的课堂目标。':'老师还没有给本班发布课堂过关目标。','cr-panel'));if(teacher)main.append(btn('设置课堂目标',manage,'cr-primary'));main.append(status());return}
  const stats=E('section',null,'cr-panel'),row=E('div',null,'cr-between');row.append(E('h2',teacher?'该学生过关进度':'我的过关进度'),E('small',`第 ${goal.start}–${goal.end} 个`));stats.append(row);
  const total=goal.end-goal.start+1,passed=detail?.passes.length||0,grid=E('div',null,'cr-stats');
  for(const [value,title] of [[passed,'已过关'],[total-passed,'未过关'],[Math.round(passed/total*100)+'%','词条过关率']]){const d=E('div');d.append(E('b',working?'—':String(value)),E('small',title));grid.append(d)}stats.append(grid);const bar=E('progress');bar.max=total;bar.value=passed;bar.setAttribute('aria-label','词条过关进度');stats.append(bar);
  if(teacher&&detail?.roster?.length){const r=detail.roster,complete=r.filter(x=>Number(x.passed)===total).length,rate=Math.round(r.reduce((s,x)=>s+Number(x.passed),0)/(r.length*total)*100);stats.append(btn(`本班全部过关 ${complete}/${r.length} 人 · 词条 ${rate}%`,roster,'cr-class-link'))}main.append(stats);
  const modes=E('section',null,'cr-panel cr-mode-panel');modes.append(E('h2','测试方式'),modeButtons());main.append(modes);
  const choices=E('section',null,'cr-panel'),sizes=E('div',null,'cr-sizes');choices.append(E('h2','这次测多少？'));for(const [v,label] of [['10','10 个'],['20','20 个'],['50','50 个'],['custom','自选范围']]){const b=btn(label,()=>{size=v;render()},size===v?'cr-on':'');b.setAttribute('aria-pressed',String(size===v));sizes.append(b)}choices.append(sizes);
  const summary=E('div',null,'cr-selection');summary.setAttribute('aria-live','polite');const start=btn('',begin,'cr-primary');
  function update(){if(!detail){summary.textContent=working?'正在读取进度…':'进度加载失败，请刷新';start.disabled=true;start.textContent='开始测试';return}const x=selectClassWords(goal,detail.passes,size,from,to);summary.textContent=x.error||`已选 ${x.selected.length} · 已过关 ${x.selected.length-x.pending.length} · 需测 ${x.pending.length}`;start.disabled=working||!!x.error||!x.pending.length;start.textContent=x.pending.length?`开始测试 · ${x.pending.length} 个`:'当前范围已过关'}
  if(size==='custom'){const pair=E('div',null,'cr-pair cr-range');pair.append(number('起始序号',from,v=>{from=v;update()}),number('结束序号',to,v=>{to=v;update()}));choices.append(pair)}choices.append(summary);update();main.append(choices);
  if(run){const resume=btn('继续未完成：'+(run.studentName||'我')+' · '+(run.title||'课堂测试'),resumeRun,'cr-resume');main.append(resume)}
  const actions=E('div',null,'cr-actions');if(teacher)actions.append(btn('范围 / 认定过关',manage,'cr-soft'));actions.append(start);main.append(actions,E('small','每组最多 5 题 · 全对过关 · 错词重学再测','cr-rule'),status());
 }
 function modal(title){const d=E('dialog',null,'cr-dialog'),box=E('div',null,'cr-dialog-inner'),head=E('div',null,'cr-between');head.append(E('h2',title),btn('关闭',()=>d.close(),'cr-link'));box.append(head);d.append(box);root.append(d);d.addEventListener('close',()=>d.remove());d.showModal();return {d,box}}
 function roster(){const {box}=modal('本班过关情况 · '+(mode==='reading'?'英翻中':'中翻英')),list=E('div',null,'cr-list');for(const m of detail.roster){const b=btn(m.display_name+'　'+m.passed+' / '+(goal.end-goal.start+1),async()=>{student=m.user_id;box.closest('dialog').close();await load()},'cr-roster-row');list.append(b)}box.append(list)}
 function manage(){if(!teacher)return;const {d,box}=modal('范围与教师认定'),localStatus=E('p',null,'cr-status');localStatus.setAttribute('role','status');let a=goal?.start||1,b=goal?.end||Math.min(20,catalog.libraries.find(l=>l.id===library)?.count||0);
  box.append(E('p',cohort+' · '+(goal?.title||catalog.libraries.find(l=>l.id===library)?.title||''),'cr-sub'));
  const range=E('div',null,'cr-pair');range.append(number('目标起始',a,v=>a=v),number('目标结束',b,v=>b=v));box.append(range);
  box.append(btn('保存本班目标',async()=>{try{const result=await rpc('set_goal',{cohort,library,start:a,end:b,revision:goal?.revision||null});catalog=await rpc('catalog');d.close();await load();notice.textContent='课堂目标已保存'}catch(e){localStatus.textContent=e.message}},'cr-primary'));
  box.append(E('small','目标保留词书快照；调整范围不抹掉已有记录。','cr-sub'));
  if(goal&&detail){const name=catalog.members.find(m=>m.user_id===student)?.display_name||'';box.append(E('h3',name+' · '+(mode==='reading'?'英翻中':'中翻英')),E('p','勾选未过关词可认定；勾选教师认定词可撤销。','cr-sub'));
   const list=E('div',null,'cr-list'),passed=new Map(detail.passes.map(x=>[x.index,x]));const inputs=[];
   for(let i=goal.start;i<=goal.end;i++){const w=goal.words[i-1],r=passed.get(i),label=E('label',null,'cr-word-row'),c=E('input'),text=E('span'),source=E('small',r?.source==='teacher'?'教师认定':r?'测试通过':'未过关');c.type='checkbox';c.value=i;c.disabled=r?.source==='test';c.dataset.source=r?.source||'';c.setAttribute('aria-label','选择第 '+i+' 个 '+w.en);text.append(E('b',i+'. '+w.en),E('small',w.zh));label.append(c,text,source);inputs.push(c);list.append(label)}
   box.append(btn('勾选全部未过关',()=>inputs.forEach(c=>c.checked=!c.dataset.source),'cr-link'),list);
   let operation=null;
   const change=async(action)=>{try{const indices=inputs.filter(c=>c.checked&&(action==='mark'?!c.dataset.source:c.dataset.source==='teacher')).map(c=>Number(c.value));if(!indices.length)throw Error(action==='mark'?'请勾选未过关词':'请勾选需要撤销的教师认定词');operation??={action,p:{id:crypto.randomUUID(),goal:goal.id,student,mode,revision:goal.revision,indices}};if(operation.action!==action)throw Error('请先重试刚才的操作');const r=await rpc(operation.action,operation.p);operation=null;d.close();await load();notice.textContent=(action==='mark'?'已认定 ':'已撤销 ')+r.changed+' 个词'}catch(e){localStatus.textContent=e.message+'；如网络中断，请重试相同操作。'}};
   const actions=E('div',null,'cr-pair');actions.append(btn('撤销教师认定',()=>change('unmark'),'cr-soft'),btn('确认选中词过关',()=>change('mark'),'cr-primary'));box.append(actions);
  }box.append(localStatus);
 }
 async function begin(){if(working)return;if(run){notice.textContent='请先继续未完成测试，或在测试页结束该轮。';return}const x=selectClassWords(goal,detail.passes,size,from,to);if(x.error||!x.pending.length)return;
  const id=crypto.randomUUID();session=await rpc('begin',{id,goal:goal.id,student,mode,revision:goal.revision,size,start:from,end:to});if(closed)return;
  run={session:id,offset:session.next_offset,answers:[],pending:null,result:null,title:goal.title,studentName:teacher?catalog.members.find(m=>m.user_id===student)?.display_name:catalog.member.display_name};try{persist()}catch(e){session=null;run=null;throw e}drawTest();
 }
 async function resumeRun(){try{session=await rpc('resume',{session:run.session});if(closed)return;if(session.next_offset!==run.offset){run.offset=session.next_offset;run.answers=[];run.pending=null;run.result=null;persist()}drawTest()}catch(e){session=null;if(options.weeklyItem){main.replaceChildren(top('班级任务'),E('p',e.message),btn('重新进入任务',()=>{forget();return init()},'cr-primary'));return}render();notice.textContent=e.message;main.append(btn('结束此轮，保留已过关记录',()=>{forget();return load()},'cr-link'))}}
 function leaveTest(){quiet();session=null;return load()}
 function currentBatch(){return session.questions.slice(run.offset,run.offset+5)}
 function drawTest(){if(closed||!session||!run)return;quiet();main.className='cr-main cr-test';main.replaceChildren(top(run.studentName+' · '+run.title,leaveTest));
  if(run.result)return resultView();if(run.offset>=session.questions.length){main.append(E('section','本轮已全部过关','cr-panel'),btn('返回课堂',()=>{forget();return load()},'cr-primary'));return}
  if(run.answers.length>=currentBatch().length)return submit();
  const batch=currentBatch(),q=batch[run.answers.length],w=q.word,writing=session.mode==='writing',panel=E('section',null,'cr-test-card');main.append(panel);
  panel.append(E('small',`第 ${Math.floor(run.offset/5)+1} 组 · ${run.answers.length+1}/${batch.length} 题 · 总进度 ${run.offset+run.answers.length}/${session.questions.length}`));
  const progress=E('progress');progress.max=session.questions.length;progress.value=run.offset+run.answers.length;panel.append(progress);
  panel.append(E('h1',writing?w.zh:w.en),E('small',partOfSpeech(w)));
  const ex=example(w),sentence=writing?(w.test_translation||w.translation||ex?.zh):(w.test_example||w.example||ex?.en);if(sentence)panel.append(E('p',sentence,'cr-sentence'));
  const hint=E('p',null,'cr-status');hint.setAttribute('role','status');let busy=false;
  const choose=async(value,b)=>{if(busy)return;const current=session.id;busy=true;chime();quiet();const ok=[w.en,...(writing&&Array.isArray(w.alternatives)?w.alternatives:[])].some(x=>norm(x)===norm(value)&&norm(value)!=='');
   try{const previous=[...run.answers];run.answers.push(value);try{persist()}catch(e){run.answers=previous;throw e}panel.querySelectorAll('button,input').forEach(n=>n.disabled=true);feedback(b,ok);hint.textContent=ok?'答对！本组完成后保存过关。':'正确答案：'+w.en+' · '+w.zh+'；本组结束后重学错词。';await new Promise(r=>setTimeout(r,ok?220:850));if(!closed&&session?.id===current)drawTest()}catch(e){busy=false;hint.textContent=e.message}
  };
  if(writing){const input=E('input');input.placeholder='输入英文';input.setAttribute('aria-label','英文答案');input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;input.maxLength=1000;const b=btn('确认答案',()=>{if(!input.value.trim()){hint.textContent='请输入英文，或选择想不起来';return}return choose(input.value.trim(),b)},'cr-primary');input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();b.click()}};panel.append(input,b)}
  else for(const o of q.options){const b=btn(o.zh,()=>choose(o.en,b),'cr-option');panel.append(b)}
  const skip=btn('想不起来',()=>choose('',skip),'cr-link');panel.append(skip,hint);main.append(btn('结束本轮（保留已过关词）',()=>{forget();return load()},'cr-link'));
 }
 async function submit(){const draft=run,current=session.id;main.replaceChildren(top('正在保存本组',leaveTest),E('p','已记录答案，正在确认过关…'));try{run.pending??=crypto.randomUUID();persist();const r=await rpc('submit',{id:run.pending,session:session.id,offset:run.offset,answers:run.answers});if(run!==draft)return;run.result=r;persist();if(!closed&&session?.id===current)drawTest()}catch(e){if(closed||run!==draft||session?.id!==current)return;main.replaceChildren(top('保存尚未完成',leaveTest),E('p',e.message,'cr-error'),btn('重试保存',submit,'cr-primary'),E('p','答案已保留；网络恢复后使用相同编号重试。','cr-sub'))}}
 function resultView(){const r=run.result,card=E('section',null,'cr-test-card');card.append(E('h1',r.passed?'本组全部过关':'先巩固错词'),E('p',`本组答对 ${r.correct} / ${r.total}`));
  if(r.passed){card.append(E('p','云端已保存，本组词不会重复计数。'));card.append(btn(r.complete?'本轮完成，返回课堂':'测试下一组',()=>{if(r.complete){forget();return load()}run.offset=r.next_offset;session.next_offset=r.next_offset;run.answers=[];run.pending=null;run.result=null;persist();drawTest()},'cr-primary'))}
  else{card.append(E('p','本组暂未记过关。重学错词后，重新测试本组。'));card.append(btn('重学错词',()=>remedial(0),'cr-primary'))}main.append(card);
 }
 function remedial(i){if(closed||!session)return;const current=session.id;const wrong=run.result.results.filter(x=>!x.correct);if(i>=wrong.length){run.answers=[];run.pending=null;run.result=null;persist();return drawTest()}const r=wrong[i],w=r.word,q=session.questions.find(x=>x.index===r.index),context=example(w);main.replaceChildren(top('错词巩固',leaveTest));const card=E('section',null,'cr-test-card');card.append(E('small',`错词 ${i+1}/${wrong.length}`),btn(w.en,()=>speak([w.en]),'cr-word'),E('small',partOfSpeech(w)));const sentence=w.example||context?.en;if(sentence)card.append(btn(sentence,()=>speak([sentence]),'cr-sentence'));card.append(E('p',w.translation||context?.zh||''),E('p','选择正确的中文意思'));
  let opts=q.options;if(!opts?.length){const others=session.questions.filter(x=>x.word.zh!==w.zh).map(x=>({en:x.word.en,zh:x.word.zh}));opts=[{en:w.en,zh:w.zh},...others.filter((x,j)=>others.findIndex(y=>y.zh===x.zh)===j).slice(0,3)].sort(()=>Math.random()-.5)}
  let busy=false;const hint=E('p',null,'cr-status');for(const o of opts){const b=btn(o.zh,async()=>{if(busy)return;chime();const ok=norm(o.en)===norm(w.en);feedback(b,ok);if(!ok){hint.textContent=w.zh+'；请重新选择';speak([w.en,...(sentence?[sentence]:[])]);return}busy=true;await new Promise(r=>setTimeout(r,250));if(!closed&&session?.id===current)remedial(i+1)},'cr-option');card.append(b)}card.append(hint);main.append(card);speak([w.en]);
 }
 try{await init()}catch(e){main.replaceChildren(top('课堂过关'),E('p',e.message,'cr-error'),btn('重试加载',init,'cr-primary'))}
}
