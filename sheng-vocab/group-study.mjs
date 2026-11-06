import {example,norm,partOfSpeech} from './word-context.mjs?v=books-periods-20261106';
import {audible,quiet} from './reading-audio.mjs';

export async function groupStudy({t,basic,mode,api,me,app,E,button,mix,active,back,learn,prepareChime,feedback}){
 const key='rw-groups-v1:'+me.id+':'+(t.id||'basic')+':'+mode;
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
 if(!state||state.signature!==signature||!Number.isInteger(state.group)||state.group<0||state.group>=groups.length)state={signature,group:0,learned:[],answers:[],order:[],attempt:null};
 const save=()=>{localStorage.setItem(key,JSON.stringify(state))};
 const group=()=>groups[state.group];
 function cloze(r){
  const x=example(r.w);if(!x)return null;
  const escaped=r.w.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp('(^|[^a-zA-Z])('+escaped+')(?=$|[^a-zA-Z])','gi');
  const sentence=x.en.replace(pattern,'$1______');
  return sentence!==x.en?{sentence,translation:x.zh}:null
 }
 function startLearning(indices){
  if(!active())return;
  const rows=group(),missing=rows.filter(r=>!cloze(r));
  if(rows.length!==10||missing.length){app.replaceChildren(E('h1','本组需要补充例句'),E('p',missing.map(r=>r.w.en).join('、')),E('p','请老师为这些词补充包含原词的英文例句和中文译文，再开始十词组测。'),button('返回',back));return}
  const remaining=indices||rows.map((_,i)=>i).filter(i=>!state.learned.includes(i));
  if(!remaining.length){quiz();return}
  learn({title:t.title+' · 第 '+(state.group+1)+' 组',words:rows.map(r=>r.w)},{
   list:remaining,refs:rows,
   update:list=>{state.learned=rows.map((_,i)=>i).filter(i=>!list.includes(i));save()},
   done:quiz
  })
 }
 function quiz(){
  if(!active())return;quiet();
  if(!state.attempt){state.attempt=crypto.randomUUID();state.order=mix(group().map((_,i)=>i));state.answers=[];save()}
  if(state.answers.length===10){submit();return}
  const index=state.order[state.answers.length],r=group()[index],q=cloze(r),card=E('section',null,'card');
  app.replaceChildren(button('‹ 返回',back,'back'),E('h1','第 '+(state.group+1)+' 组 · 句子测试'),card);
  card.append(E('small','第 '+(state.answers.length+1)+' / 10 题 · 9 题答对即可通过'),audible(q.sentence),E('p',q.translation),E('small','选择填入空格的英文'));
  let locked=false;
  const wrong=mix(group().filter(x=>norm(x.w.en)!==norm(r.w.en))).sort((a,b)=>Number(partOfSpeech(b.w)===partOfSpeech(r.w))-Number(partOfSpeech(a.w)===partOfSpeech(r.w))).slice(0,3);
  for(const option of mix([r,...wrong])){
   const b=button(option.w.en,async()=>{
    if(locked||!active())return;locked=true;prepareChime();
    state.answers.push({task:r.task,index:r.index,choice:option.w.en,groupIndex:index});
    save();
    // One answer per test question. Feedback is shown after submission.
    quiz()
   },'option');card.append(b)
  }
 }
 async function submit(){
  if(!active())return;
  const card=E('section');app.replaceChildren(E('h1','正在保存本组测试'),card);
  const send=async()=>{
   const result=await api('/rest/v1/rpc/rw_submit_group','POST',{p_id:state.attempt,p_title:t.title,p_answers:state.answers.map(({task,index,choice})=>({task,index,choice}))});
   if(!active())return;
   card.replaceChildren(E('h2',result.passed?'通过本组测试':'本组尚未达标'),E('p',result.correct+' / 10 题 · 正确率 '+result.correct*10+'%'));
   const missed=result.answers.map((a,i)=>a.correct?null:state.answers[i].groupIndex).filter(i=>i!==null);
   for(const i of missed)card.append(audible(group()[i].w.en),E('p',group()[i].w.zh));
   if(result.passed){
    const next=button(state.group+1<groups.length?'进入下一组':'完成本轮学习',()=>{
     state.group++;state.learned=[];state.answers=[];state.order=[];state.attempt=null;
     if(state.group===groups.length){localStorage.removeItem(key);return back()}
     save();startLearning()
    },'primary');card.append(next);feedback(next,true)
   }else{
    card.append(E('p','先重学错词，再做本组全部 10 题。'),button('重学错词',()=>{
     state.learned=group().map((_,i)=>i).filter(i=>!missed.includes(i));state.answers=[];state.order=[];state.attempt=null;save();startLearning(missed)
    },'primary'))
   }
  };
  try{await send()}catch(e){if(active())card.replaceChildren(E('p','保存未成功，请重试。本组答案已保存在这台设备。'),button('重新保存',send))}
 }
 if(!groups.length)return back();
 app.replaceChildren(E('h1',t.title),E('p','每组 10 词，学完立即做 10 道句子填空题。答对 9 题才能继续；斩词也参加组测。'),E('p','最后一组不足 10 词时，用本书已学词或基础词补足。'),button(state.attempt?'继续本组测试':'开始 / 继续第 '+(state.group+1)+' 组',()=>state.attempt?quiz():startLearning(),'primary'));
}
