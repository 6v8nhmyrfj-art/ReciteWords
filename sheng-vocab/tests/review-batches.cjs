const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
const p=await b.newPage({viewport:{width:320,height:568}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('http://localhost/**',r=>{const f=new URL(r.request().url()).pathname.slice(1);return r.fulfill(f?{contentType:f.endsWith('css')?'text/css':'text/javascript',body:fs.readFileSync(process.cwd()+'/'+f,'utf8')}:{contentType:'text/html',body:'<link rel="stylesheet" href="/student.css"><body class="study-focus"><main></main></body>'})});
const words=JSON.parse(fs.readFileSync('class-ui.mjs','utf8').match(/const basic=\{title:'基础词汇',words:(\[.*\])\};/)[1]);
for(const size of [1,3,7,10,12]){
await p.goto('http://localhost/');await p.evaluate(async({words,size})=>{
localStorage.clear();window.finished=false;window.submissions=[];window.learned=[];window.reviewed=[];window.words=words;
const {groupStudy}=await import('/group-study.mjs'),E=(t,s,c)=>{const n=document.createElement(t);if(s!=null)n.textContent=s;if(c)n.className=c;return n},button=(s,f,c)=>{const b=E('button',s,c);b.onclick=f;return b};
await groupStudy({t:{title:'小组测试',words:words.slice(0,size)},basic:{words},mode:'self',me:{id:'test'},app:document.querySelector('main'),E,button,mix:a=>[...a],active:()=>!finished,back:()=>{finished=true;document.querySelector('main').textContent='完成'},prepareChime(){},feedback(){},learn:(book,cfg)=>{learned.push(...cfg.list.map(i=>cfg.refs[i].index));cfg.update([]);cfg.done()},api:async(path,method,body)=>{
if(path.includes('rw_practice')){reviewed.push(body.p_index);return body.p_choice===words[body.p_index].en}
submissions.push({...body,reviewed:[...reviewed]});const answers=body.p_answers.map(a=>({...a,correct:a.choice===words[a.index].en})),correct=answers.filter(a=>a.correct).length;return {answers,correct,passed:correct===answers.length};
}})}, {words,size});
let failedOnce=false;for(let step=0;step<150;step++){
 if(await p.evaluate(()=>finished))break;
 const state=await p.evaluate(()=>JSON.parse(localStorage.getItem('rw-groups-v3:test:basic:self')));
 const review=await p.getByRole('heading',{name:'马上复习',exact:true}).count();
 if(review){const idx=Number(state.review[0].split(':').at(-1));await p.getByRole('button',{name:words[idx].en,exact:true}).click()}
 else if(await p.getByRole('heading',{name:/句子测试/}).count()){
  if(!state||state.answers.length>=state.batch.length){await p.waitForTimeout(30);continue}
  const idx=Number(state.batch[state.answers.length].split(':').at(-1));
  if(size===10&&!failedOnce&&state.answers.length===4){const wrong=p.locator('.option').filter({hasNotText:words[idx].en}).first();await wrong.click();failedOnce=true}
  else await p.getByRole('button',{name:words[idx].en,exact:true}).click();
  if(size===12&&state.answers.length===0){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2));await p.screenshot({path:process.cwd()+'/focus-batch-mobile.png'})}
 }
 else if(await p.getByRole('button',{name:'重学错词'}).count())await p.getByRole('button',{name:'重学错词'}).click();
 else {const next=p.getByRole('button',{name:/测试下一批|学习下一组|完成本轮学习/});if(await next.count())await next.click()}
 await p.waitForTimeout(210);
}
assert(await p.evaluate(()=>finished),'must finish '+size);const out=await p.evaluate(()=>({submissions,learned}));
for(const s of out.submissions){assert(s.p_answers.length>=1&&s.p_answers.length<=5);assert.equal(s.p_group.length,s.p_answers.length);assert.equal(new Set(s.p_answers.map(a=>a.index)).size,s.p_answers.length);for(const a of s.p_answers)assert(s.reviewed.includes(a.index),'unreviewed target');}
assert(out.learned.every(i=>i<size),'unlearned padding');const lengths=out.submissions.map(s=>s.p_answers.length);
if(size===1)assert.deepEqual(lengths,[1]);if(size===3)assert.deepEqual(lengths,[3]);if(size===7)assert.deepEqual(lengths,[5,5]);if(size===10)assert.deepEqual(lengths,[5,5,5]);if(size===12)assert.deepEqual(lengths,[5,5,5]);console.log('PASS reviewed-only batches size '+size+' '+lengths);
}
assert.deepEqual(errors,[]);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)})
