const POS=/^(?:(?:n|v|vi|vt|adj|adv|prep|conj|pron|num|art|det|aux|int|interj)\.?)(?:\s*[/;,、]\s*(?:n|v|vi|vt|adj|adv|prep|conj|pron|num|art|det|aux|int|interj)\.?)*$/i;
const isWord=en=>/^[a-z]+(?:['’-][a-z]+)*$/i.test(en);
const clean=s=>String(s||'').trim();
function rows(text,delimiter){
 const result=[];let row=[],cell='',quoted=false,line=1,start=1;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'&&(quoted||!cell)){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(!quoted&&c===delimiter){row.push(clean(cell));cell=''}
  else if(c==='\n'){if(quoted)cell+='\n';else{row.push(clean(cell));result.push({line:start,cells:row});row=[];cell='';start=line+1}line++}
  else if(c!=='\r')cell+=c
 }
 if(quoted)throw Error('存在未闭合的双引号，请检查 CSV 内容。');
 if(cell||row.length){row.push(clean(cell));result.push({line:start,cells:row})}
 return result
}
export function parseVocabulary(text){
 text=clean(text.replace(/^\uFEFF/,''));
 if(text.length>1000000)throw Error('一次请导入不超过 1 MB 的文本。');
 const first=text.split(/\r?\n/).find(x=>x.trim())||'';
 const delimiter=text.includes('\t')?'\t':first.includes('|')?'|':first.includes(',')?',':null;
 const source=delimiter?rows(text,delimiter):text.split(/\r?\n/).map((s,i)=>({line:i+1,cells:s.split(/ {2,}/).map(clean)}));
 const words=[],errors=[],seen=new Map();let duplicates=0;
 for(const {line,cells:original} of source){
  let cells=original;if(cells.every(c=>!c))continue;
  if(/^(英文|单词|word|english)$/i.test(cells[0])&&cells.some(c=>/中文|释义|meaning/i.test(c)))continue;
  if(cells.length===1){
   const m=cells[0].match(/^(.+?)\s+((?:n|v|vi|vt|adj|adv|prep|conj|pron|num|art|det|aux|int)\.)\s*(.+)$/i);
   if(m){const tail=m[3].match(/^(.+?)\s+([A-Za-z].*)$/);cells=[m[1],m[2],tail?tail[1]:m[3],tail?tail[2]:'']}
   else{const split=cells[0].search(/[\u3400-\u9fff]/);if(split>0)cells=[cells[0].slice(0,split).trim(),cells[0].slice(split).trim()]}
  }
  const en=clean(cells[0]);let pos='',zh='',example='',translation='';
  if(isWord(en)){
   if(POS.test(cells[1]||'')){[,pos,zh,example,translation]=cells}
   else if(POS.test(cells[4]||'')){[,zh,example,translation,pos]=cells} // Legacy five-column template.
   else{errors.push('第 '+line+' 行「'+en+'」缺少有效词性');continue}
   if(!zh||!example){errors.push('第 '+line+' 行「'+en+'」需要中文释义和英文例句');continue}
   if(!example.toLowerCase().includes(en.toLowerCase())){errors.push('第 '+line+' 行例句需包含原词「'+en+'」');continue}
  }else{
   zh=cells[1]===''?cells[2]:cells[1];
   if(cells[1]&&POS.test(cells[1])&&cells[2])zh=cells[2];
   if(cells.length>2&&cells.slice(2).some(Boolean)&&zh!==cells[2]){errors.push('第 '+line+' 行短语或句子请使用两列；CSV 中含逗号的句子需用双引号包住');continue}
  }
  if(!en||!zh||!/[a-z]/i.test(en)){errors.push('第 '+line+' 行需要英文和中文翻译');continue}
  const w={en,zh:clean(zh),...(isWord(en)?{pos:clean(pos),example:clean(example),translation:clean(translation)}:{})};
  const key=en.toLowerCase().replace(/\s+/g,' ');
  if(seen.has(key)){if(JSON.stringify(seen.get(key))===JSON.stringify(w))duplicates++;else errors.push('第 '+line+' 行「'+en+'」重复且内容不同，请保留需要的版本');continue}
  seen.set(key,w);words.push(w)
 }
 if(words.length>1000)errors.push('每次最多导入 1000 个条目，请分批导入。');
 if(!words.length&&!errors.length)errors.push('请先粘贴词汇或选择文件。');
 return {words,errors,duplicates}
}
