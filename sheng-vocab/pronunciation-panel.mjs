import {pronunciationRecorder} from './pronunciation-recorder.mjs';
import {pronunciationProgress} from './pronunciation-flow.mjs';
// onJudge/onPractice must return an authoritative, persisted flow state.
// The component never sets pass flags or calls a speech-to-text result a score.
export function pronunciationPanel({container,state,words,onJudge,onPractice,onComplete,onExit,play}){
 const E=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n};
 const root=E('section',null,'pr-root');root.setAttribute('aria-label','发音过关');container.append(root);
 let flow=state,recorder,disposed=false,epoch=0,audio,objectURL;
 const button=(label,fn,cls='pr-soft')=>{const b=E('button',label,cls);b.type='button';b.onclick=fn;return b};
 function cleanup(){epoch++;recorder?.dispose();recorder=null;audio?.pause();audio=null;if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null}
 function render(){cleanup();if(disposed)return;root.replaceChildren();const stamp=epoch,p=pronunciationProgress(flow);
  const top=E('header',null,'pr-top');top.append(button('‹ 返回',()=>onExit?.()),E('span','① 发音　→　② 词义'));root.append(top);
  const card=E('div',null,'pr-card'),progress=E('progress');progress.max=p.total;progress.value=p.passed;progress.setAttribute('aria-label','发音已通过');
  if(flow.feedbackText)card.append(E('p',flow.feedbackText,'pr-status'));
  card.append(E('small',`已通过 ${p.passed}/${p.total} · 待通过 ${p.remaining}`),progress);root.append(card);
  if(p.phase==='complete'){card.append(E('h1','发音全部通过'),E('p','进度已保存，可以继续测试词义。'),button('进入词义测试',()=>onComplete(flow),'pr-primary'));return}
  const practice=p.phase==='practice',word=words[p.index-1];if(!word)throw Error('词书快照与测试范围不一致');
  card.append(E('small',practice?'错词训练 · 先听再跟读':p.phase==='retest'?'错词重测 · 独立朗读':'首轮测试 · 独立朗读'),E('h1',word.en,'pr-word'));
  if(word.phonetic)card.append(E('p',word.phonetic,'pr-phonetic'));
  const message=E('p',practice?'先听一遍标准发音':'请读出这个单词','pr-status');message.setAttribute('role','status');card.append(message);
  const controls=E('div',null,'pr-controls');card.append(controls);let listened=false,clip=null,busy=false;
  const current=()=>!disposed&&epoch===stamp;
  async function save(kind){if(busy)return;busy=true;controls.querySelectorAll('button').forEach(b=>b.disabled=true);message.textContent='正在确认并保存…';try{const next=await (kind==='practice'?onPractice({index:p.index,audio:clip,state:flow}):onJudge({index:p.index,audio:clip,state:flow}));if(!current())return;flow=next;render()}catch(e){if(current()){message.textContent=e.message||'未保存成功，录音已保留，请重试';controls.querySelectorAll('button').forEach(b=>b.disabled=false)}}finally{busy=false}}
  function record(){recorder=pronunciationRecorder({container:controls,onStart:()=>{clip=null;controls.querySelector('.pr-clip')?.remove();audio?.pause()},onRecording:async blob=>{
   if(!current())return;clip=blob;if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(blob);audio=new Audio(objectURL);
   let actions=controls.querySelector('.pr-clip');if(!actions){actions=E('div',null,'pr-clip');controls.append(actions)}actions.replaceChildren(button('听自己的录音',()=>audio.play().catch(()=>{message.textContent='录音播放失败，请重新录音'})),button(practice?'完成跟读':'提交发音',()=>save(practice?'practice':'judge'),'pr-primary'));
   message.textContent=practice?'跟读后还需要独立重测':'确认录音后提交';
  }})}
  if(practice){const listen=button('▶ 听标准发音',async()=>{if(busy)return;listen.disabled=true;try{await play(word.en);if(!current())return;if(!listened){listened=true;record()}message.textContent='现在请跟读一遍'}catch(e){if(current())message.textContent=e.message||'示范播放失败，请重试'}finally{if(current())listen.disabled=false}},'pr-primary');controls.append(listen)}else record();
 }
 render();return {dispose(){disposed=true;cleanup();root.remove()},getState:()=>structuredClone(flow)};
}
