'use strict';
const words=[
 ['discover','发现；发觉','/dɪˈskʌvə(r)/','v.','Discover something new.','发现一些新事物。'],
 ['balloon','气球','/bəˈluːn/','n.','The balloon is blue.','这个气球是蓝色的。'],
 ['wheel','轮子','/wiːl/','n.','The wheel turns slowly.','轮子慢慢转动。'],
 ['central','中心的','/ˈsentrəl/','adj.','Meet me at the central station.','在中心车站见我。'],
 ['although','虽然；尽管','/ɔːlˈðəʊ/','conj.','Although it is cold, we go outside.','虽然天气冷，我们还是出去了。'],
 ['attach','系上；连接','/əˈtætʃ/','v.','Attach the photo to the page.','把照片贴在这一页上。'],
 ['pull','拉；拖','/pʊl/','v.','Pull the door gently.','轻轻拉门。'],
 ['international','国际的','/ˌɪntəˈnæʃənəl/','adj.','This is an international school.','这是一所国际学校。'],
 ['path','小路；路径','/pɑːθ/','n.','Follow the path to the lake.','沿着小路走到湖边。'],
 ['technique','技术；技巧','/tekˈniːk/','n.','Try a different technique.','尝试一种不同的技巧。'],
 ['depend','依靠；取决于','/dɪˈpend/','v.','You can depend on me.','你可以信赖我。'],
 ['describe','描述','/dɪˈskraɪb/','v.','Describe your favorite place.','描述你最喜欢的地方。'],
 ['decide','决定','/dɪˈsaɪd/','v.','Decide what to do next.','决定下一步做什么。'],
 ['develop','发展；培养','/dɪˈveləp/','v.','Develop a good habit.','培养一个好习惯。'],
 ['practice','练习','/ˈpræktɪs/','n. / v.','Practice every day.','每天练习。'],
 ['improve','提高；改善','/ɪmˈpruːv/','v.','Reading can improve your English.','阅读可以提高你的英语水平。'],
 ['knowledge','知识','/ˈnɒlɪdʒ/','n.','Books give us knowledge.','书籍带给我们知识。'],
 ['journey','旅程','/ˈdʒɜːni/','n.','Enjoy the journey.','享受这段旅程。'],
 ['prepare','准备','/prɪˈpeə(r)/','v.','Prepare for tomorrow.','为明天做好准备。'],
 ['remember','记住','/rɪˈmembə(r)/','v.','Remember this happy day.','记住这快乐的一天。']
].map((a,id)=>({id,en:a[0],zh:a[1],ipa:a[2],part:a[3],ex:a[4],translation:a[5]}));
const KEY='sheng-vocab-preview-v1',app=document.querySelector('#app');
let data={name:'小盛',ratings:{},history:[],days:[]};
try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&typeof d==='object'){data.name=typeof d.name==='string'?d.name:'小盛';data.ratings=d.ratings&&typeof d.ratings==='object'?d.ratings:{};data.history=Array.isArray(d.history)?d.history:[];data.days=Array.isArray(d.days)?d.days:[];}}catch{}
let page='home',queue=[],cardIndex=0,revealed=false,quiz=[],quizIndex=0,answers=[],selected=null,activeOptions=[],audioToken=0,voiceList=[],quizResult=null,toastTimer;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const done=()=>words.filter(w=>data.ratings[w.id]).length;
const difficult=()=>words.filter(w=>['bad','mid'].includes(data.ratings[w.id]));
const today=()=>new Date().toLocaleDateString('en-CA');
function save(){if(!data.days.includes(today()))data.days.push(today());try{localStorage.setItem(KEY,JSON.stringify(data));}catch{toast('浏览器无法保存进度，本次学习仍可继续');}}
function toast(t){const e=document.querySelector('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),3000);}
function cancelAudio(){audioToken++;if('speechSynthesis'in window)window.speechSynthesis.cancel();}
function refreshVoices(){if('speechSynthesis'in window)voiceList=window.speechSynthesis.getVoices();}
if('speechSynthesis'in window){refreshVoices();window.speechSynthesis.addEventListener('voiceschanged',refreshVoices);}
function audioStatus(t){const el=document.querySelector('#audio-status');if(el)el.textContent=t;}
function speakWord(){
 cancelAudio();const token=audioToken,w=queue[cardIndex];if(!w||page!=='study')return;
 if(!('speechSynthesis'in window)){audioStatus('当前浏览器不支持设备发音，请换用系统浏览器');return;}
 refreshVoices();const voice=voiceList.find(v=>/^en[-_]GB/i.test(v.lang))||voiceList.find(v=>/^en/i.test(v.lang));
 if(voiceList.length&&!voice){audioStatus('设备未安装英文语音，请在系统设置中添加');return;}
 const utterance=new SpeechSynthesisUtterance(w.en);utterance.lang=voice?voice.lang:'en-GB';if(voice)utterance.voice=voice;utterance.rate=.85;utterance.pitch=1;
 utterance.onstart=()=>{if(token===audioToken)audioStatus('正在播放英文发音…');};
 utterance.onend=()=>{if(token===audioToken)audioStatus('已自动播放 · 点击重听可再听一次');};
 utterance.onerror=e=>{if(token===audioToken&&!['canceled','interrupted'].includes(e.error))audioStatus('自动发音被浏览器阻止，可点“重听”或换用系统浏览器');};
 audioStatus('准备自动播放…');window.speechSynthesis.speak(utterance);
 setTimeout(()=>{if(token===audioToken&&document.querySelector('#audio-status')?.textContent==='准备自动播放…')audioStatus('未能开始发音，可点“重听”或检查设备语音设置');},3000);
}
const icons={home:'<path d="M12 5c-4-3-9-2-9-2v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2v16"/>',test:'<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5"/>',me:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>'};
function nav(active){return `<nav class="nav" aria-label="主导航">${[['home','背单词'],['test','测单词'],['me','我的']].map(([id,t])=>`<button data-action="nav" data-value="${id}" class="${active===id?'active':''}" ${active===id?'aria-current="page"':''}><svg viewBox="0 0 24 24" aria-hidden="true">${icons[id]}</svg>${t}</button>`).join('')}</nav>`;}
function header(t,back='home'){return `<div class="topbar"><button class="back" aria-label="返回" data-action="nav" data-value="${back}">‹</button><h2>${t}</h2></div>`;}
function shell(s,n){app.innerHTML=`<div class="page">${s}</div>${n?nav(n):''}`;}
function task(){return `<button class="row" data-action="study"><span class="grow"><h3>School Life · 精选词汇</h3><small>共 20 词 · ${done()===20?'已完成学习':`已学 ${done()} 词`}</small></span><span class="tag ${done()===20?'green':''}">${done()===20?'已完成':'进行中'}</span><span class="chev">›</span></button>`;}
function render(){
 if(page==='home'){shell(`<div class="brand"><span class="brand-symbol">S</span>盛老师词汇训练</div><h1>你好，${esc(data.name)}</h1><p class="subtitle">每天一点，记得更牢。</p><div class="hero"><div class="eyebrow">▣ 今日任务</div><h2>School Life · 精选词汇</h2><div class="between progress-label"><span>已学习 ${done()} / 20 词</span><span>${done()*5}%</span></div><div class="progress"><span style="width:${done()*5}%"></span></div><button class="primary" data-action="study">${done()===20?'再学一遍':done()?'继续学习':'开始学习'} <span aria-hidden="true">›</span></button><div class="numbers"><div><b>${20-done()}</b><small>待学单词</small></div><div><b>${difficult().length}</b><small>待复习</small></div></div></div><div class="between section"><h2>班级任务</h2><span class="muted">体验班级</span></div><div class="panel">${task()}</div><button class="row panel section" data-action="nav" data-value="vocab"><span class="tool-icon">↻</span><span class="grow"><h3>复习生词</h3><small>把模糊的记忆，变成牢牢记住</small></span><span class="chev">›</span></button><p class="notice">本地体验版 · 演示词库 · 进度仅保存在此浏览器</p>`,'home');}
 else if(page==='study'){const w=queue[cardIndex];shell(`${header('单词学习')}<div class="between study-progress"><span>${cardIndex+1} / ${queue.length}</span><span>每张卡片自动发音</span></div><div class="progress"><span style="width:${(cardIndex+1)/queue.length*100}%"></span></div><div class="wordcard" role="button" tabindex="0" aria-label="切换单词释义" data-action="flip"><h1>${w.en}</h1><p class="phonetic">${w.ipa}</p><p class="part">${w.part}</p><div class="divider"></div>${revealed?`<div class="meaning">${w.zh}</div><div class="example">${w.ex}<br><span class="muted">${w.translation}</span></div>`:'<div class="hidden-meaning">想一想，这个单词是什么意思？</div>'}<p class="hint">点击卡片${revealed?'隐藏':'查看'}释义</p></div><div class="center"><button class="audio" data-action="speak">♬ 重听发音</button></div><div id="audio-status" class="audio-status" role="status">出现新卡片时自动播放</div><div class="ratings"><button class="bad" data-action="rate" data-value="bad"><b>×</b>不认识</button><button class="mid" data-action="rate" data-value="mid"><b>?</b>有点模糊</button><button class="good" data-action="rate" data-value="good"><b>✓</b>认识了</button></div><div class="center"><button class="plain" data-action="previous" ${cardIndex===0?'disabled':''}>‹ 上一词</button></div>`);}
 else if(page==='learned'){shell(`${header('本轮学习完成')}<div class="result"><div class="result-mark">✓</div><h1>又进步了一点！</h1><p class="subtitle">本轮已学习 ${queue.length} 个单词</p><div class="numbers"><div><b>${done()}</b><small>累计已学</small></div><div><b>${difficult().length}</b><small>需要复习</small></div></div><button class="primary" data-action="quiz">测一测，巩固记忆</button><button class="plain" data-action="nav" data-value="home">回到首页</button></div>`);}
 else if(page==='test'){const last=data.history.at(-1);shell(`<div class="brand"><span class="brand-symbol">S</span>盛老师词汇训练</div><h1>测一测，记得更牢</h1><p class="subtitle">每一次回想，都让记忆更深一点。</p><div class="hero"><div class="eyebrow">▤ 单词测试</div><h2>School Life · 精选词汇</h2><p class="subtitle">随机 10 题 · 中文选英文</p><div class="numbers"><div><b>10</b><small>每轮题目</small></div><div><b>90%</b><small>达标正确率</small></div></div><button class="primary" data-action="quiz">${last&&last.score<90?'重新挑战':'开始测试'}</button></div><h2 class="section">最近测试</h2><div class="panel">${data.history.length?data.history.slice(-3).reverse().map(historyRow).join(''):'<div class="empty">还没有测试记录<br>准备好了，就开始第一次挑战吧。</div>'}</div><p class="notice">测试过程中不自动朗读，避免提示答案。</p>`,'test');}
 else if(page==='quiz'){const w=quiz[quizIndex];shell(`${header('单词测试','test')}<div class="between study-progress"><span>第 ${quizIndex+1} / ${quiz.length} 题</span><span>单项选择</span></div><div class="progress"><span style="width:${quizIndex/quiz.length*100}%"></span></div><p class="subtitle section">选择正确的英文</p><div class="question">${w.zh}</div><div class="options">${activeOptions.map((o,i)=>`<button class="option ${selected===o.id?'selected':''}" data-action="answer" data-value="${o.id}" aria-pressed="${selected===o.id}"><span class="letter">${'ABCD'[i]}</span>${o.en}</button>`).join('')}</div><div class="quiz-footer"><button class="primary" data-action="next" ${selected===null?'disabled':''}>${quizIndex===quiz.length-1?'完成测试':'下一题'} ›</button><p class="notice">正确率达到 90% 即可过关</p></div>`);}
 else if(page==='result'){const r=quizResult;shell(`${header('测试结果','test')}<div class="result"><div class="result-mark">${r.score>=90?'✓':'↗'}</div><h1>${r.score>=90?'太棒了，挑战达标！':'再练一次，会更熟悉'}</h1><div class="score">${r.score}<small>%</small></div><p class="muted">答对 ${r.correct} / ${r.total} 题 · ${r.score>=90?'已达到 90% 目标':'达到 90% 即可过关'}<br>本次成绩已保存在当前浏览器</p><button class="primary" data-action="quiz">${r.score>=90?'再挑战一轮':'重新测试'}</button><button class="plain" data-action="nav" data-value="test">回到测单词</button></div>${r.mistakes.length?`<h2 class="section">本次错题</h2><div class="panel">${r.mistakes.map(m=>`<div class="review-item"><strong>${esc(m.zh)}</strong><br><span class="muted">你的答案：${esc(m.chosen)}</span><br>正确答案：${esc(m.en)}</div>`).join('')}</div>`:''}`);}
 else if(page==='me'){const last=data.history.at(-1);shell(`<h1>我的</h1><div class="profile"><div class="avatar">${esc(data.name.slice(0,1))}</div><div><h2>${esc(data.name)}</h2><p class="subtitle">词汇训练 · 体验班级</p></div><button class="plain" data-action="nav" data-value="profile">编辑</button></div><div class="numbers panel"><div><b>${data.days.length}</b><small>学习天数</small></div><div><b>${done()}</b><small>已学单词</small></div><div><b>${last?last.score+'%':'—'}</b><small>最近正确率</small></div></div><h2 class="section">学习工具</h2><div class="panel">${toolRow('vocab','↻','我的生词本',`${difficult().length} 个待复习单词`)}${toolRow('history','▤','测试记录',`${data.history.length} 次练习`)}${toolRow('class','▦','我的班级','查看体验班级信息')}</div><div class="panel section">${toolRow('help','?','使用帮助','发音、数据保存与操作说明')}</div><p class="notice">本地体验版 · 尚未连接教师端或云端账号</p>`,'me');}
 else if(page==='vocab'){const ws=difficult();shell(`${header('我的生词本','me')}<p class="subtitle">不认识、有点模糊的单词会自动收录。</p><div class="spacer"></div>${ws.length?`<button class="primary" data-action="review">复习 ${ws.length} 个生词</button><div class="panel section">${ws.map(w=>`<button class="row" data-action="word" data-value="${w.id}"><span class="grow"><h3>${w.en}</h3><small>${w.zh}</small></span><span class="tag">${data.ratings[w.id]==='bad'?'不认识':'有点模糊'}</span><span class="chev">›</span></button>`).join('')}</div>`:'<div class="panel empty">暂时没有待复习的生词。<br>学习时标记掌握程度，即可自动收录。</div>'}`);}
 else if(page==='history'){shell(`${header('测试记录','me')}<div class="panel">${data.history.length?data.history.slice().reverse().map(historyRow).join(''):'<div class="empty">还没有测试记录。</div>'}</div>`);}
 else if(page==='class'){shell(`${header('我的班级','me')}<div class="hero"><div class="eyebrow">本地体验班级</div><h2>盛老师词汇训练</h2><p class="subtitle">精选词汇 · 20 词</p></div><div class="panel section help">这里使用的是演示班级和词库。当前版本不会向老师提交学习数据，也没有真实的班级加入功能。</div>`);}
 else if(page==='help'){shell(`${header('使用帮助','me')}<div class="panel help"><p><strong>如何背单词</strong><br>进入学习后，每张新卡片自动播放英文发音。点击卡片查看释义，再选择掌握程度。未完成的任务再次进入会继续未学单词。</p><p><strong>自动发音</strong><br>使用设备自带的英文语音，需要系统提供英文语音。微信或部分手机浏览器可能限制自动发音；遇到提示时，可用系统浏览器打开，或点“重听发音”。切到下一张卡片会停止上一段发音。</p><p><strong>测试与生词</strong><br>每轮随机 10 题，90% 达标。错题以及标记为不认识、有点模糊的单词会加入生词本；再次标记为认识后移出。</p><p><strong>数据保存</strong><br>学习进度仅保存在当前浏览器，刷新后可以继续。清除浏览器数据会丢失记录，换设备不会同步。本版不提供真实登录、教师管理或云端服务。</p></div>`);}
 else if(page==='profile'){shell(`${header('编辑昵称','me')}<label for="name" class="muted">学习昵称</label><input class="input" id="name" maxlength="12" value="${esc(data.name)}" autocomplete="nickname"><button class="primary" data-action="save-name">保存昵称</button><p class="notice">仅用于本地展示，无需填写真实姓名。</p>`);}
}
function toolRow(id,icon,title,sub){return `<button class="row" data-action="nav" data-value="${id}"><span class="tool-icon">${icon}</span><span class="grow"><h3>${title}</h3><small>${sub}</small></span><span class="chev">›</span></button>`;}
function historyRow(r){return `<div class="row"><span class="grow"><h3>精选词汇 · ${Number(r.total)||10} 题</h3><small>${esc(new Date(r.time).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))}</small></span><strong style="color:#3478f6">${Number(r.score)||0}%</strong><span class="tag ${r.score>=90?'green':''}">${r.score>=90?'已达标':'待重测'}</span></div>`;}
function go(p){cancelAudio();page=p;render();window.scrollTo(0,0);}
function startStudy(ws){queue=ws||words.filter(w=>!data.ratings[w.id]);if(!queue.length)queue=words.slice();cardIndex=0;revealed=false;go('study');speakWord();}
function shuffle(a){const out=a.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function makeOptions(){selected=null;const w=quiz[quizIndex];activeOptions=shuffle([w,...shuffle(words.filter(o=>o.id!==w.id)).slice(0,3)]);}
function startQuiz(){quiz=shuffle(words).slice(0,10);quizIndex=0;answers=[];makeOptions();go('quiz');}
app.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action,v=b.dataset.value;
 if(a==='nav')go(v);
 else if(a==='study')startStudy();
 else if(a==='review')startStudy(difficult());
 else if(a==='word')startStudy([words[Number(v)]]);
 else if(a==='flip'){revealed=!revealed;const previous=document.querySelector('#audio-status')?.textContent;render();if(previous)audioStatus(previous);}
 else if(a==='speak')speakWord();
 else if(a==='rate'){data.ratings[queue[cardIndex].id]=v;save();if(cardIndex<queue.length-1){cardIndex++;revealed=false;render();speakWord();}else go('learned');}
 else if(a==='previous'&&cardIndex>0){cardIndex--;revealed=false;render();speakWord();}
 else if(a==='quiz')startQuiz();
 else if(a==='answer'){selected=Number(v);render();}
 else if(a==='next'&&selected!==null){
   answers.push({word:quiz[quizIndex],chosen:words[selected]});
   if(quizIndex<quiz.length-1){quizIndex++;makeOptions();render();}else{
    const mistakes=answers.filter(a=>a.word.id!==a.chosen.id).map(a=>({en:a.word.en,zh:a.word.zh,chosen:a.chosen.en}));
    answers.filter(a=>a.word.id!==a.chosen.id).forEach(a=>{data.ratings[a.word.id]='bad';});
    quizResult={time:Date.now(),total:quiz.length,correct:quiz.length-mistakes.length,score:Math.round((quiz.length-mistakes.length)/quiz.length*100),mistakes};
    data.history.push(quizResult);save();go('result');
   }
 }
 else if(a==='save-name'){const n=document.querySelector('#name').value.trim();if(!n){toast('请填写一个昵称');return;}data.name=n.slice(0,12);save();go('me');toast('昵称已保存');}
});
app.addEventListener('keydown',e=>{if(e.target.matches('.wordcard')&&['Enter',' '].includes(e.key)){e.preventDefault();e.target.click();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAudio();});
window.addEventListener('pagehide',cancelAudio);
render();
