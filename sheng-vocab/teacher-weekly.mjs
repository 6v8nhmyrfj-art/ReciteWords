const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n};
export function studentWeek(s,today){
 const tasks=[...s.items.map(i=>({...i,label:({vocabulary:'学习',review:'复习',transform:'词形转换'})[i.kind]+' · '+i.title,unit:'条'})),...s.oral.map(i=>({...i,label:'每日口头抽查',unit:'轮'}))];
 const fraction=i=>i.total>0?Math.min(1,Math.max(0,i.done/i.total)):0;
 const completed=tasks.filter(i=>i.total>0&&i.done>=i.total).length;
 const percent=tasks.length?Math.floor(tasks.reduce((sum,i)=>sum+fraction(i),0)*100/tasks.length):null;
 return {...s,tasks,completed,percent,overdue:tasks.filter(i=>i.date<today&&fraction(i)<1).length};
}
export async function teacherWeekly(api,host,{cohort='',onStudent}={}){
 const panel=el('section',null,'tw-panel');host.append(panel);
 let data,loading=false;
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b};
 async function load(force=false){
  if(loading)return;loading=true;
  if(force)api.invalidate?.();
  panel.replaceChildren(el('h2','本周打卡总览'),el('p','正在读取本周进度…'));
  try{data=await api('/rest/v1/rpc/rw_teacher_weekly','POST',{});if(panel.isConnected)draw()}
  catch(e){if(panel.isConnected)panel.replaceChildren(el('h2','本周打卡总览'),el('p','进度暂时无法读取：'+e.message),button('重试',()=>load(true)))}
  finally{loading=false}
 }
 function detail(s){
  const d=el('dialog',null,'tw-dialog'),head=el('div',null,'tw-head');
  head.append(el('h2',s.name+' · 本周任务'),button('关闭',()=>d.close()));d.append(head);
  d.append(el('p',s.percent===null?'本周尚未布置任务':`完成 ${s.completed}/${s.tasks.length} 项 · ${s.percent}%`));
  for(const i of [...s.tasks].sort((a,b)=>a.date.localeCompare(b.date))){const row=el('div',null,'tw-detail-row');row.append(el('strong',i.date.slice(5)+' · '+i.label),el('small',(i.start?`第 ${i.start}–${i.end} 条 · `:'')+`${i.done}/${i.total} ${i.unit}`),el('b',i.done>=i.total?'✓ 已完成':i.date>data.today?'待开始':i.date<data.today?'待补做':'进行中'));d.append(row)}
  if(onStudent)d.append(button('查看班级学习记录',()=>{d.close();document.querySelector('.to-shot')?.close();onStudent(s.id,s.cohort)}));
  d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();
 }
 function overview(container){
  const students=data.students.map(s=>studentWeek(s,data.today));
  const metrics=el('div',null,'to-metrics');
  for(const [n,label] of [[students.length,'学生人数'],[students.filter(s=>s.percent===100).length,'全部完成'],[students.filter(s=>s.overdue>0).length,'有逾期']]){const box=el('div');box.append(el('b',n),el('small',label));metrics.append(box)}
  container.append(metrics);
  const grid=el('div',null,'to-groups'),order=['七年级','八年级第一班','八年级第二班','九年级强化班'];
  const groups=[...new Set(students.map(s=>s.cohort))].sort((a,b)=>(order.indexOf(a)<0?99:order.indexOf(a))-(order.indexOf(b)<0?99:order.indexOf(b))||a.localeCompare(b,'zh-CN'));
  for(const group of groups){const members=students.filter(s=>s.cohort===group).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')),card=el('section',null,'to-group'),title=el('h3',group);title.append(el('small',members.length+'人'));card.append(title);
   for(const s of members){const row=button('',()=>detail(s));row.className='to-student';row.setAttribute('aria-label',s.name+' 周任务详情');const right=el('span',null,'to-result');right.append(el('b',s.percent===null?'未布置':s.percent===100?'✓ 100%':s.percent+'%',s.percent===100?'to-complete':''),el('small',s.percent===null?'—':`${s.completed}/${s.tasks.length} 项`));if(s.overdue)right.append(el('em','逾期'+s.overdue));const bar=el('progress');bar.max=100;bar.value=s.percent??0;bar.setAttribute('aria-label',s.name+'完成比例');right.append(bar);row.append(el('strong',s.name),right);card.append(row)}grid.append(card)
  }
  container.append(grid,el('p','学习 / 复习 + 每日口头抽查 · 百分比为任务完成进度 · 点击姓名查看明细','to-note'));
 }
 function screenshot(){
  const d=el('dialog',null,'to-shot'),bar=el('div',null,'to-shot-tools'),sheet=el('div',null,'to-sheet');bar.append(el('small','截图视图 · 全部学生'),button('关闭截图',()=>d.close()));d.append(bar,sheet);
  const h=el('div',null,'tw-head');h.append(el('h2','本周打卡总览'),el('small',data.week+' — '+data.end));sheet.append(h);overview(sheet);
  function fit(){sheet.style.transform='';sheet.style.width='';const width=Math.min(1100,innerWidth-24);sheet.style.width=width+'px';const scale=Math.min(1,(innerHeight-64)/sheet.scrollHeight);sheet.style.transform=`scale(${scale})`;sheet.style.marginLeft=((innerWidth-24-width*scale)/2)+'px'}
  d.addEventListener('close',()=>{window.removeEventListener('resize',fit);d.remove()});document.body.append(d);d.showModal();window.addEventListener('resize',fit);requestAnimationFrame(fit);
 }
 function draw(){
  panel.replaceChildren();const head=el('div',null,'tw-head'),actions=el('div');actions.append(button('截图视图',screenshot),button('刷新进度',()=>load(true)));head.append(el('h2','本周打卡总览'),actions);panel.append(head,el('small',`${data.week} ～ ${data.end} · 北京时间`));overview(panel);
 }

 await load();
}
