// Daily speaking checks cover the union of today's learning/review entries.
// Stable source+index identity: identical spellings from different books aren't merged.
export function dailyOralRounds(entries){
 const unique=new Map();for(const e of entries){if(!e.source||!Number.isInteger(e.index)||e.index<1||!e.word?.en?.trim())throw Error('每日词条信息不完整');const key=e.source+':'+e.index;if(!unique.has(key))unique.set(key,{...e,key})}
 const groups={word:[],phrase:[],sentence:[]};for(const e of unique.values()){
  const kind=e.word.kind;const type=kind==='sentence'?'sentence':kind==='phrase'||/\s/.test(e.word.en.trim())?'phrase':'word';groups[type].push(e);
 }
 const rounds=[[],[],[]];for(const group of Object.values(groups)){
  // Floor each of the first two 30% groups; the last round takes the remainder.
  // For tiny groups avoid empty rounds by balancing one entry at a time.
  const a=Math.floor(group.length*.3),b=Math.floor(group.length*.3);
  group.forEach((e,i)=>rounds[i<a?0:i<a+b?1:2].push(e));
 }
 return rounds.filter(r=>r.length).map((items,i)=>({round:i+1,items,total:items.length,requiredCorrect:Math.ceil(items.length*.9)}));
}
