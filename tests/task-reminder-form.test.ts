import assert from 'node:assert/strict';
import test from 'node:test';
import { taskReminderValues } from '../src/lib/task.ts';
import { taskEditableChanges } from '../src/lib/task.ts';

const task = { title: 'Task', assigned_to_user_id: null, due_on: '2026-10-06', reminder_kind: null, time_zone: null } as any;
test('historical off never captures/guesses a timezone, including due edits', () => {
  assert.deepEqual(taskReminderValues(task,'2026-10-07',null,() => { throw new Error('must not capture'); }), { reminder_kind:null,time_zone:null });
});
test('enabling captures IANA and capture failure rejects the whole mutation', () => {
  assert.deepEqual(taskReminderValues(task,task.due_on,'all_day_same_day_08',() => 'Asia/Shanghai'), { reminder_kind:'all_day_same_day_08',time_zone:'Asia/Shanghai' });
  for(const zone of [null,'bad-zone','+08:00']) assert.throws(() => taskReminderValues(task,task.due_on,'all_day_same_day_08',() => zone), /时区/);
});
test('canonical timezone persists across device changes; removing due closes reminder', () => {
  assert.deepEqual(taskReminderValues({...task,time_zone:'America/New_York'},task.due_on,'all_day_previous_day_20',() => 'Asia/Shanghai'), { reminder_kind:'all_day_previous_day_20',time_zone:'America/New_York' });
  assert.deepEqual(taskReminderValues({...task,time_zone:'UTC'},'', 'all_day_same_day_08'), { reminder_kind:null,time_zone:'UTC' });
  assert.throws(() => taskReminderValues(task,task.due_on,'timed_at_start' as any), /提醒/);
});
test('Task editable diff carries preset/zone but never server marker or status', () => {
  assert.deepEqual(taskEditableChanges(task,{ title:task.title,assigned_to_user_id:null,due_on:task.due_on,reminder_kind:'all_day_same_day_08',time_zone:'UTC' }), {reminder_kind:'all_day_same_day_08',time_zone:'UTC'});
});
