// Recording input only. The caller owns authenticated transcription and grading.
export function oralAnswer({container,onSubmit,onSkip,onStatus=()=>{},transcribe,Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition,maxSeconds=20,minMilliseconds=450}){
 const E=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text||'';if(cls)n.className=cls;return n};
 const box=E('section','','oral-answer'),answer=E('textarea','','oral-transcript'),status=E('p','','oral-status'),hold=E('button','按住说中文','oral-hold'),skip=E('button','想不起来','oral-skip'),tray=E('div','','oral-actions'),cancel=E('button','取消'),send=E('button','提交');
 answer.setAttribute('aria-label','中文答案');answer.placeholder='点击输入中文，也可使用输入法语音输入';answer.rows=2;answer.maxLength=500;status.setAttribute('role','status');tray.hidden=true;tray.append(cancel,send);for(const b of [hold,skip,cancel,send])b.type='button';hold.style.touchAction='none';hold.setAttribute('aria-label','按住说中文，上滑选择取消或提交');
 let phase='idle',disposed=false,gen=0,capture=null,timer=null,startY=0,choice='',wantSubmit=false,text='',controller=null,typed=false,composing=false;
 const report=s=>{if(!disposed){status.textContent=s;onStatus(s)}};
 const sync=()=>{answer.disabled=phase!=='idle';send.disabled=phase!=='idle'||composing||!text.trim();hold.disabled=['recognizing','sending'].includes(phase);skip.disabled=phase!=='idle';hold.setAttribute('aria-pressed',String(phase==='recording'));hold.textContent=phase==='recording'?'松开显示答案 · 上滑取消或提交':phase==='recognizing'?'正在识别…':phase==='sending'?'正在提交…':'按住说中文';cancel.classList.toggle('selected',choice==='cancel');send.classList.toggle('selected',choice==='send')};
 const cleanup=()=>{clearTimeout(timer);timer=null};
 const ready=t=>{if(disposed)return;phase='idle';text=t.trim().slice(0,500);answer.value=text;sync();if(!text){tray.hidden=true;report('没有听清，请按住重录。');return}tray.hidden=false;report('');if(wantSubmit)submit()};
 const fail=e=>{if(disposed)return;cleanup();phase='idle';tray.hidden=!text;sync();report(e?.name==='NotAllowedError'?'请允许使用麦克风后重试。':e?.message||'识别失败，请按住重录。')};
 function abort(){gen++;cleanup();controller?.abort();capture?.abort();capture=null;phase='idle';wantSubmit=false;text='';answer.value='';tray.hidden=true;choice='';sync();report('已取消');}
 answer.oncompositionstart=()=>{composing=true;sync()};answer.oncompositionend=()=>{composing=false;answer.oninput()};answer.oninput=()=>{text=answer.value.trim();typed=true;tray.hidden=!text;sync();report('')};
 async function submit(){if(disposed||phase!=='idle'||composing||!text.trim())return;phase='sending';tray.hidden=true;sync();report('正在判定意思…');try{await onSubmit({text,input:typed?'typed':'speech'});if(!disposed){text='';answer.value='';report('已提交')}}catch(e){if(!disposed){tray.hidden=false;report(e.message||'提交失败，答案已保留。')}}finally{if(!disposed){phase='idle';sync()}}}
 async function start(y){if(disposed||phase!=='idle')return;answer.blur();const stamp=++gen;startY=y;typed=false;capture=null;choice='';wantSubmit=false;text='';answer.value='';tray.hidden=true;phase='recording';sync();report('');const current=()=>!disposed&&stamp===gen;
  try{
   if(transcribe){
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(!current()||phase!=='recording'){stream.getTracks().forEach(t=>t.stop());return}
    const stopTracks=()=>stream.getTracks().forEach(t=>t.stop());let recorder;try{recorder=new MediaRecorder(stream)}catch(e){stopTracks();throw e}const chunks=[],startedAt=performance.now();
    capture={stop(){recorder.stop()},abort(){recorder.onstop=null;if(recorder.state!=='inactive')recorder.stop();stopTracks()}};
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    recorder.onerror=()=>{stopTracks();if(current())fail(Error('录音失败，请重试。'))};
    recorder.onstop=async()=>{stopTracks();if(!current())return;if(performance.now()-startedAt<minMilliseconds){fail(Error('录音太短，请按住说完中文意思。'));return}controller=new AbortController();try{const result=await transcribe(new Blob(chunks,{type:recorder.mimeType}),{signal:controller.signal});if(current())ready(result.text??result)}catch(e){if(current())fail(e)}};recorder.start();
   }else{
    if(!Recognition)throw Error('语音服务尚未连接，此浏览器无法预览录音。');
    const r=new Recognition();let final='';r.lang='zh-CN';r.continuous=true;r.interimResults=true;
    capture={stop:()=>r.stop(),abort:()=>r.abort()};r.onresult=e=>{if(!current())return;let interim='';for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)final+=e.results[i][0].transcript;else interim+=e.results[i][0].transcript}text=final+interim;answer.value=text};
    r.onend=()=>{if(current()){cleanup();ready(text)}};r.onerror=e=>{if(current()){gen++;fail(Error(e.error==='not-allowed'?'请允许使用麦克风后重试。':'没有识别成功，请按住重录。'))}};r.start();
   }
   if(current())timer=setTimeout(()=>finish(false),maxSeconds*1000);
  }catch(e){if(current())fail(e)}
 }
 function finish(submitAfter){if(phase!=='recording')return;cleanup();wantSubmit=submitAfter;phase='recognizing';tray.hidden=true;sync();if(!capture){abort();return}try{capture.stop()}catch(e){fail(e)}}
 hold.onpointerdown=e=>{if(e.button!==0||phase!=='idle')return;e.preventDefault();try{hold.setPointerCapture?.(e.pointerId)}catch{}start(e.clientY)};
 hold.onpointermove=e=>{if(phase!=='recording')return;const up=startY-e.clientY>45;tray.hidden=!up;choice=up?(e.clientX<hold.getBoundingClientRect().left+hold.offsetWidth/2?'cancel':'send'):'';sync()};
 hold.onpointerup=()=>{if(phase==='recording'){if(choice==='cancel')abort();else finish(choice==='send')}};hold.onpointercancel=()=>{if(phase==='recording')abort()};hold.onlostpointercapture=()=>{if(phase==='recording')abort()};hold.oncontextmenu=e=>e.preventDefault();
 hold.onkeydown=e=>{if([' ','Enter'].includes(e.key)&&!e.repeat){e.preventDefault();start(0)}};hold.onkeyup=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();finish(false)}};
 cancel.onclick=()=>{abort();text='';answer.value=''};send.onclick=submit;
 skip.onclick=async()=>{if(phase!=='idle')return;phase='sending';sync();try{await onSkip?.()}catch(e){report(e.message||'保存失败，请重试。')}finally{if(!disposed){phase='idle';sync()}}};
 const hide=()=>{if(document.hidden&&['recording','recognizing'].includes(phase))abort()};document.addEventListener('visibilitychange',hide);
 box.append(answer,status,tray,hold,skip);container.append(box);sync();return{element:box,dispose(){abort();disposed=true;document.removeEventListener('visibilitychange',hide);box.remove()}};
}
