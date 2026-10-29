import assert from 'node:assert/strict';
import test from 'node:test';
import { createEventIntent } from '../src/lib/event-create-intent.ts';
const payload = { space_id: 's', created_by: 'u', scope: 'shared', owner_user_id: null, title: 'same', description: null, starts_at: '2030-01-01T00:00:00.000Z', ends_at: null, all_day: false, recurrence_rule: null, reminder_kind: null, time_zone: 'UTC' };
for (const recurring of [false,true]) test(`intent preserves UUID and original ${recurring?'recurring':'ordinary'} payload after lost response`, async()=>{
 const intent=createEventIntent(); const rows:any[]=[];let first=true;
 const ops={verify:async()=>true,insert:async(p:any)=>{if(rows.some(r=>r.id===p.id))return {error:{code:'23505'}}; rows.push({...p});if(first){first=false;throw Error('response lost');}return {error:null};},read:async()=>({data:null,error:null})};
 const p={...payload,recurrence_rule:recurring?{version:1,frequency:'daily',interval:1,time_zone:'UTC'}:null};
 await assert.rejects(intent.save(p,ops)); assert.ok(intent.pending);
 ops.read=async()=>({data:{...rows[0],starts_at:'2030-01-01T00:00:00+00:00'},error:null});
 await intent.save({...p,title:'must not overwrite'},ops);assert.equal(rows.length,1);assert.equal(rows[0].title,'same');
});
test('preflight failure does not send or freeze; normal success completes once',async()=>{
 const i=createEventIntent();let inserts=0;const o={verify:async()=>false,insert:async()=>{inserts++;return {error:null}},read:async()=>({data:null,error:null})};
 await assert.rejects(i.save(payload,o));assert.equal(i.pending,false);assert.equal(inserts,0);
 o.verify=async()=>true;await i.save(payload,o);await i.save(payload,o);assert.equal(inserts,1);
});
for(const failure of ['missing','mismatch','unreadable','account','space'])test(`conflict fails closed for ${failure}`,async()=>{
 const i=createEventIntent();let sent:any;const o={verify:async()=>true,insert:async(p:any)=>{sent=p;return {error:{code:'23505'}}},read:async()=>({data:null as any,error:null as any})};
 if(failure==='mismatch')o.read=async()=>({data:{...sent,title:'different'},error:null});
 if(failure==='unreadable')o.read=async()=>({data:null,error:Error('denied')});
 await assert.rejects(i.save(payload,o));assert.ok(i.pending);
 const p=failure==='account'?{...payload,created_by:'other'}:failure==='space'?{...payload,space_id:'other'}:payload;
 await assert.rejects(i.save(p,o));
});
test('concurrent calls send once and denied revalidation never reports success',async()=>{
 const i=createEventIntent();let release!:()=>void;let count=0;const hold=new Promise<void>(r=>release=r);
 const o={verify:async()=>true,insert:async()=>{count++;await hold;return {error:null}},read:async()=>({data:null,error:null})};
 const first=i.save(payload,o);await assert.rejects(i.save(payload,o));await new Promise(setImmediate);assert.equal(count,1);o.verify=async()=>false;release();await assert.rejects(first);assert.ok(i.pending);
});

for (const key of ['id','space_id','created_by','scope','owner_user_id','description','starts_at','ends_at','all_day','recurrence_rule','reminder_kind','time_zone','series_id','parent_event_id','recurrence_until']) {
  test(`conflict reconciliation rejects a different ${key}`, async () => {
    const intent = createEventIntent(); let sent:any;
    const ops = { verify:async()=>true, insert:async(p:any)=>{sent=p;return {error:{code:'23505'}}},
      read:async()=>({data:{...sent,[key]:key==='all_day'?true:'different'},error:null}) };
    await assert.rejects(intent.save(payload,ops)); assert.ok(intent.pending);
  });
}
test('retry validates original related member and never mutates nested recurrence from the draft', async()=>{
  const intent=createEventIntent(); const checked:any[]=[]; const sent:any[]=[];
  const draft={...payload,scope:'personal',owner_user_id:'partner',recurrence_rule:{frequency:'weekly',days_of_week:[1,3],interval:1,time_zone:'UTC',version:1}};
  const ops={verify:async(p:any)=>{checked.push(p.owner_user_id);return true},insert:async(p:any)=>{sent.push(p);return {error:Error('timeout')}},read:async()=>({data:null,error:null})};
  await assert.rejects(intent.save(draft,ops)); draft.recurrence_rule.days_of_week.push(5);
  await assert.rejects(intent.save({...draft,owner_user_id:'new-partner'},ops));
  assert.deepEqual(checked,['partner','partner']);assert.deepEqual(sent[1],sent[0]);assert.deepEqual(sent[1].recurrence_rule.days_of_week,[1,3]);
});
test('unreadable reconciliation exception preserves uncertain state and same UUID',async()=>{
  const intent=createEventIntent();const ids:string[]=[];
  const ops={verify:async()=>true,insert:async(p:any)=>{ids.push(p.id);throw Error('timeout')},read:async()=>{throw Error('offline')}};
  await assert.rejects(intent.save(payload,ops));await assert.rejects(intent.save(payload,ops));assert.equal(ids[0],ids[1]);assert.ok(intent.pending);
});
