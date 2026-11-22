// Captures audio only: no transcription is treated as a pronunciation score.
export function pronunciationRecorder({container,onRecording,onStart=()=>{},maxSeconds=12}){
 const button=document.createElement('button'),status=document.createElement('p');button.type='button';button.className='pr-record';button.textContent='开始录音';status.className='pr-status';status.setAttribute('role','status');container.append(button,status);
 let phase='idle',disposed=false,generation=0,recorder,stream,timer;
 const release=()=>{clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());stream=null};
 const set=(p,message='')=>{phase=p;button.disabled=['opening','sending'].includes(p);button.textContent=p==='recording'?'结束录音':p==='opening'?'正在打开麦克风…':p==='sending'?'正在处理…':'开始录音';button.setAttribute('aria-pressed',String(p==='recording'));status.textContent=message};
 function cancel(){generation++;if(recorder){recorder.onstop=null;if(recorder.state!=='inactive')recorder.stop();recorder=null}release();if(!disposed)set('idle','录音已取消')}
 async function start(){
  const stamp=++generation;onStart();set('opening');
  try{
   if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder)throw Error('当前浏览器不支持录音，请使用最新版浏览器');
   const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
   if(disposed||generation!==stamp){acquired.getTracks().forEach(t=>t.stop());return}stream=acquired;
   recorder=new MediaRecorder(stream);const parts=[];const began=performance.now();
   recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
   recorder.onerror=()=>{cancel();if(!disposed)set('idle','录音失败，请重试')};
   recorder.onstop=async()=>{
    const mime=recorder.mimeType;release();if(disposed||generation!==stamp)return;
    const blob=new Blob(parts,{type:mime});if(performance.now()-began<400||!blob.size){set('idle','录音太短，请读完单词再结束');return}
    if(blob.size>2*1024*1024){set('idle','录音过大，请重新录音');return}
    set('sending');try{await onRecording(blob);if(!disposed&&generation===stamp)set('idle')}catch(e){if(!disposed&&generation===stamp)set('idle',e.message||'未能处理录音，请重试')}
   };
   recorder.start();set('recording','请朗读当前英文');timer=setTimeout(()=>stop(),maxSeconds*1000);
  }catch(e){release();if(!disposed&&generation===stamp)set('idle',e.name==='NotAllowedError'?'请允许使用麦克风后重试':e.message)}
 }
 function stop(){if(phase!=='recording')return;clearTimeout(timer);set('sending');recorder.stop()}
 button.onclick=()=>{if(phase==='idle')start();else if(phase==='recording')stop()};
 const hide=()=>{if(document.hidden&&['opening','recording'].includes(phase))cancel()};document.addEventListener('visibilitychange',hide);
 return {dispose(){disposed=true;cancel();document.removeEventListener('visibilitychange',hide);button.remove();status.remove()}};
}
