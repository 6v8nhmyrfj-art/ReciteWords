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
 await p.route('http://localhost/**',r=>{const f=new URL(r.request().url()).pathname.slice(1);return r.fulfill(f?{contentType:f.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(f,'utf8')}:{contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+fs.readFileSync('app.html','utf8').split('<style>')[1].split('</style>')[0]+'</style>'})});
 await p.goto('http://localhost/');
 await p.evaluate(async()=>{
  const {teacher}=await import('/teacher.mjs');window.calls=0;window.fail=false;
  window.students=[{id:'s1',name:'测试甲',cohort:'七年级',items:[{date:'2026-11-23',title:'完形词汇',kind:'vocabulary',start:1,end:10,total:10,done:10}],oral:[{date:'2026-11-23',total:3,done:0}]},{id:'s2',name:'测试乙',cohort:'八年级第一班',items:[{date:'2026-11-23',title:'阅读词汇',kind:'review',total:10,done:10}],oral:[{date:'2026-11-23',total:3,done:3}]},{id:'s3',name:'未布置学生',cohort:'测试班',items:[],oral:[]}];
  students.push(...Array.from({length:40},(_,i)=>({id:'extra'+i,name:'同学'+(i+1),cohort:['七年级','八年级第一班','八年级第二班','九年级强化班'][i%4],items:[{date:'2026-11-23',title:'词汇',kind:'vocabulary',total:10,done:i%11}],oral:[]})));
  await teacher(async path=>{if(path.includes('rw_teacher_weekly')){calls++;if(fail)throw Error('模拟断网');return {week:'2026-11-23',end:'2026-11-29',today:'2026-11-25',students}}if(path.includes('rw_dashboard'))return {members:students.map(s=>({user_id:s.id,display_name:s.name,cohort:s.cohort})),answers:[],learned:[],checked:[]};return []},()=>{},document.createElement('form'));
 });
 await p.getByRole('button',{name:'测试甲 周任务详情'}).waitFor();
 assert.equal(await p.locator('.to-student').count(),43);
 await p.getByRole('button',{name:'测试甲 周任务详情'}).click();assert(await p.locator('.tw-dialog').getByText('每日口头抽查',{exact:false}).isVisible());await p.getByRole('button',{name:'关闭',exact:true}).click();
 await p.getByRole('button',{name:'截图视图',exact:true}).click();assert.equal(await p.locator('.to-shot .to-student').count(),43);await p.locator('.to-shot').getByRole('button',{name:'测试甲 周任务详情'}).click();await p.locator('.tw-dialog').getByRole('button',{name:'关闭',exact:true}).click();await p.getByRole('button',{name:'关闭截图'}).click();
 for(const width of [320,390,1280]){await p.setViewportSize({width,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+width)}
 await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'截图视图',exact:true}).click();await p.waitForTimeout(100);assert(await p.locator('.to-shot .to-student').evaluateAll(rows=>rows.every(r=>{const b=r.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight&&b.left>=0&&b.right<=innerWidth})));await p.screenshot({path:'preview/teacher-overview-live.png'});await p.getByRole('button',{name:'关闭截图'}).click();
 await p.evaluate(()=>fail=true);await p.getByRole('button',{name:'刷新进度',exact:true}).click();await p.getByRole('button',{name:'重试',exact:true}).waitFor();await p.evaluate(()=>fail=false);await p.getByRole('button',{name:'重试',exact:true}).click();await p.getByRole('button',{name:'测试甲 周任务详情'}).waitFor();assert.equal(await p.evaluate(()=>calls),3);assert.deepEqual(errors,[]);
 console.log('PASS weekly aggregation, all students, detail, screenshot, failure/retry, responsive 320/390/1280');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
