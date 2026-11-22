import assert from 'node:assert/strict';
import {oralHandler} from '../server/oral-handler.mjs';
const sid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';let record,modelCalls=0;
const env=k=>({SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'private',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'test'}[k]);
const handler=oralHandler(env,async(url,opts={})=>{const data=opts.body?JSON.parse(opts.body):null;
 if(url.includes('api.cloudflare.com')){modelCalls++;assert(!url.includes('whisper'));return Response.json({success:true,result:{choices:[{message:{content:'{"verdict":"correct","reason":"同义表达"}'}}]}})}
 if(url.endsWith('/auth/v1/user'))return Response.json({id:'u'});
 if(url.includes('rw_members?'))return Response.json([{role:'student',password_changed:true}]);
 if(url.includes('rw_class_sessions?'))return Response.json([{actor:'u',mode:'reading',response_mode:'oral',goal:'g',revision:1,questions:[{index:1,word:{en:'improve',zh:'提高'}}]}]);
 if(url.includes('rw_class_goals?'))return Response.json([{revision:1}]);
 if(url.includes('rw_oral_take_quota'))return Response.json(true);
 if(url.includes('rw_oral_answers')){if(opts.method==='POST'){record=data;return new Response('')}if(opts.method==='PATCH'){Object.assign(record,data);return new Response('')}return Response.json(record?[record]:[])}
 throw Error('Unexpected URL');
});
const request=p=>new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action:'typed',session:sid,index:1,id,...p})});
assert.equal((await handler(request({text:' '}))).status,400);
const r=await handler(request({text:'变得更好'}));assert.equal(r.status,200);assert.equal((await r.json()).verdict,'correct');assert.equal(record.transcript,'变得更好');assert.equal(modelCalls,0);
assert.equal((await handler(request({text:'变得更好'}))).status,200);assert.equal(modelCalls,0);
assert.equal((await handler(request({text:'另一个答案'}))).status,409);
record.actor='other';assert.equal((await handler(request({text:'变得更好'}))).status,409);
record=undefined;const fallback=await handler(request({text:'让事物向好的方向发展'}));assert.equal(fallback.status,200);assert.equal(modelCalls,1);assert.equal(record.model,'@cf/google/gemma-4-26b-a4b-it');
console.log('PASS local fast path without cloud calls, semantic fallback, typed answers bypass ASR, server grading, retry idempotency, changed text and foreign answer rejection');
