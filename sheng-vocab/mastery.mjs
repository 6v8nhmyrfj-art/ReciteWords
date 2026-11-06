import {speak,quiet} from './reading-audio.mjs';
import {example,partOfSpeech} from './word-context.mjs?v=books-periods-20261106';
const norm=s=>String(s||'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
const modeLabel=m=>m==='writing'?'作文默写':'阅读辨义';
function summaryNodes(s,E){
 const heading=s.estimate==null?(s.tested?'样本不足，继续测评':'待测评'):'大致掌握 '+(s.coverage<100?'约 ':'')+s.estimate+'%';
 const bar=E('progress');bar.max=100;bar.value=s.estimate??0;bar.setAttribute('aria-label',heading);bar.style.cssText='width:100%;height:12px;accent-color:#347bc8';
 return [E('h2',heading),bar,E('p','已测覆盖 '+s.tested+' / '+s.total+' 词 · '+s.coverage+'%'),E('small','最近独立答对 '+s.correct+' 词 · 延迟复测通过 '+s.delayed+' 词'),E('p',s.last_test?'最近测评：'+new Date(s.last_test).toLocaleString('zh-CN'):'尚无有效测评'),...(s.ungraded?[E('small','含 '+s.ungraded+' 个未分级条目，暂按常用层抽取。')]:[])];
}
export async function masteryBooks({api,app,E,button,active,start}){
 const books=await api('/rest/v1/rpc/rw_mastery_books','POST',{});if(!active())return;
 const info=E('details');info.append(E('summary','掌握度怎么算？'),E('p','每次最多 20 词，按老师设置的难度分层随机抽取，从基础到进阶。按各层在词书中的占比估计掌握度；未分级的词随机抽取，长度只用于层内展示顺序。'),E('p','使用每个词最近一次独立作答；答错会下调。至少测 5 词（不足 5 词的书测完全部），并覆盖各难度层才显示估计。它是带例句的词书测评估计，不是全英语词汇量或长期记牢的证明。'),E('p','间隔至少 24 小时再次答对、期间没有答错，才计入延迟复测通过。听音辅助的题保留结果，不纳入独立掌握度。旧版测评保留在「我的」，不混入本次统计。'));
 app.append(info,E('p','词书由老师制作；可在「自主学习 → 添加单词书」中选入。'));
 for(const b of books){const card=E('section',null,'card');card.append(E('small',modeLabel(b.category)+' · '+({basic:'基础词书',library:'我的词书',task:'班级任务'}[b.kind])),E('h2',b.title),...summaryNodes(b.summary,E),button(b.summary.tested?'继续测评 / 复测':'开始测评',()=>start(b),'primary'));app.append(card)}
}
export async function assessment({t,api,app,E,button,active,back,prepareChime,feedback,me}){
 quiet();app.replaceChildren(E('p','正在准备测评…'));
 const session=await api('/rest/v1/rpc/rw_begin_mastery','POST',{p_kind:t.kind||(t.id?'task':'basic'),p_source:t.id||null,p_mode:t.category||null});if(!active())return;
 const key='rw-mastery:'+(me?.id||'session')+':'+session.id;let answers=[],busy=false,assisted=false;
 try{const saved=JSON.parse(localStorage.getItem(key));if(Array.isArray(saved)&&saved.length<=session.questions.length&&saved.every(a=>a&&typeof a.value==='string'))answers=saved}catch{}
 const persist=()=>{try{localStorage.setItem(key,JSON.stringify(answers))}catch{}};
 async function finish(){
  if(!active())return;app.replaceChildren(E('h1','正在保存测评…'));
  try{const result=await api('/rest/v1/rpc/rw_finish_mastery','POST',{p_test:session.id,p_responses:answers});if(!active())return;
   try{localStorage.removeItem(key)}catch{}
   const card=E('section',null,'card');card.append(E('h2',session.title),E('p',modeLabel(result.mode)+' · 本次答对 '+result.results.filter(r=>r.correct).length+' / '+result.results.length),...summaryNodes(result.summary,E));
   const details=E('details');details.append(E('summary','查看本次逐词结果'));
   for(const r of result.results)details.append(E('p',(r.correct?'✓ ':'✗ ')+r.word+' · '+r.meaning+(r.assisted?'（听音辅助）':'')+(r.correct?'':' · 你的答案：'+(r.response||'未作答'))));
   card.append(details,button('返回词书',back,'primary'));app.replaceChildren(E('h1','测评已保存'),card);
  }catch(e){if(!active())return;app.replaceChildren(E('h2','保存未完成'),E('p',e.message),button('重试保存',finish,'primary'),button('稍后继续',back))}
 }
 function draw(){
  if(!active())return;quiet();if(answers.length===session.questions.length)return finish();
  busy=false;assisted=false;const q=session.questions[answers.length],writing=session.mode==='writing',card=E('section',null,'card'),hint=E('p');hint.setAttribute('role','status');
  const progress=E('progress');progress.max=session.questions.length;progress.value=answers.length;progress.style.width='100%';
  app.replaceChildren(button('‹ 返回（保留进度）',back,'back'),E('h1',session.title),card);
  card.append(E('small',modeLabel(session.mode)+' · 第 '+(answers.length+1)+' / '+session.questions.length+' 题'),progress,E('small',['','基础','常用','进阶'][q.difficulty]));
  const context=example(q);const play=(text,cls='',lang='en-US')=>button(text,()=>{if(busy)return;if(lang==='en-US'){assisted=true;hint.textContent='本题使用了听音辅助，不计入独立掌握度。'}speak([text],lang)},cls);
  const choose=async(value,b)=>{
   if(busy||!active())return;busy=true;prepareChime();quiet();const ok=norm(value)!==''&&[q.en,...(writing&&Array.isArray(q.alternatives)?q.alternatives:[])].some(v=>norm(v)===norm(value));
   answers.push({value,assisted});persist();card.querySelectorAll('button,input').forEach(n=>n.disabled=true);feedback(b,ok);hint.textContent=ok?'答对了！':'正确答案：'+q.en+' · '+q.zh;
   await new Promise(r=>setTimeout(r,ok?650:1400));if(active())draw();
  };
  if(writing){
   card.append(play(q.zh,'word','zh-CN'),E('small',partOfSpeech(q)),E('p',q.test_translation||q.translation||context?.zh||'根据中文意思写出这本词书中的英文。'));
   const input=E('input');input.type='text';input.autocomplete='off';input.spellcheck=false;input.autocapitalize='none';input.maxLength=1000;input.placeholder='输入英文单词或短语';input.setAttribute('aria-label','英文答案');input.style.cssText='width:100%;box-sizing:border-box;padding:14px;font-size:18px';
   const submit=button('确认答案',()=>{if(!input.value.trim()){hint.textContent='请输入答案，或选择想不起来。';return}return choose(input.value.trim(),submit)},'primary');input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit.click()}};
   card.append(input,submit,E('small','按词书目标词判分；不区分大小写，统一空格和英文撇号。其他同义表达可请老师核对。'));
  }else{
   card.append(play(q.en,'word'),E('small',partOfSpeech(q)));const sentence=q.test_example||q.example||context?.en;
   if(sentence)card.append(play(sentence));card.append(E('p','选择正确的中文意思'));
   for(const o of q.options){const b=button(o.zh,()=>choose(o.en,b),'option');card.append(b)}
  }
  const skip=button('想不起来',()=>choose('',skip),'back');card.append(skip,hint);
 }
 draw();
}
