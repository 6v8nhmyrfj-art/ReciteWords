// Foundation book, ordered approximately from everyday use to more advanced use.
const lines = `pull|Please pull the door open.|请把门拉开。
wheel|My bike has a broken wheel.|我的自行车有一个轮子坏了。
remember|I remember your name.|我记得你的名字。
practice|We practice English after school.|我们放学后练习英语。
balloon|The red balloon flew away.|那个红气球飞走了。
decide|We must decide where to go.|我们必须决定去哪里。
prepare|Let's prepare lunch together.|我们一起准备午餐吧。
describe|Can you describe your room?|你能描述一下你的房间吗？
path|Follow the path to the lake.|沿着小路走到湖边。
journey|Our journey began on Monday.|我们的旅程从星期一开始。
improve|Reading helps me improve my English.|阅读帮助我提高英语水平。
discover|We hope to discover a new star.|我们希望发现一颗新星。
although|Although it was cold, we went outside.|虽然天气很冷，我们还是出门了。
depend|Young birds depend on their parents.|幼鸟依靠父母生活。
develop|We can develop good habits at school.|我们可以在学校培养好习惯。
central|Meet me at the central station.|在中心车站和我见面吧。
knowledge|Books give us knowledge.|书籍给我们知识。
international|She studies at an international school.|她在一所国际学校学习。
attach|Please attach a photo to your email.|请在邮件中附上一张照片。
technique|Our coach taught us a new swimming technique.|教练教了我们一种新的游泳技巧。`.split('\n');
export const contexts=new Map(lines.map((line,rank)=>{const [word,en,zh]=line.split('|');return [word,{en,zh,rank}]}));
export const norm=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' ');
export function example(w){return w.example?{en:w.example,zh:w.translation||w.zh}:contexts.get(norm(w.en))||(!singleWord(w)?{en:w.en,zh:w.zh}:undefined)}
export function choices(w,pool,shuffle){
 const meanings=s=>s.split(/[;；、]/).map(norm);
 const seen=new Set(meanings(w.zh)),keys=new Set([norm(w.en)]),result=[w];
 for(const x of shuffle(pool)){
  if(!x.zh||!x.en||keys.has(norm(x.en))||meanings(x.zh).some(m=>seen.has(m)))continue;
  result.push(x);keys.add(norm(x.en));meanings(x.zh).forEach(m=>seen.add(m));if(result.length===4)break;
 }
 return shuffle(result)
}

// Parts of speech match the sense used in the foundation example.
const foundationPOS={
 pull:'v.',wheel:'n.',remember:'v.',practice:'v.',balloon:'n.',decide:'v.',
 prepare:'v.',describe:'v.',path:'n.',journey:'n.',improve:'v.',discover:'v.',
 although:'conj.',depend:'v.',develop:'v.',central:'adj.',knowledge:'n.',
 international:'adj.',attach:'v.',technique:'n.'
};
export function singleWord(w){return /^[a-z]+(?:['’-][a-z]+)*$/i.test(String(w.en||'').trim())}
export function partOfSpeech(w){
 if(!singleWord(w))return '';
 return String(w.pos||'').trim()||String(w.zh||'').match(/^(?:n|v|vi|vt|adj|adv|prep|conj|pron|num|art|det|aux|int)\./i)?.[0]||foundationPOS[norm(w.en)]||'词性待补充'
}
