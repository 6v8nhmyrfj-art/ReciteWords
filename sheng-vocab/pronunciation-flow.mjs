// Pure flow shared by web, mini-program and native clients. Progress must be
// persisted and pass decisions authorized by the server before advancing.
export const PRONUNCIATION_FLOW_VERSION=1;
export function createPronunciationFlow(indices,passed=[]){
 if(!Array.isArray(indices)||!indices.length||indices.some(i=>!Number.isInteger(i)||i<1)||new Set(indices).size!==indices.length)throw Error('发音范围无效');
 const known=new Set(passed),done=indices.filter(i=>known.has(i)),queue=indices.filter(i=>!known.has(i));
 return {version:1,indices:[...indices],passed:done,queue,missed:[],cursor:0,round:1,phase:queue.length?'test':'complete'};
}
export function currentPronunciationIndex(s){return s.phase==='complete'?null:s.queue[s.cursor]}
export function pronunciationProgress(s){return {total:s.indices.length,passed:s.passed.length,remaining:s.indices.length-s.passed.length,round:s.round,phase:s.phase,index:currentPronunciationIndex(s)}}
export function advancePronunciation(s,event){
 if(s.version!==1||s.phase==='complete')throw Error('发音流程已结束或版本无效');
 if(event.index!==currentPronunciationIndex(s))throw Error('题目已变化，请刷新进度');
 const n=structuredClone(s);
 if(n.phase==='practice'){
  // Training itself never grants a pass. An independent retest is mandatory.
  if(event.kind!=='practised')throw Error('请先完成听读训练');
  n.cursor++;
  if(n.cursor===n.queue.length){n.cursor=0;n.phase='retest';n.round++;}
  return n;
 }
 if(event.kind!=='judged'||!['correct','incorrect','uncertain'].includes(event.verdict))throw Error('发音判定无效');
 if(event.verdict==='uncertain')return n; // service/noise errors don't become wrong answers
 if(event.verdict==='correct')n.passed.push(event.index);else n.missed.push(event.index);
 n.cursor++;
 if(n.cursor===n.queue.length){
  n.queue=n.missed;n.missed=[];n.cursor=0;n.phase=n.queue.length?'practice':'complete';
 }
 return n;
}
