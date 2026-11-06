export async function shelf({api,app,E,button,row,active,start,basic,due,review}){
 const [catalog,saved]=await Promise.all([
  api('/rest/v1/rw_libraries?select=id,title,book,words&order=created_at.desc'),
  api('/rest/v1/rw_bookshelf?select=library&order=added_at.desc')
 ]);
 if(!active())return;
 const chosen=new Set(saved.map(x=>x.library));
 function home(){
  if(!active())return;
  app.replaceChildren(E('h1','自主学习'),button('＋ 添加单词书',picker,'primary'));
  const books=catalog.filter(b=>chosen.has(b.id));
  if(!books.length)app.append(E('p','从老师制作的词书中选择，添加后就能开始学习。'));
  for(const b of books){
   const box=E('section');box.append(row(b.book?b.book+' · '+b.title:b.title,b.words.length+' 个学习条目',()=>start(b,'self')),button('移出书架',async()=>{
    if(!confirm('将这本词书移出书架？已保存的学习记录仍可在“我的”查看。'))return;
    await api('/rest/v1/rw_bookshelf?library=eq.'+b.id,'DELETE');chosen.delete(b.id);home()
   },'back'));app.append(box)
  }
  if(due.length)app.append(row('到期复习',due.length+' 词待巩固',review));
  app.append(row(basic.title,'内置练习 · '+basic.words.length+' 词',()=>start(basic,'self')))
 }
 function picker(){
  if(!active())return;app.replaceChildren(button('‹ 返回书架',home,'back'),E('h1','选择老师的单词书'));
  const groups=new Map();
  for(const b of catalog){const k=b.book?.trim()||b.title;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(b)}
  if(!groups.size)app.append(E('p','老师还没有制作词书，制作完成后会显示在这里。'));
  for(const [title,units] of groups){
   const box=E('section'),pending=units.filter(b=>!chosen.has(b.id));
   const add=button(pending.length?'添加到我的书架':'已添加',async()=>{
    try{await api('/rest/v1/rw_bookshelf','POST',pending.map(b=>({library:b.id})))}catch(e){
     if(e.status!==409)throw e;
     const current=await api('/rest/v1/rw_bookshelf?select=library');current.forEach(x=>chosen.add(x.library));picker();return
    }
    pending.forEach(b=>chosen.add(b.id));home()
   },'primary');add.disabled=!pending.length;
   box.append(E('h2',title),E('p',units.map(b=>b.title).join(' · ')),E('p',units.reduce((n,b)=>n+b.words.length,0)+' 个条目'),add);app.append(box)
  }
 }
 home()
}
