import {pronunciationRecorder} from './pronunciation-recorder.mjs?v=oral-fix-20261127';
export async function dailyOral(api,day,onClose){
 for(const [id,href] of [['classroom-css','./classroom.css?v=oral-text-20261122'],['pronunciation-css','./pronunciation.css'],['daily-oral-css','./daily-oral.css?v=oral-fix-20261127']])if(!document.getElementById(id)){const l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href=href;document.head.append(l)}
 const root=document.createElement('div');root.className='cr-root do-root';root.innerHTML='<main class="cr-main cr-test"></main>';document.body.append(root);const main=root.firstChild;let state,recorder,closed=false,busy=false,recordingBusy=false;const old=document.body.style.overflow;document.body.style.overflow='hidden';
 const E=(tag,text)=>{const x=document.createElement(tag);x.textContent=text;return x};
 const close=()=>{closed=true;recorder?.dispose();root.remove();document.body.style.overflow=old;onClose?.()};
 const button=(label,fn)=>{const b=E('button',label);b.className='cr-primary';b.onclick=async()=>{if(busy||recordingBusy)return;busy=true;b.disabled=true;try{await fn()}catch(e){message.textContent=e.message}finally{busy=false;if(b.isConnected)b.disabled=false}};return b};let message=E('p','正在加载…');
 const call=(action,extra={})=>api('/rest/v1/rpc/rw_daily_oral_run','POST',{p_action:action,p_payload:{day,...extra}});
 const localAvailable=async()=>{const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R||!('processLocally' in R.prototype)||!R.available)return false;try{return await R.available({langs:['en-US'],processLocally:true})==='available'}catch{return false}};
 let useLocal=await localAvailable(),cloudConsented=false;
 function draw(){if(closed)return;recorder?.dispose();const back=button('‹ 返回班级任务',close);back.onclick=close;back.className='do-back';main.replaceChildren(back);message=E('p','');message.setAttribute('role','status');
 const card=E('section','');card.className='cr-test-card';main.append(card);
 if(state.round>=state.questions.length){card.append(E('h1','今日口头抽查已过关'),E('p',`${state.passed_rounds.length} 轮全部完成 · 云端已保存`));return}
 const questions=state.questions[state.round];
 if(state.offset_index===questions.length){const hits=state.answers.filter(a=>a.correct).length;card.append(E('h2','本轮还需巩固'),E('p',`答对 ${hits}/${questions.length} · 需答对 ${Math.ceil(questions.length*.9)} 题`));const list=E('details','');list.append(E('summary','查看错题'));state.answers.forEach((a,i)=>{if(!a.correct)list.append(E('p',questions[i].word.zh+' → '+questions[i].word.en))});card.append(list,button('重新测试本轮',async()=>{state=await call('retry');draw()}),message);return}
 const q=questions[state.offset_index],word=q.word;card.append(E('small',`第 ${state.round+1}/${state.questions.length} 轮 · ${state.offset_index+1}/${questions.length} 题 · 90%过关`),E('h1',word.zh),E('p','看中文，说出英文'));
 const heard=E('p','录音后，识别结果会显示在这里'),actions=E('div','');heard.className='do-heard';heard.setAttribute('aria-live','polite');actions.className='do-actions';card.append(heard,actions,message);
 let text='';const confirm=button('提交答案',async()=>{if(!text)return;message.textContent='正在保存答案…';const prev=state, index=prev.offset_index;state=await call('answer',{session:prev.id,round:prev.round,offset:index,attempt:prev.attempt,text,input:useLocal?'local':'cloud'});if(closed)return;draw()});confirm.hidden=true;
 const ready=t=>{text=t.trim();heard.textContent=text?'识别结果：'+text:'没有听清，请重新录音';confirm.hidden=!text};
 if(useLocal){
  let recognition;const b=button('开始说英文',async()=>{text='';confirm.hidden=true;heard.textContent='';recognition?.abort();const R=window.SpeechRecognition||window.webkitSpeechRecognition;recognition=new R();recognition.lang='en-US';recognition.processLocally=true;recognition.onresult=e=>{recordingBusy=false;ready(e.results[0][0].transcript)};recognition.onerror=()=>{recordingBusy=false;message.textContent='本地识别不可用，可改用云端录音';fallback.hidden=false};recognition.onend=()=>{recordingBusy=false};recognition.start();recordingBusy=true;message.textContent='正在听，请说英文…'});actions.append(b);
  recorder={dispose(){recognition?.abort()}};
  const fallback=button('改用云端录音',()=>{useLocal=false;draw()});fallback.hidden=true;actions.append(fallback);
 }else{
  const enableCloud=()=>{cloudConsented=true;consent.remove();message.textContent='录音将发送至 Cloudflare 识别英文';
   recorder=pronunciationRecorder({container:actions,onBusy:value=>{recordingBusy=value;for(const b of actions.querySelectorAll('.cr-primary'))b.disabled=value},onStart:()=>{text='';confirm.hidden=true;heard.textContent=''},onRecording:async blob=>{
    const snapshot={session:state.id,round:state.round,offset:state.offset_index,attempt:state.attempt};const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const r=await api('/functions/v1/rw-daily-oral','POST',{...snapshot,audio:btoa(binary)});if(!closed)ready(r.text);
   }});
  };const consent=button('启用录音',enableCloud);actions.append(E('small','录音将发送至语音服务识别。'),consent);if(cloudConsented)enableCloud();
 }
 actions.append(confirm,button('想不起来',async()=>{state=await call('answer',{session:state.id,round:state.round,offset:state.offset_index,attempt:state.attempt,text:'',input:'local'});draw()}));
 }
 main.append(message);try{state=await call('open');draw()}catch(e){main.replaceChildren(button('返回',close),E('p',e.message))}
}
