const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('class-ui.mjs','utf8').split('async function api(')[1].split('\nfunction guard')[0];
(async()=>{
 for(const status of [401,503]){
  const calls=[];let speech=0;
  const context={saved:{refresh_token:'test-only',expires_at:Date.now()/1000+3600},refreshing:null,Date,loginScreen(){throw Error('unexpected reload')},remember(s){context.saved=s},raw:async(path)=>{calls.push(path);if(path.startsWith('/auth/'))return {refresh_token:'renewed',expires_at:Date.now()/1000+3600};if(!speech++)throw Object.assign(Error('failure'),{status});return {text:'apple'}}};
  vm.createContext(context);vm.runInContext('async function api('+code,context);
  if(status===401){assert.deepEqual(await context.api('/functions/v1/rw-daily-oral','POST',{}),{text:'apple'});assert.equal(calls.length,3)}
  else{await assert.rejects(context.api('/functions/v1/rw-daily-oral','POST',{}));assert.equal(calls.length,1)}
 }
 const {createClassClient}=await import('../class-api.mjs');
 const api=createClassClient(async()=>({status:429,data:{error:'今日语音额度已用完，请稍后再试'}}),()=>null);
 await assert.rejects(api('/functions/v1/rw-daily-oral'),/今日语音额度/);
 console.log('PASS one 401 refresh/retry, no retry on provider error, daily oral error preserved');
})().catch(e=>{console.error(e);process.exit(1)});
