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
 const rate=s=>s.tested?Math.round(100*s.correct/s.tested)+'%':'—';
 let scroll=0;
 function detail(b){
  if(!active())return;scroll=window.scrollY;
  const s=b.summary,card=E('section',null,'card');
  app.replaceChildren(button('‹ 返回词书',()=>{list(b.source_key||b.id);window.scrollTo(0,scroll)},'back'),E('h1',b.title));
  card.style.cssText='padding:18px;text-align:left';
  const metrics=E('div');metrics.style.cssText='display:grid;gap:0';
  for(const [label,value,caption] of [['覆盖率',s.coverage+'%',s.tested+' / '+s.total+' 词'],['正确率',rate(s),null],['复测通过',s.delayed+' 词',null]]){
   const row=E('div'),text=E('span'),number=E('strong',value);
   row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 0;border-bottom:1px solid #edf2f8';
   text.append(E('span',label));if(caption){const sub=E('small',caption);sub.style.cssText='display:block;color:#607a96;margin-top:3px';text.append(sub)}
   number.style.cssText='font-size:24px;color:#2164ad;white-space:nowrap';row.append(text,number);metrics.append(row);
  }
  const info=E('details'),help=E('summary','?');help.setAttribute('aria-label','查看统计说明');help.title='统计说明';help.style.cssText='cursor:pointer;width:32px;min-height:32px;text-align:center;border:1px solid #d7e5f4;border-radius:50%;line-height:30px;list-style:none;color:#526e8a';
  info.style.cssText='margin:12px 0;padding:0;background:transparent';info.append(help,E('p','覆盖率：已独立测过的词占整本词书的比例。'),E('p','正确率：每个已测词最近一次独立作答中，答对的比例。还未测试显示 —。'),E('p','复测通过：间隔至少 24 小时再次答对、期间未答错的词数。听音辅助题不计入这三项统计。'));
  const begin=button('开始测试',()=>start(b),'primary');begin.style.cssText='width:100%;margin:8px 0 0;min-height:46px';
  card.append(metrics,info,begin);app.append(card);window.scrollTo(0,0);
 }
 function list(focusKey){
  if(!active())return;
  app.replaceChildren(E('h1','测单词'));
  for(const b of books){
   const s=b.summary,card=button('',()=>detail(b),'book-compact'),name=E('strong',b.title),metrics=E('span');
   card.style.cssText='display:block;width:100%;margin:8px 0;padding:14px 16px;text-align:left;background:#fff;border:1px solid #d7e5f4;border-radius:14px;min-height:88px';
   name.style.cssText='display:block;font-size:16px;line-height:1.4;overflow-wrap:anywhere';
   metrics.style.cssText='display:flex;flex-wrap:wrap;gap:8px 24px;margin-top:8px;font-size:13px;color:#526e8a';
   metrics.append(E('span','覆盖率 '+s.coverage+'%'),E('span','正确率 '+rate(s)));card.append(name,metrics);app.append(card);
   if(focusKey&&(b.source_key||b.id)===focusKey)card.focus({preventScroll:true});
  }
  if(!books.length)app.append(E('p','暂无词书，请先在自主学习中添加老师的单词书。'));
 }
 list();
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

