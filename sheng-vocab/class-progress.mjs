const E=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n};
export function classProgress(api,container,student=null){
 const box=E('section');box.style.cssText='background:#f0f7ff;border:1px solid #cce0f7;border-radius:14px;padding:14px;margin:12px 0';container.append(box);let page=0,version=0;
 const button=(label,fn)=>{const b=E('button',label);b.type='button';b.onclick=fn;return b};
 async function draw(){const stamp=++version;box.replaceChildren(E('h3','课堂过关'),E('p','正在读取云端记录…'));
 try{const d=await api('/rest/v1/rpc/rw_class_progress','POST',{p_student:student,p_page:page});if(!box.isConnected||stamp!==version)return;
 box.replaceChildren(E('h3','课堂已过关 '+d.total+' 个词条'),E('p',`阅读 ${d.reading} · 默写 ${d.writing} · 教师认定 ${d.teacher}`));
 const note=E('small','按已确认过关范围统计，含教师认定；同一英文词条总数去重，阅读与默写不相加。');box.append(note);
 const books=E('details');books.append(E('summary','按词书查看'));for(const b of d.books)books.append(E('p',b.title+' · '+(b.mode==='writing'?'默写':'阅读')+' · '+b.passed+' 个'));box.append(books);
 const controls=E('div'),prev=button('上一页',()=>{page--;draw()}),next=button('下一页',()=>{page++;draw()});prev.disabled=page===0;next.disabled=(page+1)*10>=d.record_count;controls.append(prev,E('span',` ${page+1}/${Math.max(1,Math.ceil(d.record_count/10))} 页 `),next,button('刷新',draw));box.append(controls);
 if(!d.records.length)box.append(E('p','暂无课堂过关记录'));
 for(const r of d.records){const row=E('details');row.append(E('summary',r.word+' · '+(r.mode==='writing'?'默写':'阅读')+' ✓'),E('p',r.meaning),E('small',r.title+' · '+(r.source==='teacher'?'教师认定':'测试范围过关')+' · '+new Date(r.passed_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})));box.append(row)}
 }catch(e){if(stamp===version&&box.isConnected)box.replaceChildren(E('h3','课堂过关'),E('p',e.message||'加载失败'),button('重试',draw))}}
 draw();return box;
}
export function classRosterProgress(api,container,cohort){
 const box=E('section');container.append(box);box.append(E('h3','课堂过关记录'),E('p','正在读取…'));
 api('/rest/v1/rpc/rw_class_progress','POST',{p_student:null,p_page:0}).then(d=>{if(!box.isConnected)return;box.replaceChildren(E('h3','课堂过关记录'));
 for(const m of d.students.filter(m=>(m.cohort||'待分班')===cohort)){const row=E('details'),summary=E('summary',`${m.display_name} · 已过关 ${m.total} · 阅读 ${m.reading} / 默写 ${m.writing}`);row.append(summary);let loaded=false;row.ontoggle=()=>{if(row.open&&!loaded){loaded=true;classProgress(api,row,m.user_id)}};box.append(row)}}).catch(e=>{if(box.isConnected)box.replaceChildren(E('p',e.message||'课堂记录加载失败'))});
 return box;
}
