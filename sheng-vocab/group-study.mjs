import {example,norm,partOfSpeech} from './word-context.mjs?v=books-periods-20261106';
import {audible,quiet,speak} from './reading-audio.mjs';

export async function groupStudy({t,basic,mode,api,me,app,E,button,mix,active,back,learn,prepareChime,feedback}){
 const key='rw-groups-v2:'+me.id+':'+(t.id||'basic')+':'+mode;
 const source=t.words.map((w,index)=>({w,index,task:t.id||null}));
 const unique=[...new Map(source.map(r=>[norm(r.w.en),r])).values()];
 const groups=[];
 for(let i=0;i<unique.length;i+=10){
  const group=unique.slice(i,i+10),seen=new Set(group.map(r=>norm(r.w.en)));
  for(const r of [...unique,...basic.words.map((w,index)=>({w,index,task:null}))]){
   if(group.length===10)break;
   if(!seen.has(norm(r.w.en))){group.push(r);seen.add(norm(r.w.en))}
  }
  groups.push(group)
 }
 const signature=JSON.stringify(source);
 let state;
 try{state=JSON.parse(localStorage.getItem(key))}catch{}
 if(!state||state.signature!==signature||!Number.isInteger(state.group)||state.group<0||state.group>=groups.length)state={signature,group:0,learned:[],answers:[],order:[],attempt:null,reviewed:[],review:null,remedial:null};
 const save=()=>{localStorage.setItem(key,JSON.stringify(state))};
 const group=()=>groups[state.group];
 function cloze(r){
  const x=example(r.w);if(!x)return null;
  const escaped=r.w.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp('(^|[^a-zA-Z])('+escaped+')(?=$|[^a-zA-Z])','gi');
  const sentence=x.en.replace(pattern,'$1______');
  return sentence!==x.en?{sentence,translation:x.zh}:null
 }
 const segments=[[0,1,2],[3,4,5],[6,7,8,9]];
 function startLearning(){
  if(!active())return;
  const rows=group(),missing=rows.filter(r=>!cloze(r));
  if(rows.length!==10||missing.length){app.replaceChildren(E('h1','本组需要补充例句'),E('p',missing.map(r=>r.w.en).join('、')),button('返回',back));return}
  if(state.remedial){learnSegment(state.remedial,'错词重学',()=>review(state.remedial,()=>{state.remedial=null;save();quiz()}));return}
  const stage=segments.findIndex((_,i)=>!state.reviewed.includes(i));
  if(stage<0){quiz();return}
  learnSegment(segments[stage],'第 '+(stage+1)+' 段 · '+segments[stage].length+' 词',()=>review(segments[stage],()=>{state.reviewed.push(stage);save();startLearning()}))
 }
 function learnSegment(indices,label,done){
  const remaining=indices.filter(i=>!state.learned.includes(i));
  if(!remaining.length){done();return}
  learn({title:t.title+' · 第 '+(state.group+1)+' 组 · '+label,words:group().map(r=>r.w)},{
   list:remaining,refs:group(),
   update:list=>{state.learned=[...new Set([...state.learned,...remaining.filter(i=>!list.includes(i))])];save()},
   done
  })
 }
 function review(indices,done){
  if(!active())return;quiet();
  state.review??=[...indices];save();
  if(!state.review.length){state.review=null;save();done();return}
  const index=state.review[0],r=group()[index],card=E('section',null,'card');
  app.replaceChildren(button('‹ 返回',back,'back'),E('h1','马上复习 · 看中文选英文'),card);
  card.append(E('small','第 '+(indices.length-state.review.length+1)+' / '+indices.length+' 词'),audible(r.w.zh,'word','zh-CN'));
  const hint=E('p');hint.setAttribute('role','status');card.append(hint);
  let locked=false,pending=null,id=null;
  const wrong=mix(group().filter(x=>norm(x.w.en)!==norm(r.w.en))).slice(0,3);
  for(const option of mix([r,...wrong])){
   const b=button(option.w.en,async()=>{
    if(locked||!active())return;locked=true;prepareChime();pending??=option;id??=crypto.randomUUID();
    card.querySelectorAll('.option').forEach(x=>x.disabled=true);
    try{
     const ok=await api('/rest/v1/rpc/rw_practice','POST',{p_id:id,p_mode:'self',p_task:r.task,p_index:r.index,p_word:norm(r.w.en),p_choice:pending.w.en});
     if(!active())return;
     feedback(b,ok);pending=null;id=null;
     if(!ok){hint.textContent='再想一想：'+r.w.en+' · '+r.w.zh;speak([r.w.en,example(r.w)?.en]);card.querySelectorAll('.option').forEach(x=>x.disabled=false);return}
     state.review.shift();save();
     await new Promise(resolve=>setTimeout(resolve,520));
     if(active())review(indices,done)
    }catch(e){hint.textContent='保存失败，请重新点选刚才的答案。';card.querySelectorAll('.option').forEach(x=>x.disabled=x!==b);throw e}
    finally{locked=false}
   },'option');card.append(b)
  }
 }
 function quiz(){
  if(!active())return;quiet();
  if(!state.attempt){state.attempt=crypto.randomUUID();state.order=mix(group().map((_,i)=>i)).slice(0,5);state.answers=[];save()}
  if(state.answers.length===5){submit();return}
  const index=state.order[state.answers.length],r=group()[index],q=cloze(r),card=E('section',null,'card');
  app.replaceChildren(button('‹ 返回',back,'back'),E('h1','第 '+(state.group+1)+' 组 · 句子测试'),card);
  card.append(E('small','第 '+(state.answers.length+1)+' / 5 题 · 5 题全对通过'),audible(q.sentence),E('p',q.translation),E('small','选择填入空格的英文'));
  let locked=false;
  const wrong=mix(group().filter(x=>norm(x.w.en)!==norm(r.w.en))).sort((a,b)=>Number(partOfSpeech(b.w)===partOfSpeech(r.w))-Number(partOfSpeech(a.w)===partOfSpeech(r.w))).slice(0,3);
  for(const option of mix([r,...wrong])){
   const b=button(option.w.en,async()=>{
    if(locked||!active())return;locked=true;prepareChime();
    state.answers.push({task:r.task,index:r.index,choice:option.w.en,groupIndex:index});
    save();
    card.querySelectorAll('button').forEach(x=>x.disabled=true);
    feedback(b,norm(option.w.en)===norm(r.w.en));
    await new Promise(resolve=>setTimeout(resolve,520));
    if(active())quiz()
   },'option');card.append(b)
  }
 }
 async function submit(){
  if(!active())return;
  const card=E('section');app.replaceChildren(E('h1','正在保存本组测试'),card);
  const send=async()=>{
   const result=await api('/rest/v1/rpc/rw_submit_five','POST',{p_id:state.attempt,p_title:t.title,p_group:group().map(({task,index})=>({task,index})),p_answers:state.answers.map(({task,index,choice})=>({task,index,choice}))});
   if(!active())return;
   card.replaceChildren(E('h2',result.passed?'通过本组测试':'本组尚未达标'),E('p',result.correct+' / 5 题 · 正确率 '+result.correct*20+'%'));
   const missed=result.answers.map((a,i)=>a.correct?null:state.answers[i].groupIndex).filter(i=>i!==null);
   for(const i of missed)card.append(audible(group()[i].w.en),E('p',group()[i].w.zh));
   if(result.passed){
    const next=button(state.group+1<groups.length?'进入下一组':'完成本轮学习',()=>{
     state.group++;state.reviewed=[];state.review=null;state.remedial=null;state.learned=[];state.answers=[];state.order=[];state.attempt=null;
     if(state.group===groups.length){localStorage.removeItem(key);return back()}
     save();startLearning()
    },'primary');card.append(next);feedback(next,true)
   }else{
    card.append(E('p','先重学并复习错词，再做 5 题测试。'),button('重学错词',()=>{
     state.learned=group().map((_,i)=>i).filter(i=>!missed.includes(i));state.answers=[];state.order=[];state.attempt=null;state.review=null;state.remedial=missed;save();startLearning()
    },'primary'))
   }
  };
  try{await send()}catch(e){if(active())card.replaceChildren(E('p','保存未成功，请重试。本组答案已保存在这台设备。'),button('重新保存',send))}
 }
 if(!groups.length)return back();
 app.replaceChildren(E('h1',t.title),E('p','每组 10 词：学 3 词并复习，再学 3 词并复习，最后学 4 词并复习。复习看中文选英文，最后做 5 道句子填空题，全部答对通过。'),E('p','最后一组不足 10 词时，用本书已学词或基础词补足。'),button(state.attempt?'继续本组测试':'开始 / 继续第 '+(state.group+1)+' 组',()=>state.attempt?quiz():startLearning(),'primary'));
}
