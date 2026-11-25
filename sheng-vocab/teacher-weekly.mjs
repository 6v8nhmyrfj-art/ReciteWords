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
 let selected=cohort,query='',filter='all',data,loading=false;
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b};
 async function load(force=false){
  if(loading)return;loading=true;
  if(force)api.invalidate?.();
  panel.replaceChildren(el('h2','本周学生进度'),el('p','正在读取本周进度…'));
  try{data=await api('/rest/v1/rpc/rw_teacher_weekly','POST',{});if(panel.isConnected)draw()}
  catch(e){if(panel.isConnected)panel.replaceChildren(el('h2','本周学生进度'),el('p','进度暂时无法读取：'+e.message),button('重试',()=>load(true)))}
  finally{loading=false}
 }
 function detail(s){
  const d=el('dialog',null,'tw-dialog'),head=el('div',null,'tw-head');
  head.append(el('h2',s.name+' · 本周任务'),button('关闭',()=>d.close()));d.append(head);
  d.append(el('p',s.percent===null?'本周尚未布置任务':`完成 ${s.completed}/${s.tasks.length} 项 · ${s.percent}%`));
  for(const i of [...s.tasks].sort((a,b)=>a.date.localeCompare(b.date))){const row=el('div',null,'tw-detail-row');row.append(el('strong',i.date.slice(5)+' · '+i.label),el('small',(i.start?`第 ${i.start}–${i.end} 条 · `:'')+`${i.done}/${i.total} ${i.unit}`),el('b',i.done>=i.total?'✓ 已完成':i.date>data.today?'待开始':i.date<data.today?'待补做':'进行中'));d.append(row)}
  if(onStudent)d.append(button('查看班级学习记录',()=>{d.close();onStudent(s.id,s.cohort)}));
  d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();
 }
 function draw(){
  panel.replaceChildren();const head=el('div',null,'tw-head');head.append(el('h2','本周学生进度'),button('刷新进度',()=>load(true)));panel.append(head,el('small',`${data.week} ～ ${data.end} · 北京时间 · 更新于 ${new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}`));
  const controls=el('div',null,'tw-controls'),classes=el('select'),status=el('select'),search=el('input');
  classes.setAttribute('aria-label','按班级查看周进度');status.setAttribute('aria-label','筛选周任务状态');search.setAttribute('aria-label','搜索学生姓名');search.placeholder='搜索姓名';search.type='search';search.value=query;
  for(const g of ['',...new Set(data.students.map(s=>s.cohort))]){const o=el('option',g||'全部班级');o.value=g;classes.append(o)}classes.value=selected;
  for(const [value,text] of [['all','全部状态'],['overdue','有逾期'],['incomplete','未完成'],['complete','已完成'],['unassigned','未布置']]){const o=el('option',text);o.value=value;status.append(o)}status.value=filter;
  controls.append(classes,status,search);panel.append(controls);
  const summary=el('div',null,'tw-summary'),list=el('div',null,'tw-list');panel.append(summary,list);
  function render(){
   const students=data.students.map(s=>studentWeek(s,data.today)).filter(s=>(!selected||s.cohort===selected)&&(!query||s.name.includes(query)));
   const assigned=students.filter(s=>s.percent!==null),done=assigned.filter(s=>s.percent===100).length,late=assigned.filter(s=>s.overdue>0).length;
   summary.textContent=`${students.length} 人 · 全部完成 ${done} 人 · 有逾期 ${late} 人 · 未布置 ${students.length-assigned.length} 人`;
   const visible=students.filter(s=>filter==='all'||(filter==='overdue'?s.overdue>0:filter==='complete'?s.percent===100:filter==='unassigned'?s.percent===null:s.percent!==null&&s.percent<100)).sort((a,b)=>b.overdue-a.overdue||(a.percent??101)-(b.percent??101)||a.name.localeCompare(b.name,'zh-CN'));
   list.replaceChildren();if(!visible.length)list.append(el('p','没有符合条件的学生'));
   for(const s of visible){const row=button('',()=>detail(s));row.className='tw-student';row.setAttribute('aria-label',s.name+' 周任务详情');const left=el('div'),right=el('div',null,'tw-rate');left.append(el('strong',s.name),el('small',s.cohort));right.append(el('b',s.percent===null?'未布置':s.percent===100?'✓ 已完成':s.percent+'%'),el('small',s.percent===null?'等待老师安排':`完成 ${s.completed}/${s.tasks.length} 项${s.overdue?' · 逾期 '+s.overdue+' 项':''}`));const progress=el('progress');progress.max=100;progress.value=s.percent??0;progress.setAttribute('aria-label',s.name+' 本周完成比例');row.append(left,right,progress);list.append(row)}
  }
  classes.onchange=()=>{selected=classes.value;render()};status.onchange=()=>{filter=status.value;render()};search.oninput=()=>{query=search.value.trim();render()};render();
 }
 await load();
}
