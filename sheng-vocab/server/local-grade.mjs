// Conservative, deterministic server-side fast path. null means use semantic AI.
export const LOCAL_GRADE_VERSION='local-meaning-v1';
const synonyms={
 improve:[['提高','改善','改进','变得更好']],
 beautiful:[['美丽的','漂亮的','好看的','美丽','漂亮','好看']],
 difficult:[['困难的','难的','困难','难']],
 important:[['重要的','重要']],
 happy:[['高兴的','快乐的','开心的','高兴','快乐','开心']],
 begin:[['开始']],finish:[['完成','结束']],
 quickly:[['迅速地','快速地','很快地','迅速','快速']],
};
function normalize(s){return s.normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g,'').trim().replace(/^(?:(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|int)\.[\s]*)+/i,'').replace(/\s+/g,'').replace(/[。.!！?？]+$/g,'')}
function parts(s){return s.split(/[;；、,，\/\n]+/).map(normalize).filter(Boolean)}
export function localGrade({word,meaning,answer}){
 if(typeof word!=='string'||typeof meaning!=='string'||typeof answer!=='string'||answer.length>500)return null;
 const refs=parts(meaning),replies=parts(answer.replace(/^(?:这个词的意思是|意思是|意思为)\s*[:：]?\s*/,''));
 if(!refs.length||!replies.length||replies.length>8||!replies.every(x=>/[\u3400-\u9fff]/u.test(x)))return null;
 const allowed=new Set(refs);
 for(const group of synonyms[word.trim().toLowerCase()]||[]){if(group.some(s=>allowed.has(s)))group.forEach(s=>allowed.add(s))}
 // Every supplied meaning must match. Never substring-match, remove negation,
 // drop unknown extra claims, or infer a wrong answer from non-matching text.
 if(!replies.every(s=>allowed.has(s)))return null;
 return {verdict:'correct',reason:'与词书释义或已确认同义表达一致',model:LOCAL_GRADE_VERSION};
}
