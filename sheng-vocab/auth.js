'use strict';
// Local UX prototype only. Replace this adapter with a server-verified identity service before release.
window.StudentAuth = (() => {
 const STORE='sheng-auth-demo-v1',SESSION='sheng-auth-demo-session';
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let accounts=[],user=null,mode='login',wechat=false,otp=null;
 try{const stored=JSON.parse(localStorage.getItem(STORE));if(Array.isArray(stored))accounts=stored;user=accounts.find(a=>a.id===localStorage.getItem(SESSION))||null;}catch{}
 const root=()=>document.querySelector('#app');
 const message=t=>{const el=document.querySelector('#auth-message');if(el){el.textContent=t;el.focus();}};
 const masked=phone=>phone.slice(0,3)+'****'+phone.slice(-4);
 function render(){
  root().innerHTML=`<div class="page auth-page"><div class="between"><div class="brand"><span class="brand-symbol">S</span>盛老师词汇训练</div><span class="tag">登录体验版</span></div><div class="demo-role-cards"><button data-school="teacher-mode"><b>老师体验</b><span>导入词库 · 发布任务 · 查看打卡 ›</span></button><button data-school="student-mode"><b>学生体验</b><span>学习任务 · 背词测试 · 个人进度 ›</span></button></div><div class="auth-art" aria-hidden="true"><span>Aa</span><i>✓</i><b>每天一点，记得更牢</b></div><h1>${mode==='register'?'开启你的学习旅程':'欢迎回来，同学'}</h1><p class="subtitle">${mode==='register'?'加入班级，让每一点进步都有记录。':'登录后，继续上次的词汇训练。'}</p><div class="auth-tabs" role="group" aria-label="登录或注册"><button data-auth="login" class="${mode==='login'?'chosen':''}">登录</button><button data-auth="register" class="${mode==='register'?'chosen':''}">首次注册</button></div>${wechat?'<div class="auth-info">正在体验模拟微信流程，请补充学生资料。未连接真实微信账号。</div>':''}<form id="auth-form">${mode==='register'?'<label class="auth-label" for="student-name">学生姓名</label><input class="input" id="student-name" name="studentName" maxlength="20" required autocomplete="name" placeholder="体验请填写化名，如：小明">':''}<label class="auth-label" for="student-phone">手机号</label><input class="input" id="student-phone" name="phone" inputmode="tel" type="tel" maxlength="11" pattern="1[3-9][0-9]{9}" required autocomplete="tel" placeholder="体验号码：13800000001"><label class="auth-label" for="student-code">验证码</label><div class="code-row"><input class="input" id="student-code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code" placeholder="6 位体验验证码"><button type="button" class="code-button" data-auth="code">获取体验码</button></div>${mode==='register'?'<label class="auth-label" for="student-class">班级邀请码</label><input class="input" id="student-class" name="invite" required maxlength="24" placeholder="体验邀请码：DEMO2026"><p class="field-hint">由老师提供，帮助你加入正确的班级。</p>':''}<label class="auth-consent"><input type="checkbox" required name="consent"><span>我已了解这是本地体验版，请勿填写真实个人信息；资料与进度仅保存在此浏览器。</span></label><p id="auth-message" class="auth-message" role="status" tabindex="-1"></p><button type="submit" class="primary">${mode==='register'?'注册并加入体验班级':'登录并继续学习'}</button></form><div class="auth-separator"><span>其他登录方式</span></div><button class="wechat-button" data-auth="wechat"><span aria-hidden="true">◉</span> 体验微信登录 <small>模拟</small></button><div class="auth-info"><strong>本次仅体验操作流程</strong><br>未发送短信、未连接微信、未验证真实身份。正式版接入认证和数据库后，才支持跨设备同步与老师查看记录。</div></div>`;
 }
 function persist(){localStorage.setItem(STORE,JSON.stringify(accounts));}
 function finish(account){try{persist();localStorage.setItem(SESSION,account.id);}catch{message('当前浏览器无法保存账号，请开启本地存储后重试。');return;}location.reload();}
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-auth]');if(!b)return;
  const a=b.dataset.auth;
  if(a==='login'||a==='register'){mode=a;wechat=false;otp=null;render();}
  if(a==='code'){
   const phone=document.querySelector('#student-phone').value.trim();
   if(!/^1[3-9]\d{9}$/.test(phone)){message('请填写 11 位手机号格式的体验号码，例如 13800000001。');return;}
   otp={phone,expires:Date.now()+300000};message('体验验证码：123456（5 分钟内有效）。没有发送短信。');
  }
  if(a==='wechat'){
   const dialog=document.createElement('dialog');dialog.className='wechat-dialog';dialog.innerHTML='<h2>体验微信登录</h2><p>正式版会跳转微信完成授权，再绑定学生资料。本次仅模拟页面流程，不会获取微信信息。</p><button class="primary" data-auth="wechat-continue">模拟授权，补充资料</button><button class="plain" data-auth="wechat-cancel">暂不体验</button>';document.body.append(dialog);dialog.showModal();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  }
  if(a==='wechat-cancel')b.closest('dialog').close();
  if(a==='wechat-continue'){b.closest('dialog').close();mode='register';wechat=true;otp=null;render();}
  if(a==='logout'){try{localStorage.removeItem(SESSION);location.reload();}catch{message('退出失败，请检查浏览器存储设置。');}}
 });
 document.addEventListener('submit',e=>{
  if(e.target.id!=='auth-form')return;e.preventDefault();
  const f=new FormData(e.target),phone=String(f.get('phone')).trim();
  if(!otp||otp.phone!==phone||Date.now()>otp.expires){message('请先为当前手机号获取体验验证码。');return;}
  if(f.get('code')!=='123456'){message('验证码不正确，体验码为 123456。');return;}
  const existing=accounts.find(a=>a.phone===phone);
  if(mode==='login'){if(!existing){message('该体验号码尚未注册，请点击“首次注册”。');return;}finish(existing);return;}
  const name=String(f.get('studentName')).trim();if(!name){message('请填写学生姓名，体验时请使用化名。');return;}
  if(String(f.get('invite')).trim().toUpperCase()!=='DEMO2026'){message('邀请码不正确，体验邀请码为 DEMO2026。');return;}
  if(existing){message('该体验号码已经注册，请切换到登录。');return;}
  const account={id:crypto.randomUUID(),name,phone,className:'盛老师 · 词汇体验班',provider:wechat?'微信流程模拟':'手机号流程模拟'};
  accounts.push(account);finish(account);
 });
 return {get accounts(){return accounts;},demo(){let a=accounts.find(x=>x.id==='demo-student');if(!a){a={id:'demo-student',name:'体验学生',phone:'13800000009',className:'盛老师 · 词汇体验班',provider:'体验入口（非真实认证）'};accounts.push(a);}localStorage.setItem('sheng-classroom-role-v1','student');finish(a);},get user(){return user;},get key(){return user?'sheng-vocab-student-'+user.id:'sheng-vocab-guest-unused';},render,escape,masked,
  rename(name){if(!user)return;user.name=name;persist();},
  accountPanel(){return `<div class="panel help"><strong>学生账号</strong><p>姓名：${escape(user.name)}<br>手机号：${escape(masked(user.phone))}<br>班级：${escape(user.className)}<br>登录方式：${escape(user.provider)}<br>账号编号：${escape(user.id.slice(0,8))}</p></div><button class="logout-button" data-auth="logout">退出登录 / 切换学生</button><p class="notice">本地模拟账号 · 当前设备保存 · 尚无云端同步</p>`;}
 };
})();
