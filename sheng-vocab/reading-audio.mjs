export function quiet(){window.speechSynthesis?.cancel()}
export function speak(parts,lang='en-US'){
 const status=document.querySelector('body > [role="status"]');
 const unavailable=()=>{if(status)status.textContent='当前设备无法朗读，请检查系统语音设置。'};
 if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){unavailable();return}
 quiet();
 for(const text of parts.filter(Boolean)){
  const line=new SpeechSynthesisUtterance(text);
  line.lang=lang;line.rate=0.9;
  line.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))unavailable()};
  window.speechSynthesis.speak(line)
 }
}
export function audible(text,cls='',lang='en-US'){
 const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;
 b.setAttribute('aria-label','朗读：'+text);b.title='点击朗读';
 b.style.cssText='display:block;margin-inline:auto;border:0;background:transparent;color:inherit;max-width:100%;overflow-wrap:anywhere;padding:5px 8px';
 b.onclick=()=>speak([text],lang);return b
}
