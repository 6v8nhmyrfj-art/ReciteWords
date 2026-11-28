import {pronunciationPanel} from './pronunciation-panel.mjs?v=weekly-speech-20261128';
export async function weeklyPronunciation(api,item,onComplete){
 let session=await api('/rest/v1/rpc/rw_pronunciation_open','POST',{p_item:item});
 if(!session.required)return onComplete();
 if(!document.getElementById('pronunciation-css')){const l=document.createElement('link');l.id='pronunciation-css';l.rel='stylesheet';l.href='./pronunciation.css';document.head.append(l)}
 const dialog=document.createElement('dialog');dialog.style.cssText='width:min(96vw,680px);max-height:96dvh;padding:0;border:0;border-radius:20px';document.body.append(dialog);let panel;
 const close=()=>{panel?.dispose();window.speechSynthesis?.cancel();dialog.remove()};dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 const submit=async({audio})=>{if(!audio?.size)throw Error('请先录音');const bytes=new Uint8Array(await audio.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 session=await api('/functions/v1/rw-pronunciation','POST',{session:session.id,version:session.version,audio:btoa(binary)});
 return {...session.state,feedbackText:session.feedback?`刚才识别：${session.feedback.text} · ${session.feedback.practice?'跟读已完成，接下来独立重测':session.feedback.correct?'朗读通过':'待重新学习和测试'}`:''};};
 const play=text=>new Promise((resolve,reject)=>{if(!window.speechSynthesis||!window.SpeechSynthesisUtterance)return reject(Error('当前设备无法播放示范'));speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.85;u.onend=resolve;u.onerror=()=>reject(Error('示范播放失败，请重试'));speechSynthesis.speak(u)});
 panel=pronunciationPanel({container:dialog,state:session.state,words:session.words,onJudge:submit,onPractice:submit,onExit:close,play,onComplete:async()=>{close();try{await onComplete()}catch(e){alert(e.message)}}});dialog.showModal();
}
