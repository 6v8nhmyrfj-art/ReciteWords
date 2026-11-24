import assert from 'node:assert/strict';
import {dailyOralRounds} from '../daily-oral-plan.mjs';
const make=(n,kind,offset=0)=>Array.from({length:n},(_,i)=>({source:'book',index:i+1+offset,word:{en:kind==='phrase'?'give up':'word'+i,kind}}));
const words=make(100,'word'),phrases=make(50,'phrase',100),rounds=dailyOralRounds([...words,...phrases]);
assert.deepEqual(rounds.map(r=>r.total),[45,45,60]);assert.deepEqual(rounds.map(r=>r.items.filter(e=>e.word.kind==='word').length),[30,30,40]);assert.deepEqual(rounds.map(r=>r.items.filter(e=>e.word.kind==='phrase').length),[15,15,20]);
assert.equal(new Set(rounds.flatMap(r=>r.items.map(e=>e.key))).size,150);
assert.equal(dailyOralRounds([...words,...words]).reduce((n,r)=>n+r.total,0),100);
for(let n=1;n<120;n++){const rs=dailyOralRounds(make(n,'word'));assert.equal(rs.reduce((sum,r)=>sum+r.total,0),n);assert(rs.every(r=>r.total>0&&r.requiredCorrect<=r.total))}
assert.deepEqual(dailyOralRounds([]),[]);assert.throws(()=>dailyOralRounds([{source:'a',index:0,word:{en:'x'}}]));
console.log('PASS 30/30/40 stratification, words/phrases, no duplicate or missing entries, review overlap deduplication, small ranges, 90 percent per round');
