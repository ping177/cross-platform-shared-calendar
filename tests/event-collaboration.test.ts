import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canManageSpaceEvent } from '../src/lib/space-content.ts';
import { eventSaveRpcArgs, occurrenceContentChanges } from '../src/lib/event-edit-mutation.ts';
const shared = { id: 's', kind: 'shared', created_by: 'a' } as any;
const personal = { id: 'p', kind: 'personal', created_by: 'a' } as any;
const members = [{ space_id: 's', user_id: 'a' }, { space_id: 's', user_id: 'b' }] as any;
test('Shared membership, rather than assignment or creator, controls Event management', () => {
  for (const user of ['a','b']) for (const owner of ['a','b',null]) {
    assert.equal(canManageSpaceEvent(shared, { space_id:'s',scope:owner?'personal':'shared',owner_user_id:owner } as any,user,members),true);
  }
  assert.equal(canManageSpaceEvent(shared,{space_id:'s'} as any,'outsider',members),false);
  assert.equal(canManageSpaceEvent(shared,{space_id:'other'} as any,'a',members),false);
  assert.equal(canManageSpaceEvent(shared,{space_id:'s'} as any,'b',[]),false);
});
test('Personal Space retains both membership and owner protection', () => {
  const event={space_id:'p',scope:'personal',owner_user_id:'a'} as any;
  assert.equal(canManageSpaceEvent(personal,event,'a',[{space_id:'p',user_id:'a'}] as any),true);
  assert.equal(canManageSpaceEvent(personal,event,'b',[{space_id:'p',user_id:'b'}] as any),false);
});
test('edit RPC pins event identity and version, keeps audience separate from content scope', () => {
  const target={kind:'occurrence',event:{id:'e',updated_at:'version'},occurrence:{occurrence_date:'2030-01-01'}} as any;
  const args=eventSaveRpcArgs(target,{scope:'personal',owner_user_id:'b'},{title:'new'},'only-this');
  assert.deepEqual(args,{p_event_id:'e',p_expected_updated_at:'version',p_scope:'personal',p_owner_user_id:'b',p_content:{title:'new'},p_edit_mode:'only-this',p_occurrence_date:'2030-01-01'});
  assert.equal('space_id' in args,false);
  assert.equal('created_by' in args,false);
});

test('Event sender requires a fresh DB check after claim, independently of Task checks', () => {
  const logic=readFileSync(new URL('../supabase/functions/send-reminders/logic.ts',import.meta.url),'utf8');
  assert.match(logic,/await dependencies.checkEvent/);
  const sql=readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');
  assert.match(sql,/create function public.check_event_reminder_delivery/);
});

test('occurrence edits retain unchanged override values while audience-only saves make no content override', () => {
  const initial={title:'Overridden title',description:'Overridden description',startsAt:'2030-01-01T12:00',endsAt:'2030-01-01T13:00'} as any;
  assert.deepEqual(occurrenceContentChanges(initial,{...initial,audience:'shared'},v=>v),{});
  assert.deepEqual(occurrenceContentChanges(initial,{...initial,title:'New title'},v=>'iso:'+v),{
    title:'New title',description:'Overridden description',starts_at:'iso:2030-01-01T12:00',ends_at:'iso:2030-01-01T13:00',
  });
});
