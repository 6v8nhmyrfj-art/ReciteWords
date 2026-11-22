// Shared press-to-speak input for website, classroom and future clients.
// The caller supplies authoritative grading; this widget never decides correctness.
export function oralAnswer({container,onSubmit,onSkip,onStatus=()=>{},Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition,maxSeconds=20}){
 const E=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n};
 const box=E('section');box.className='oral-answer';const prompt=E('p','看英文和例句，用中文说出意思'),hold=E('button','按住说中文'),status=E('p'),transcript=E('textarea'),submit=E('button','确认并提交'),retry=E('button','重新录音'),fallback=E('button','改用文字输入'),skip=E('button','想不起来');
 for(const b of [hold,submit,retry,fallback,skip])b.type='button';
 hold.className='oral-hold';hold.style.touchAction='none';hold.setAttribute('aria-label','按住说中文，松开结束');hold.setAttribute('aria-pressed','false');
 status.setAttribute('role','status');transcript.setAttribute('aria-label','识别出的中文答案');transcript.rows=2;transcript.maxLength=500;transcript.placeholder='录音后显示中文，可先核对识别结果';transcript.hidden=true;submit.disabled=true;retry.hidden=true;
 let recognition=null,recording=false,held=false,finishing=false,sending=false,disposed=false,timer=null,finalText='',generation=0,typed=false;
 const report=text=>{if(disposed)return;status.textContent=text;onStatus(text)};
 const sync=()=>{hold.disabled=!Recognition||sending||finishing;retry.disabled=sending||recording||finishing;fallback.disabled=sending||recording||finishing;submit.disabled=sending||recording||finishing||!transcript.value.trim();skip.disabled=sending||recording||finishing};
 function resetCapture(){clearTimeout(timer);timer=null;recording=false;held=false;finishing=false;hold.setAttribute('aria-pressed','false');hold.textContent='按住说中文';sync()}
 function finish(){if(!recording)return;held=false;finishing=true;hold.textContent='正在识别…';sync();try{recognition.stop()}catch{resetCapture();report('录音未完成，请重试。')}}
 function start(){if(disposed||sending||recording||finishing)return;if(!Recognition){report('此浏览器暂不支持语音识别，可用文字输入中文答案。');return}
  const stamp=++generation;finalText='';transcript.value='';typed=false;transcript.hidden=false;retry.hidden=false;recognition=new Recognition();recognition.lang='zh-CN';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=1;held=true;recording=true;hold.textContent='正在听，松开结束';hold.setAttribute('aria-pressed','true');sync();report('请说出中文意思；松开后核对文字再提交。');
  const current=()=>!disposed&&stamp===generation;
  recognition.onresult=e=>{if(!current())return;let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const text=e.results[i][0].transcript;if(e.results[i].isFinal)finalText+=text;else interim+=text}transcript.value=(finalText+interim).slice(0,500);sync()};
  recognition.onerror=e=>{if(!current())return;const errors={'not-allowed':'麦克风权限未开启，请在浏览器中允许使用麦克风。','service-not-allowed':'当前浏览器无法使用语音服务，请改用文字输入。','audio-capture':'没有检测到可用麦克风。','network':'语音服务连接失败，请重录或输入中文答案。','no-speech':'没有听清声音，请重录。','aborted':'录音已取消。'};report(errors[e.error]||'识别未完成，请重录或输入中文答案。');resetCapture()};
  recognition.onend=()=>{if(!current())return;resetCapture();if(transcript.value.trim())report('请核对识别出的中文，再点击确认并提交。');else if(!status.textContent.includes('权限')&&!status.textContent.includes('失败')&&!status.textContent.includes('无法'))report('没有识别到内容，请重录或输入中文。')};
  recognition.onstart=()=>{if(current()&&!held)try{recognition.stop()}catch{}};
  try{recognition.start();timer=setTimeout(()=>{if(current()&&recording){finish();report('已录满 '+maxSeconds+' 秒，正在识别。')}},maxSeconds*1000)}catch{resetCapture();report('录音启动失败，请重试或输入中文。')}
 }
 hold.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();hold.setPointerCapture?.(e.pointerId);start()};hold.onpointerup=finish;hold.onpointercancel=()=>{if(recording){held=false;generation++;try{recognition.abort()}catch{}resetCapture();report('录音已取消，请重录。')}};hold.onlostpointercapture=()=>{if(recording&&held)finish()};
 hold.onkeydown=e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();start()}};hold.onkeyup=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();finish()}};hold.oncontextmenu=e=>e.preventDefault();
 retry.onclick=()=>{transcript.value='';finalText='';sync();report('请再次按住按钮说中文。')};fallback.onclick=()=>{typed=true;transcript.hidden=false;transcript.focus();report('输入你理解的中文意思，不需要照抄词书措辞。')};transcript.oninput=()=>{typed=true;sync()};
 submit.onclick=async()=>{if(submit.disabled||disposed)return;sending=true;sync();report('正在判定意思…');try{await onSubmit({text:transcript.value.trim(),input:typed?'typed-or-edited':'speech'});if(!disposed)report('答案已提交。')}catch(e){report(e.message||'提交失败，答案已保留，请重试。')}finally{sending=false;if(!disposed)sync()}};
 skip.onclick=async()=>{if(skip.disabled||disposed)return;sending=true;sync();try{await onSkip?.()}catch(e){report(e.message||'保存失败，请重试。')}finally{sending=false;if(!disposed)sync()}};
 const hide=()=>{if(document.hidden&&recording){generation++;try{recognition.abort()}catch{}resetCapture();report('页面切换，录音已停止。')}};document.addEventListener('visibilitychange',hide);
 if(!Recognition){hold.disabled=true;report('此浏览器不支持内置语音识别，请用文字输入中文。')}
 box.append(prompt,hold,status,transcript,submit,retry,fallback,skip);container.append(box);
 return {element:box,dispose(){disposed=true;generation++;clearTimeout(timer);try{recognition?.abort()}catch{}document.removeEventListener('visibilitychange',hide);box.remove()}};
}
