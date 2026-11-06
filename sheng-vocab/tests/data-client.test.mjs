import assert from 'node:assert/strict';
import {createDataClient} from '../data-client.mjs';
class Memory {m=new Map();get length(){return this.m.size}key(i){return [...this.m.keys()][i]}getItem(k){return this.m.get(k)||null}setItem(k,v){this.m.set(k,v)}removeItem(k){this.m.delete(k)}}
const storage=new Memory();let clock=0,calls=[],fail=false,applied=new Set(),release;
const transport=async(path,method,body)=>{calls.push({path,body});if(path.includes('rw_practice')){applied.add(body.p_id);if(fail)throw Error('network response lost');return true}if(path.includes('slow'))await new Promise(r=>release=r);return [{id:'book',title:'Book',words:[{en:'cat'}],updated_at:'v1'}]};
let api=createDataClient(transport,'u1',{storage,now:()=>clock});
const path='/rest/v1/rpc/rw_library_catalog';
const a=await Promise.all([api(path,'POST',{}),api(path,'POST',{})]);assert.equal(calls.length,1);a[0][0].title='changed';assert.equal((await api(path,'POST',{}))[0].title,'Book');
clock=61000;await api(path,'POST',{});assert.equal(calls.length,2);
const book={id:'book',updated_at:'v1'};await api.loadBook('library',book);const n=calls.length;await api.loadBook('library',book);assert.equal(calls.length,n);
await api.loadBook('library',{...book,updated_at:'v2'});assert.equal(calls.length,n+1);
fail=true;const body={p_id:'id1',p_choice:'cat'};await assert.rejects(api('/rest/v1/rpc/rw_practice','POST',body));assert.equal(api.pendingCount(),1);
api=createDataClient(transport,'u1',{storage,now:()=>clock});assert.equal(api.pendingCount(),1);fail=false;await api.flushPending();assert.equal(api.pendingCount(),0);assert.equal(applied.size,1);assert.equal(calls.filter(x=>x.body?.p_id==='id1').length,2);
const other=createDataClient(transport,'u2',{storage,now:()=>clock});const before=calls.length;await other.loadBook('library',book);assert.equal(calls.length,before+1);assert.equal(other.pendingCount(),0);
const slow=api('/rest/v1/slow');api.invalidate();release();await slow;const late=api('/rest/v1/slow');assert.equal(calls.at(-1).path,'/rest/v1/slow');release();await late;
await api('/rest/v1/rpc/rw_mastery_books','POST',{});const count=calls.length;await api('/rest/v1/rw_bookshelf','POST',[]);await api('/rest/v1/rpc/rw_mastery_books','POST',{});assert.equal(calls.length,count+2);
console.log('PASS cache TTL/coalescing/copy isolation/book version/account isolation/invalidation/durable same-id retry');
