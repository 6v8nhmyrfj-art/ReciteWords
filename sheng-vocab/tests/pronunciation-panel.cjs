const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:375,height:667}});
 await p.route('http://localhost/**',r=>{const f=new URL(r.request().url()).pathname.slice(1);r.fulfill(f?{contentType:f.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(f,'utf8')}:{contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/pronunciation.css"><style>body{margin:0}</style><main></main>'})});
 await p.goto('http://localhost/');
 await p.evaluate(async()=>{
  window.stops=0;window.getUserMediaCalls=0;Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{window.getUserMediaCalls++;return{getTracks:()=>[{stop:()=>window.stops++}]}}}});
  window.MediaRecorder=class{constructor(){this.mimeType='audio/webm';this.state='inactive'}start(){this.state='recording'}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['fake-recording'])});this.onstop?.()}};
  const {pronunciationPanel}=await import('/pronunciation-panel.mjs'),F=await import('/pronunciation-flow.mjs');window.F=F;window.judgements=0;window.saved=null;window.completed=false;
  window.widget=pronunciationPanel({container:document.querySelector('main'),state:F.createPronunciationFlow([1,2],[2]),words:[{en:'understand'},{en:'answer'}],play:async()=>{},onJudge:async({state,index})=>{window.judgements++;window.saved=F.advancePronunciation(state,{kind:'judged',index,verdict:window.judgements===1?'incorrect':'correct'});return window.saved},onPractice:async({state,index})=>F.advancePronunciation(state,{kind:'practised',index}),onComplete:()=>window.completed=true});
 });
 assert.equal(await p.getByText('听标准发音',{exact:false}).count(),0);
 async function record(){await p.getByRole('button',{name:'开始录音',exact:true}).click();await p.getByRole('button',{name:'结束录音',exact:true}).waitFor();await p.waitForTimeout(450);await p.getByRole('button',{name:'结束录音',exact:true}).click();await p.getByRole('button',{name:'听自己的录音'}).waitFor()}
 await record();await p.getByRole('button',{name:'提交发音',exact:true}).click();await p.getByRole('button',{name:'▶ 听标准发音',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'开始录音'}).count(),0);
 await p.getByRole('button',{name:'▶ 听标准发音',exact:true}).click();await record();await p.getByRole('button',{name:'完成跟读',exact:true}).click();assert.equal(await p.getByText('错词重测 · 独立朗读').count(),1);
 await record();await p.getByRole('button',{name:'开始录音',exact:true}).click();assert.equal(await p.getByRole('button',{name:'提交发音',exact:true}).count(),0);await p.waitForTimeout(450);await p.getByRole('button',{name:'结束录音',exact:true}).click();await p.getByRole('button',{name:'提交发音',exact:true}).click();await p.getByRole('button',{name:'进入词义测试',exact:true}).click();assert.equal(await p.evaluate(()=>completed),true);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
 await p.evaluate(()=>widget.dispose());assert.equal(await p.locator('.pr-root').count(),0);assert((await p.evaluate(()=>stops))>=4);console.log('PASS microphone cleanup, recording before submission, first-pass failures, listen-before-follow, mandatory retest, stale clip removal, meaning-stage unlock, mobile layout');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
