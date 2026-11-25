const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs');
(async()=>{
 const {studentWeek}=await import('../teacher-weekly.mjs');
 const sample={items:[{date:'2026-11-23',total:10,done:10}],oral:[{date:'2026-11-23',total:3,done:0}]};
 assert.equal(studentWeek(sample,'2026-11-25').percent,50);
 assert.equal(studentWeek(sample,'2026-11-25').overdue,1);
 assert.equal(studentWeek({items:[],oral:[]},'2026-11-25').percent,null);
 assert.equal(studentWeek({items:[{date:'2026-11-28',total:10,done:0}],oral:[]},'2026-11-25').overdue,0);
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://localhost/**',r=>{const f=new URL(r.request().url()).pathname.slice(1);return r.fulfill(f?{contentType:f.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(f,'utf8')}:{contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+fs.readFileSync('index.html','utf8').split('<style>')[1].split('</style>')[0]+'</style>'})});
 await p.goto('http://localhost/');
 await p.evaluate(async()=>{
  const {teacher}=await import('/teacher.mjs');window.calls=0;window.fail=false;
  window.students=[{id:'s1',name:'测试甲',cohort:'七年级',items:[{date:'2026-11-23',title:'完形词汇',kind:'vocabulary',start:1,end:10,total:10,done:10}],oral:[{date:'2026-11-23',total:3,done:0}]},{id:'s2',name:'测试乙',cohort:'八年级第一班',items:[{date:'2026-11-23',title:'阅读词汇',kind:'review',total:10,done:10}],oral:[{date:'2026-11-23',total:3,done:3}]},{id:'s3',name:'未布置学生',cohort:'测试班',items:[],oral:[]}];
  await teacher(async path=>{if(path.includes('rw_teacher_weekly')){calls++;if(fail)throw Error('模拟断网');return {week:'2026-11-23',end:'2026-11-29',today:'2026-11-25',students}}if(path.includes('rw_dashboard'))return {members:students.map(s=>({user_id:s.id,display_name:s.name,cohort:s.cohort})),answers:[],learned:[],checked:[]};return []},()=>{},document.createElement('form'));
 });
 await p.getByRole('button',{name:'测试甲 周任务详情'}).waitFor();
 assert.equal(await p.locator('.tw-student').count(),3);
 await p.getByRole('button',{name:'测试甲 周任务详情'}).click();assert(await p.getByText('每日口头抽查',{exact:false}).isVisible());await p.getByRole('button',{name:'关闭',exact:true}).click();
 await p.getByLabel('筛选周任务状态').selectOption('overdue');assert.equal(await p.locator('.tw-student').count(),1);
 await p.getByLabel('筛选周任务状态').selectOption('all');await p.getByLabel('按班级查看周进度').selectOption('测试班');assert(await p.locator('.tw-rate').getByText('未布置',{exact:true}).isVisible());
 await p.getByLabel('按班级查看周进度').selectOption('');await p.getByLabel('搜索学生姓名').fill('测试乙');assert.equal(await p.locator('.tw-student').count(),1);await p.getByLabel('搜索学生姓名').fill('');
 for(const width of [320,390,1280]){await p.setViewportSize({width,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+width)}
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:'preview/teacher-weekly-mobile.png',fullPage:true});
 await p.evaluate(()=>fail=true);await p.getByRole('button',{name:'刷新进度',exact:true}).click();await p.getByRole('button',{name:'重试',exact:true}).waitFor();await p.evaluate(()=>fail=false);await p.getByRole('button',{name:'重试',exact:true}).click();await p.getByRole('button',{name:'测试甲 周任务详情'}).waitFor();assert.equal(await p.evaluate(()=>calls),3);assert.deepEqual(errors,[]);
 console.log('PASS weekly aggregation, filters, detail, failure/retry, responsive 320/390/1280');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
