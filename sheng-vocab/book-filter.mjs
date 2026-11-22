const E=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n};
export function classifyBook(b){const text=[b.title,b.book].filter(Boolean).join(' ');return {grade:b.grade||text.match(/[七八九]年级/)?.[0]||'通用',purpose:/完[型形]/.test(text)?'完型':b.category==='writing'||/写作|作文/.test(text)?'写作':'阅读'}}
export function bookFilter({items,container,state={},preferredGrade,render}){
 if(!document.getElementById('book-filter-css')){const l=E('link');l.id='book-filter-css';l.rel='stylesheet';l.href='./book-filter.css?v=book-filter-20261122';document.head.append(l)}
 const root=E('div');root.className='bf-root';container.append(root);
 function draw(){
  root.replaceChildren();const grades=['七年级','八年级','九年级','通用'].filter(g=>items.some(b=>classifyBook(b).grade===g));
  if(!grades.length){root.append(E('p','暂无词书'));return}
  if(!grades.includes(state.grade))state.grade=grades.includes(preferredGrade)?preferredGrade:grades[0];
  const gradeBooks=items.filter(b=>classifyBook(b).grade===state.grade),purposes=['完型','阅读','写作'];
  if(!gradeBooks.some(b=>classifyBook(b).purpose===state.purpose))state.purpose=purposes.find(p=>gradeBooks.some(b=>classifyBook(b).purpose===p));
  function buttons(label,values,selected,onSelect,count){const bar=E('div');bar.className='bf-bar';bar.setAttribute('role','group');bar.setAttribute('aria-label',label);for(const value of values){const n=count(value),b=E('button',value);b.type='button';b.setAttribute('aria-pressed',String(value===selected));b.disabled=!n;b.onclick=()=>{onSelect(value);draw()};bar.append(b)}root.append(bar)}
  buttons('按年级筛选',grades,state.grade,g=>state.grade=g,g=>items.filter(b=>classifyBook(b).grade===g).length);
  buttons('按用途筛选',purposes,state.purpose,p=>state.purpose=p,p=>gradeBooks.filter(b=>classifyBook(b).purpose===p).length);
  const filtered=gradeBooks.filter(b=>classifyBook(b).purpose===state.purpose),caption=E('small',state.grade+' · '+state.purpose+' · '+filtered.length+' 本'),list=E('div');caption.className='bf-caption';list.className='bf-list';root.append(caption,list);render(filtered,list);
 }draw();return root;
}
