import {example,norm,partOfSpeech} from './word-context.mjs?v=books-periods-20261106';
import {audible,quiet,speak} from './reading-audio.mjs';
export async function groupStudy({t,basic,mode,api,me,app,E,button,mix,active,back,learn,prepareChime,feedback}){
 const suffix=me.id+':'+(t.id||'basic')+':'+mode,key='rw-groups-v3:'+suffix,legacy='rw-groups-v2:'+suffix;
 const source=t.words.map((w,index)=>({w,index,task:t.id||null})),unique=[...new Map(source.map(r=>[norm(r.w.en),r])).values()];
 const id=r=>(r.task||'basic')+':'+r.index,lookup=new Map(unique.map(r=>[id(r),r])),groups=[];
 for(let i=0;i<unique.length;i+=10)groups.push(unique.slice(i,i+10));
 if(!groups.length)return back();
 const signature=JSON.stringify(source);let state,old;
 try{state=JSON.parse(localStorage.getItem(key));old=JSON.parse(localStorage.getItem(legacy))}catch{}
 if(!state||state.signature!==signature||!Number.isInteger(state.group)||!groups[state.group]){
  state={signature,group:0,learned:[],reviewed:[],review:null,sessionReviewed:[],passed:[],batch:null,answers:[],attempt:null,remedial:null};
  // Preserve completed learning stages from v2; rebuild its incomplete five-of-ten test.
  if(old?.signature===signature&&Number.isInteger(old.group)&&groups[old.group]){
   state.group=old.group;const prior=groups.slice(0,old.group).flat().map(id),current=groups[old.group];
   state.learned=[...prior,...(old.learned||[]).map(i=>current[i]).filter(Boolean).map(id)];
   state.passed=[...prior];state.reviewed=old.reviewed||[];
   state.sessionReviewed=[...prior,...current.filter((_,i)=>state.reviewed.includes(i<3?0:i<6?1:2)).map(id)];
  }
 }
 const save=()=>localStorage.setItem(key,JSON.stringify(state));
 const group=()=>groups[state.group],segments=()=>[group().slice(0,3),group().slice(3,6),group().slice(6,10)].filter(x=>x.length);
 const rowsFor=keys=>keys.map(k=>lookup.get(k)).filter(Boolean);
 const remaining=()=>group().filter(r=>!state.passed.includes(id(r)));
 function cloze(r){const x=example(r.w);if(!x)return null;const escaped=r.w.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),sentence=x.en.replace(new RegExp('(^|[^a-zA-Z])('+escaped+')(?=$|[^a-zA-Z])','gi'),'$1______');return sentence!==x.en?{sentence,translation:x.zh}:null}
 function learnRows(rows,label,done){
  const missing=rows.map((r,i)=>state.learned.includes(id(r))?null:i).filter(i=>i!==null);if(!missing.length)return done();
  learn({title:label,words:rows.map(r=>r.w)},{list:missing,refs:rows,update:list=>{for(const i of missing)if(!list.includes(i)&&!state.learned.includes(id(rows[i])))state.learned.push(id(rows[i]));save()},done});
 }
 function startLearning(){
  if(!active())return;const missing=group().filter(r=>!cloze(r));
  if(missing.length){app.replaceChildren(E('h1','需要补充例句'),E('p',missing.map(r=>r.w.en).join('、')),button('返回',back));return}
  if(state.remedial){const rows=rowsFor(state.remedial);return learnRows(rows,'错词重学',()=>review(rows,()=>{state.remedial=null;save();quiz()}))}
  const index=segments().findIndex((_,i)=>!state.reviewed.includes(i));if(index<0)return quiz();
  const rows=segments()[index];learnRows(rows,'第 '+(state.group+1)+' 组 · 学习',()=>review(rows,()=>{state.reviewed.push(index);save();startLearning()}));
 }
 function options(r){
  const pool=[...rowsFor(state.sessionReviewed),...group(),...basic.words.map(w=>({w}))],seen=new Set([norm(r.w.en)]);
  const wrong=mix(pool).filter(x=>{const k=norm(x.w.en);if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>Number(partOfSpeech(b.w)===partOfSpeech(r.w))-Number(partOfSpeech(a.w)===partOfSpeech(r.w))).slice(0,3);
  return mix([r,...wrong]);
 }
 function review(rows,done){
  if(!active())return;quiet();state.review??=rows.map(id);save();
  if(!state.review.length){state.review=null;save();return done()}
  const r=lookup.get(state.review[0]),card=E('section',null,'card'),hint=E('p');hint.setAttribute('role','status');
  app.replaceChildren(button('‹ 返回',back,'back'),E('h1','马上复习'),card);
  card.append(E('small','第 '+(rows.length-state.review.length+1)+' / '+rows.length+' 词'),audible(r.w.zh,'word','zh-CN'));
  let locked=false,pending=null,requestId=null;
  for(const opt of options(r)){
   const b=button(opt.w.en,async()=>{
    if(locked||!active())return;locked=true;prepareChime();pending??=opt;requestId??=crypto.randomUUID();
    card.querySelectorAll('.option').forEach(x=>x.disabled=true);
    const began=performance.now(),predicted=norm(pending.w.en)===norm(r.w.en);feedback(b,predicted);hint.textContent='正在保存…';
    try{const ok=await api('/rest/v1/rpc/rw_practice','POST',{p_id:requestId,p_mode:'self',p_task:r.task,p_index:r.index,p_word:norm(r.w.en),p_choice:pending.w.en});
     if(!active())return;if(ok!==predicted)feedback(b,ok);pending=null;requestId=null;hint.textContent='已保存';
     if(!ok){hint.textContent=r.w.en+' · '+r.w.zh+'，再选一次。';speak([r.w.en,example(r.w)?.en]);card.querySelectorAll('.option').forEach(x=>x.disabled=false);return}
     if(!state.sessionReviewed.includes(id(r)))state.sessionReviewed.push(id(r));state.review.shift();save();
     await new Promise(resolve=>setTimeout(resolve,Math.max(0,180-(performance.now()-began))));if(active())review(rows,done);
    }catch(e){hint.textContent='尚未保存，请点刚才的选项重试。';card.querySelectorAll('.option').forEach(x=>x.disabled=x!==b);throw e}finally{locked=false}
   },'option');card.append(b)
  }card.append(hint);
 }
 function quiz(){
  if(!active())return;quiet();
  if(!state.batch){
   const selected=mix(remaining()).slice(0,5),seen=new Set(selected.map(id));
   // Only successful reviews from this saved learning run may fill a short batch.
   for(const r of mix(rowsFor(state.sessionReviewed))){if(selected.length>=5)break;if(!seen.has(id(r))&&cloze(r)){selected.push(r);seen.add(id(r))}}
   state.batch=selected.map(id);state.answers=[];
  }
  if(!state.batch.length)return back();
  if(state.batch.some(k=>!state.sessionReviewed.includes(k)))throw Error('请先完成本组复习。');
  state.attempt??=crypto.randomUUID();save();
  if(state.answers.length===state.batch.length)return submit();
  const r=lookup.get(state.batch[state.answers.length]),q=cloze(r),card=E('section',null,'card');
  app.replaceChildren(button('‹ 返回',back,'back'),E('h1','第 '+(state.group+1)+' 组 · 句子测试'),card);
  card.append(E('small','第 '+(state.answers.length+1)+' / '+state.batch.length+' 题 · 全对通过'),audible(q.sentence),E('p',q.translation));
  let locked=false;
  for(const opt of options(r)){
   const b=button(opt.w.en,async()=>{if(locked||!active())return;locked=true;prepareChime();
    state.answers.push({task:r.task,index:r.index,choice:opt.w.en});save();card.querySelectorAll('button').forEach(x=>x.disabled=true);feedback(b,norm(opt.w.en)===norm(r.w.en));
    card.append(E('small','本机已记录 · 本批结束后保存'));
    await new Promise(resolve=>setTimeout(resolve,180));if(active())quiz();
   },'option');card.append(b)
  }
 }
 async function submit(){
  if(!active())return;const card=E('section',null,'card');app.replaceChildren(E('h1','正在保存本批测试'),card);
  const send=async()=>{
   const count=state.batch.length,result=await api('/rest/v1/rpc/rw_submit_review_batch','POST',{p_id:state.attempt,p_title:t.title,p_group:rowsFor(state.batch).map(({task,index})=>({task,index})),p_answers:state.answers});
   if(!active())return;card.replaceChildren(E('h2',result.passed?'本批全部答对':'本批尚未达标'),E('p',result.correct+' / '+count+' 题'));
   if(result.passed){
    state.passed=[...new Set([...state.passed,...state.batch])];save();
    card.append(button(remaining().length?'测试下一批':state.group+1<groups.length?'学习下一组':'完成本轮学习',()=>{
     state.batch=null;state.attempt=null;state.answers=[];
     if(remaining().length){save();return quiz()}
     state.group++;state.reviewed=[];state.review=null;state.remedial=null;
     if(state.group===groups.length){localStorage.removeItem(key);localStorage.removeItem(legacy);return back()}
     save();startLearning();
    },'primary'));
   }else{
    const missed=result.answers.map((a,i)=>a.correct?null:state.batch[i]).filter(Boolean);
    for(const r of rowsFor(missed))card.append(audible(r.w.en),E('p',r.w.zh));
    card.append(button('重学错词',()=>{state.learned=state.learned.filter(k=>!missed.includes(k));state.remedial=missed;state.review=null;state.answers=[];state.attempt=null;save();startLearning()},'primary'));
   }
  };
  try{await send()}catch(e){if(active())card.replaceChildren(E('p','尚未保存，本批答案已留在本机。'),button('重新保存',send,'primary'),button('返回',back,'back'))}
 }
 if(state.attempt&&!state.remedial)quiz();else startLearning();
}
