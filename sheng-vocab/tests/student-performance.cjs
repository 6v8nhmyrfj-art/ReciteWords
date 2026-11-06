const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
const p=await browser.newPage({viewport:{width:390,height:780}}),errors=[],modules=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('http://localhost/**',r=>{const f=new URL(r.request().url()).pathname.slice(1);modules.push(f);return r.fulfill(f?{contentType:f.endsWith('css')?'text/css':'text/javascript',body:fs.readFileSync(process.cwd()+'/'+f,'utf8')}:{contentType:'text/html',body:'<main></main>'})});await p.goto('http://localhost/');
const words=JSON.parse(fs.readFileSync('class-ui.mjs','utf8').match(/const basic=\{title:'基础词汇',words:(\[.*\])\};/)[1]);
await p.evaluate(async words=>{
const {createDataClient}=await import('/data-client.mjs'),{student}=await import('/student.mjs');window.requests=[];window.basic={title:'基础词汇',words};
const transport=async(path,method,body)=>{requests.push({path,method,body});
 if(path.includes('rw_practice'))return new Promise((resolve,reject)=>window.answerRequest={resolve,reject});
 if(path.includes('rw_student_summary'))return {today:0,days:0,accuracy:null,cohort:'测试班'};
 if(path.includes('rw_passed_periods'))return Object.fromEntries(['day','week','month','year'].map(k=>[k,{total:0,points:[{day:'2026-11-06T00:00:00',total:0}],start:'2026-11-06',end:'2026-11-06'}]));
 if(path.includes('rw_library_catalog'))return [{id:'lib',title:'Unit 1',book:'测试词书',word_count:20,updated_at:'v1',category:'reading'}];
 if(path.includes('rw_bookshelf'))return [{library:'lib'}];
 if(path.includes('rw_libraries?'))return [{id:'lib',title:'Unit 1',words,updated_at:'v1',category:'reading'}];
 if(path.includes('rw_mastery_books'))return [{kind:'basic',title:'基础词汇',category:'reading',summary:{total:20,tested:0,correct:0,delayed:0,coverage:0,estimate:null}}];
 return [];
};window.client=createDataClient(transport,'test-user');await student(client,{id:'test-user'},{display_name:'测试学生'},basic,()=>{});
},words);
assert(!modules.some(x=>/mastery|student-tools|group-study|student-shelf/.test(x)));assert.equal(await p.evaluate(()=>requests.length),5);
const tab=label=>p.locator('nav').getByRole('button',{name:label,exact:false}).click();
await tab('自主学习');await p.getByRole('button',{name:'＋ 添加单词书'}).waitFor();assert.equal(await p.evaluate(()=>requests.length),7);assert(!modules.some(x=>/mastery|student-tools|group-study/.test(x)));
await tab('测单词');await p.locator('.book-compact').waitFor();assert.equal(await p.evaluate(()=>requests.length),8);
await tab('我的');await p.getByRole('heading',{name:'最近学习'}).waitFor();assert.equal(await p.evaluate(()=>requests.length),12);
for(const label of ['班级任务','自主学习','测单词','我的']){await tab(label);await p.waitForTimeout(80)}assert.equal(await p.evaluate(()=>requests.length),12);
await tab('自主学习');await p.getByRole('button',{name:/测试词书 · Unit 1/}).click();
await p.locator('.option').first().waitFor();assert(!(await p.locator('nav').isVisible()));assert(await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2));for(const size of [{width:320,height:568},{width:390,height:780}]){await p.setViewportSize(size);assert(await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}const opt=p.locator('.option').filter({hasText:words[0].zh});await opt.click();assert.equal(await opt.getAttribute('data-feedback'),'correct');assert(await p.getByText('正在保存…',{exact:true}).isVisible());assert(await p.getByText(words[0].en,{exact:true}).isVisible());
await p.evaluate(()=>answerRequest.reject(Error('模拟断网')));await p.getByText('尚未保存，请点刚才的选项重试。',{exact:true}).waitFor();await opt.click();await p.evaluate(()=>answerRequest.resolve(true));await p.getByText(words[1].en,{exact:true}).waitFor();
const ids=await p.evaluate(()=>requests.filter(x=>x.path.includes('rw_practice')).map(x=>x.body.p_id));assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);assert.equal(await p.evaluate(()=>client.pendingCount()),0);assert.deepEqual(errors,[]);
console.log('PASS initial 5 calls; first full tab cycle 12; repeated cycle +0; lazy modules/book content; immediate feedback; failed-save same-ID retry; next word after confirmation');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)})
