import assert from 'node:assert/strict';
import test from 'node:test';
import {deliveryIdentity,identityKey,ledgerFilter,processedKeys} from '../supabase/functions/send-reminders/ledger.ts';
const id='93000000-0000-4000-8000-000000000001';
const base={event_id:id,important_date_id:null,task_id:null,occurrence_date:null,subscription_id:id,due_at:'2030-01-01T12:00:00.000Z'};
for(const state of ['sent','failed','claimed'])test(`exact ${state} identity cannot be reclaimed under current SQL contract`,()=>{
 assert.equal(processedKeys([{...base,status:state}],[base]).size,1);
 assert.equal(identityKey({...base,due_at:'2030-01-01T12:00:00+00:00'}),identityKey(base));
});
test('missing row stays eligible; unknown/malformed/different/duplicate rows fail closed',()=>{
 assert.equal(processedKeys([],[base]).size,0);
 assert.throws(()=>processedKeys([{...base,due_at:'2030-01-01T12:00:00.000001+00:00',status:'sent'}],[base]));
 for(const row of [{...base,status:'retrying'},{...base,status:'sent',subscription_id:'other'},{id}])assert.throws(()=>processedKeys([row as any],[base]));
 assert.throws(()=>processedKeys([{...base,status:'sent'},{...base,status:'sent'}],[base]));
});
test('source and occurrence identities match the unique key, including the logical series root',()=>{
 const common={subscription:{id},dueAt:new Date(base.due_at)};
 const ordinary=deliveryIdentity({...common,eventId:id,recurrence:null} as any);
 const recurring=deliveryIdentity({...common,eventId:'split',recurrence:{logicalSeriesId:id,occurrenceDate:'2030-01-01'}} as any);
 const task=deliveryIdentity({...common,task:{id,occurrenceDate:'2030-01-01'}} as any);
 const date=deliveryIdentity({...common,importantDate:{id,occurrenceDate:'2030-01-01'}} as any);
 assert.equal(recurring.event_id,id);assert.notEqual(identityKey(ordinary),identityKey(recurring));
 assert.equal(new Set([ordinary,recurring,task,date].map(identityKey)).size,4);
});
test('query encodes every exact identity field with bounded URL length and no injection',()=>{
 const rows=Array.from({length:20},()=>({...base,occurrence_date:'2030-01-01'}));
 const filter=ledgerFilter(rows);assert.ok(encodeURIComponent(filter).length<=6500);
 for(const column of Object.keys(base))assert.ok(filter.includes(column+'.'));
 assert.throws(()=>ledgerFilter(Array(21).fill(base)));
 assert.throws(()=>ledgerFilter([{...base,event_id:id+',status.eq.sent'}]));
 assert.throws(()=>ledgerFilter([]));
});
