const engine=window.speechSynthesis;
engine?.getVoices(); // Start loading the device's voice list before the first card.
function preferredVoice(lang){
 const language=lang.split('-')[0];
 const candidates=(engine?.getVoices()||[]).filter(v=>v.lang.toLowerCase().split(/[-_]/)[0]===language);
 function score(v){
  const name=v.name.toLowerCase();
  if(/natural|neural|premium|enhanced|自然|增强|優質/.test(name))return 100;
  if(/google|samantha|daniel|aria|jenny/.test(name))return 50;
  return v.default?20:0
 }
 const ordinary=candidates.filter(v=>!/^(albert|bad news|bahh|bells|boing|bubbles|cellos|fred|good news|hysterical|jester|junior|organ|ralph|superstar|trinoids|whisper|wobble|zarvox)($|\s*\()/i.test(v.name));
 return ordinary.sort((a,b)=>score(b)-score(a)||Number(b.lang===lang)-Number(a.lang===lang))[0]
}
export function quiet(){window.speechSynthesis?.cancel()}
export function speak(parts,lang='en-US'){
 const status=document.querySelector('body > [role="status"]');
 const unavailable=()=>{if(status)status.textContent='当前设备无法朗读，请检查系统语音设置。'};
 if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){unavailable();return}
 quiet();
 for(const text of parts.filter(Boolean)){
  const line=new SpeechSynthesisUtterance(text);
  const voice=preferredVoice(lang);if(voice)line.voice=voice;
  line.lang=voice?.lang||lang;line.rate=0.96;
  line.onerror=e=>{if(e.error==='not-allowed'&&status)status.textContent='点一下单词即可朗读。';else if(!['canceled','interrupted'].includes(e.error))unavailable()};
  window.speechSynthesis.speak(line)
 }
}
export function audible(text,cls='',lang='en-US'){
 const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;
 b.setAttribute('aria-label','朗读：'+text);b.title='点击朗读';
 b.style.cssText='display:block;margin-inline:auto;border:0;background:transparent;color:inherit;max-width:100%;overflow-wrap:anywhere;padding:5px 8px';
 b.onclick=()=>speak([text],lang);return b
}
