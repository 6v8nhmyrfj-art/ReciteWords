const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
const p=await b.newPage({viewport:{width:390,height:780}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('http://localhost/**',r=>{const f=new URL(r.request().url()).pathname.slice(1);return r.fulfill(f?{contentType:f.endsWith('css')?'text/css':'text/javascript',body:fs.readFileSync(process.cwd()+'/'+f,'utf8')}:{contentType:'text/html',body:'<!doctype html><main></main>'})});
await p.goto('http://localhost/');
const words=JSON.parse(fs.readFileSync(process.cwd()+'/class-ui.mjs','utf8').match(/const basic=\{title:'基础词汇',words:(.*?)\};/s)[1]);
await p.evaluate(async words=>{window.words=words;window.submits=[];window.speechSynthesis.speak=()=>{};
const {student}=await import('/student.mjs');
const api=async(path,method,body)=>{
if(path.includes('rw_practice'))return body.p_choice===words[body.p_index].en;
if(path.includes('rw_submit_five')){submits.push(body);const answers=body.p_answers.map(a=>({...a,word:words[a.index].en,correct:a.choice===words[a.index].en}));const correct=answers.filter(a=>a.correct).length;return {answers,correct,passed:correct>=5}}
if(path.includes('rw_student_summary'))return {today:0,days:0};return []};
await student(api,{id:'test'},{display_name:'test'},{title:'基础词汇',words},()=>{})
},words);
await p.getByText('自主学习',{exact:true}).last().click();await p.getByText('基础词汇',{exact:true}).click();await p.getByRole('button',{name:'开始 / 继续第 1 组'}).click();

for(const indices of [[0,1,2],[3,4,5],[6,7,8,9]]){
 for(const i of indices){await p.getByRole('button',{name:'朗读：'+words[i].en,exact:true}).waitFor();await p.getByRole('button',{name:words[i].zh,exact:true}).click()}
 await p.getByText('马上复习 · 看中文选英文',{exact:true}).waitFor();
 for(const i of indices){await p.getByRole('button',{name:'朗读：'+words[i].zh,exact:true}).waitFor();await p.getByRole('button',{name:words[i].en,exact:true}).click()}
}
async function quiz(right){
 for(let i=0;i<5;i++){
  await p.getByText('第 '+(i+1)+' / 5 题 · 5 题全对通过',{exact:true}).waitFor();
  const state=await p.evaluate(()=>JSON.parse(localStorage.getItem('rw-groups-v2:test:basic:self')));
  const answer=words[state.order[i]].en;assert.equal(await p.locator('.option').count(),4);
  if(i<right)await p.getByRole('button',{name:answer,exact:true}).click();
  else {const opts=p.locator('.option');for(let j=0;j<4;j++){if(await opts.nth(j).innerText()!==answer){await opts.nth(j).click();break}}}
 }
}
await quiz(4);await p.getByText('本组尚未达标',{exact:true}).waitFor();
assert.equal(await p.getByRole('button',{name:'进入下一组'}).count(),0);
await p.getByRole('button',{name:'重学错词'}).click();
const word=await p.locator('.word').innerText();
await p.getByRole('button',{name:words.find(w=>w.en===word).zh,exact:true}).click();
await p.getByText('马上复习 · 看中文选英文',{exact:true}).waitFor();
await p.getByRole('button',{name:word,exact:true}).click();
await quiz(5);await p.getByText('通过本组测试',{exact:true}).waitFor();
await p.getByRole('button',{name:'进入下一组'}).click();
await p.getByRole('button',{name:'朗读：'+words[10].en,exact:true}).waitFor();
assert.deepEqual(errors,[]);console.log('PASS 3+review, 3+review, 4+review, five questions; 4/5 blocked; remedial learning+review; 5/5 advances')
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)})
