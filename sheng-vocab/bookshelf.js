'use strict';
window.Bookshelf=(()=>{
 const esc=s=>Classroom.esc(s),MODE='sheng-learning-mode-v1',BOOK='sheng-self-book-v1';
 const categories=['综合词汇','听力专项','阅读专项'];let category='全部',query='';
 const library=()=>Classroom.libraries.find(l=>l.id===localStorage.getItem(BOOK)&&l.selfStudy);
 function context(task){const l=library();return localStorage.getItem(MODE)==='self'&&l?{id:'self-'+l.id,title:l.name,words:l.words,threshold:90,selfStudy:true,category:l.category,description:l.description||'',libraryId:l.id}:task;}
 function record(l){return Classroom.progress(StudentAuth.user.id,'self-'+l.id);}
 function render(){
  const all=Classroom.libraries.filter(l=>l.selfStudy),visible=all.filter(l=>(category==='全部'||l.category===category)&&(!query||(l.name+' '+l.description).toLowerCase().includes(query.toLowerCase())));
  return `<div class="books-heading"><div class="eyebrow">LEARN AT YOUR OWN PACE</div><h1>自主学习</h1><p class="subtitle">选一本老师准备的词库书，按自己的节奏学习。</p></div><div class="books-note">自主学习与班级任务分别记录，不替代老师布置的任务打卡。</div><div class="book-categories" role="group" aria-label="词库书分类">${['全部',...categories].map(c=>`<button class="${category===c?'active':''}" data-books="category" data-value="${esc(c)}">${esc(c)}</button>`).join('')}</div><form id="book-search-form" class="book-search"><input id="book-search" aria-label="搜索词库书" placeholder="搜索书名或介绍" maxlength="80" value="${esc(query)}"><button type="submit">搜索</button></form><div class="between books-count"><h2>${esc(category==='全部'?'老师的词库书':category)}</h2><span class="muted">${visible.length} 本</span></div><div class="student-book-list">${visible.map(l=>{
   const p=record(l),learned=l.words.filter(w=>p.ratings?.[w.id]).length,best=p.history?.length?Math.max(...p.history.map(h=>h.score)):null;
   const type=l.category==='听力专项'?'listening':l.category==='阅读专项'?'reading':'general';
   return `<article class="student-book"><div class="book-cover ${type}"><span>${l.category==='听力专项'?'♬':l.category==='阅读专项'?'Aa':'ABC'}</span><small>${esc(l.category)}</small></div><div class="book-info"><span class="book-category">${esc(l.category)}${l.sample?' · 示例':''}</span><h3>${esc(l.name)}</h3><p>${esc(l.description||'老师提供的单词书，自由选择学习时间。')}</p><small>${l.words.length} 个单词 · 已学 ${learned} 个${best===null?'':' · 最高 '+best+'%'}</small><div class="book-progress"><span style="width:${l.words.length?Math.round(learned/l.words.length*100):0}%"></span></div><button data-books="open" data-id="${esc(l.id)}">${learned?'继续学习':'选择这本书'} ›</button></div></article>`;
  }).join('')||'<div class="panel empty">暂时没有符合条件的词库书。<br>可切换分类，或请老师导入并开放自主学习。</div>'}</div><p class="notice">专项分类用于选择词汇书；本版练习为单词卡和词义测试。</p>`;
 }
 function tabs(self,books){return `<div class="student-learning-tabs"><button data-books="tasks" class="${!self&&!books?'active':''}">班级任务</button><button data-books="shelf" class="${self||books?'active':''}">自主学习</button></div>`;}
 function contextHeader(t){return `<button class="self-back" data-books="shelf">‹ 换一本词库书</button><div class="self-context"><span class="tag green">自主学习 · ${esc(t.category)}</span><h2>${esc(t.title)}</h2><p class="subtitle">${t.words.length} 个单词 · 无截止日期 · 测试 ${t.threshold}% 达标</p></div><p class="field-hint">学习记录仅属于这本书，不计入班级任务打卡。</p>`;}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-books]');if(!b||!StudentAuth.user||Classroom.isTeacher)return;const a=b.dataset.books;
  if(a==='shelf')window.showBookshelf();
  if(a==='tasks'){localStorage.removeItem(MODE);localStorage.removeItem(BOOK);location.reload();}
  if(a==='category'){category=b.dataset.value;window.showBookshelf();}
  if(a==='open'){const l=Classroom.libraries.find(x=>x.id===b.dataset.id&&x.selfStudy);if(!l||!l.words.length)return;localStorage.setItem(MODE,'self');localStorage.setItem(BOOK,l.id);location.reload();}
 });
 document.addEventListener('submit',e=>{if(e.target.id!=='book-search-form')return;e.preventDefault();query=document.querySelector('#book-search').value.trim();window.showBookshelf();});
 return {context,render,tabs,contextHeader,categories,canQuiz:t=>t.words.length>=4&&new Set(t.words.map(w=>w.zh)).size>=4};
})();
