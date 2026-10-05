import assert from 'node:assert/strict';
import test from 'node:test';
import { projectTaskReminderCandidates } from '../supabase/functions/send-reminders/tasks.ts';
import { fetchTaskReminderCandidatePage, claimTaskReminder, assertTaskReminderSendable } from '../supabase/functions/send-reminders/task-claim.ts';

const source = { id: 'a', space_id: 's', space_kind: 'shared' as const, personal_owner_id: 'u', title: 'Task',
  assigned_to_user_id: null, due_on: '2026-10-06', status: 'open' as const, reminder_kind: 'all_day_previous_day_20' as const,
  time_zone: 'Asia/Shanghai', reminder_schedule_changed_at: '2026-10-01T00:00:00.123456+00:00' };
const now = new Date('2026-10-05T12:00:00Z');
test('Task uses civil due_on and canonical timezone, including previous calendar day', () => {
  const result = projectTaskReminderCandidates([source], now);
  assert.equal(result.errors.length, 0);
  assert.equal(result.candidates[0].occurrenceDate, source.due_on);
  assert.equal(result.candidates[0].dueAt.toISOString(), now.toISOString());
  assert.equal(projectTaskReminderCandidates([{ ...source, reminder_kind: 'all_day_same_day_08' }], new Date('2026-10-06T00:00:00Z')).candidates.length, 1);
});
test('no due, completed, historical off, future and expired grace have no candidate', () => {
  for (const row of [{ ...source, due_on: null }, { ...source, status: 'completed' as const }, { ...source, reminder_kind: null }]) {
    assert.equal(projectTaskReminderCandidates([row], now).candidates.length, 0);
  }
  assert.equal(projectTaskReminderCandidates([source], new Date(now.getTime() - 1)).candidates.length, 0);
  assert.equal(projectTaskReminderCandidates([source], new Date(now.getTime() + 600_001)).candidates.length, 0);
  assert.equal(projectTaskReminderCandidates([source], new Date(now.getTime() + 600_000)).candidates.length, 1);
});
test('Task rejects invalid date/timezone instead of UTC fallback', () => {
  for (const changes of [{ due_on: '2026-02-30' }, { due_on: 'infinity' }, { time_zone: 'bad-zone' }, { time_zone: '+08:00' }]) {
    assert.equal(projectTaskReminderCandidates([{ ...source, ...changes }], now).errors.length, 1);
  }
});
test('Task candidate RPC validates transport and preserves full raw marker', async () => {
  const rows = await fetchTaskReminderCandidatePage(async (name, args) => {
    assert.equal(name, 'list_task_reminder_candidates'); assert.deepEqual(args, { p_after_id: null, p_limit: 100 });
    return { data: [source], error: null };
  }, { afterId: null, limit: 100 });
  assert.equal(rows[0].reminder_schedule_changed_at, source.reminder_schedule_changed_at);
  for (const data of [null, {}, [{ ...source, status: 'completed' }], [{ ...source, space_kind: 'unknown' }]]) {
    await assert.rejects(fetchTaskReminderCandidatePage(async () => ({ data, error: null }), { afterId: null, limit: 100 }));
  }
});
test('Task claim/check only accept UUID/null and canonical true, never rebuild marker', async () => {
  const id = '99000000-0000-4000-8000-000000000001';
  const input = { taskId: id, occurrenceDate: source.due_on, recipientUserId: id, subscriptionId: id,
    dueAt: now.toISOString(), expectedReminderKind: source.reminder_kind, expectedReminderScheduleChangedAt: source.reminder_schedule_changed_at };
  assert.equal(await claimTaskReminder(async (name, args) => {
    assert.equal(name, 'claim_task_reminder_delivery'); assert.equal(args.p_expected_reminder_schedule_changed_at, source.reminder_schedule_changed_at);
    return { data: id, error: null };
  }, input), id);
  assert.equal(await claimTaskReminder(async () => ({ data: null, error: null }), input), null);
  await assert.rejects(claimTaskReminder(async () => ({ data: true, error: null }), input));
  await assertTaskReminderSendable(async (name) => { assert.equal(name, 'check_task_reminder_delivery'); return { data: true, error: null }; }, id, input.expectedReminderKind, input.expectedReminderScheduleChangedAt);
  for (const data of [false, null, 1, 'true']) await assert.rejects(assertTaskReminderSendable(async () => ({ data, error: null }), id, input.expectedReminderKind, input.expectedReminderScheduleChangedAt));
});
