export function mountAccountSecurity({api,onSetup,onForgot,onBack}){
 const E=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n};
 const field=(parent,label,name,type='text')=>{const l=E('label',label),i=E('input');i.name=name;i.type=type;i.required=true;l.append(i);parent.append(l);return i};
 const birthday=parent=>{const box=E('fieldset'),legend=E('legend','你的生日是多少？'),row=E('div');row.className='birthday-row';box.append(legend,row);parent.append(box);
  const select=(label,name,values)=>{const l=E('label',label),s=E('select');s.name=name;s.required=true;s.append(new Option('请选择',''));values.forEach(v=>s.append(new Option(String(v),String(v))));l.append(s);row.append(l);return s};
  const y=select('年','year',Array.from({length:new Date().getFullYear()-1899},(_,i)=>new Date().getFullYear()-i)),m=select('月','month',Array.from({length:12},(_,i)=>i+1)),d=select('日','day',[]);
  function days(){const old=d.value,n=y.value&&m.value?new Date(Number(y.value),Number(m.value),0).getDate():31;d.replaceChildren(new Option('请选择',''));for(let i=1;i<=n;i++)d.append(new Option(String(i),String(i)));if(Number(old)<=n)d.value=old}
  y.onchange=m.onchange=days;days();
  return ()=>`${y.value}-${m.value.padStart(2,'0')}-${d.value.padStart(2,'0')}`;
 };
 const password=parent=>{const p=field(parent,'新密码（至少6位字母或数字）','password','password'),c=field(parent,'确认新密码','confirm','password');for(const n of [p,c]){n.minLength=6;n.maxLength=72;n.pattern='[A-Za-z0-9]{6,72}';n.autocomplete='new-password'}return ()=>{if(p.value!==c.value)throw Error('两次输入的密码不一致');if(p.value==='12345678')throw Error('请设置自己的密码，不要使用初始密码12345678');return p.value}};
 const submit=(f,label,fn)=>{const b=E('button',label),msg=E('p');msg.setAttribute('role','status');f.append(msg,b);f.onsubmit=async e=>{e.preventDefault();if(!f.reportValidity())return;b.disabled=true;msg.textContent='正在保存…';try{await fn();msg.textContent=''}catch(e){msg.textContent=e.message}finally{b.disabled=false}};return msg};
 const setup=document.getElementById('change');setup.replaceChildren(E('h2','设置密码和密保'),E('p','忘记密码时，自设问题和生日都答对才能重置。'));
 const current=field(setup,'当前密码（首次登录填写初始密码）','current_password','password');current.autocomplete='current-password';
 const newPassword=password(setup),question=field(setup,'自设密保问题','question');question.placeholder='例如：我最喜欢的一本书叫什么？';question.minLength=2;question.maxLength=100;
 const answer=field(setup,'密保答案','answer');answer.maxLength=100;answer.autocomplete='off';const birth=birthday(setup);
 submit(setup,'保存并进入班级',async()=>{const pw=newPassword(),r=await api('setup',{current_password:current.value,password:pw,question:question.value,answer:answer.value,birthday:birth()});if(!r.ok)throw Error(r.message);setup.reset();await onSetup(pw)});
 const switcher=E('button','换个账号');switcher.type='button';switcher.onclick=onBack;setup.append(switcher);
 const login=document.getElementById('login'),forgot=E('button','忘记密码');forgot.type='button';forgot.id='forgot-password';login.append(forgot);
 const recovery=E('form');recovery.id='recover';recovery.hidden=true;setup.after(recovery);
 function showForgot(){onForgot();login.hidden=true;setup.hidden=true;document.getElementById('welcome').hidden=true;recovery.hidden=false;recovery.replaceChildren(E('h2','找回密码'));
  const username=field(recovery,'学生账号','username');username.placeholder='姓名拼音，例如 limingjie';username.pattern='[a-zA-Z0-9_-]{1,24}';username.autocomplete='username';
  submit(recovery,'下一步',async()=>{const account=username.value.trim().toLowerCase(),r=await api('question',{username:account});if(!r.ok)throw Error(r.message);
   recovery.replaceChildren(E('h2','回答密保问题'),E('p','账号：'+account));
   const ans=field(recovery,r.question,'answer');ans.maxLength=100;ans.autocomplete='off';const date=birthday(recovery),pw=password(recovery);
   submit(recovery,'验证并重置密码',async()=>{const r=await api('reset',{username:account,answer:ans.value,birthday:date(),password:pw()});if(!r.ok)throw Error(r.message);
    recovery.reset();recovery.hidden=true;login.hidden=false;document.getElementById('welcome').hidden=false;login.elements.email.value=account;document.getElementById('msg').textContent='密码已重置，请使用新密码登录。';login.elements.password.focus();
   });back();
  });back();
 }
 function back(){const b=E('button','返回登录');b.type='button';b.onclick=()=>{recovery.reset();recovery.hidden=true;login.hidden=false;document.getElementById('welcome').hidden=false;document.getElementById('msg').textContent=''};recovery.append(b)}
 forgot.onclick=showForgot;
 return {showSetup(value=''){setup.hidden=false;login.hidden=true;recovery.hidden=true;document.getElementById('welcome').hidden=true;document.getElementById('room').hidden=true;current.value=value;document.getElementById('msg').textContent=''}};
}
