import assert from 'node:assert/strict';
import test from 'node:test';
import { runSendReminders, createReminderTag, type RunSendRemindersDependencies } from '../supabase/functions/send-reminders/logic.ts';
import type { TaskReminderSource } from '../supabase/functions/send-reminders/tasks.ts';

const now = new Date('2026-10-06T08:00:00Z');
const context = { runNow: now, startedAt: 0, monotonicNow: () => 0 };
const source: TaskReminderSource = { id: 'same-id', space_id: 's', space_kind: 'shared', personal_owner_id: 'a', title: 'Task', assigned_to_user_id: null,
  status: 'open', due_on: '2026-10-06', reminder_kind: 'all_day_same_day_08', time_zone: 'UTC', reminder_schedule_changed_at: '2000-01-01T00:00:00.123456Z' };
function fixture() {
  const claims = new Set<string>(); const sent: Array<{ id: string; payload: any }> = []; const final: any[] = [];
  const subscriptions = ['a','b','b'].map((user_id, i) => ({ id: `sub${i}`, user_id, installation_id: `install${i}`, endpoint: 'https://fcm.googleapis.com/fake', p256dh: 'fake', auth: 'fake', expiration_time: null, disabled_at: null }));
  const deps: RunSendRemindersDependencies = {
    fetchCandidatePage: async () => [], fetchRecurringCandidatePage: async () => [], fetchImportantDateCandidatePage: async () => [],
    fetchTaskCandidatePage: async () => [source], fetchRecurringExceptions: async () => ({ exceptions: [], exceptionsScanned: 0, exceptionTruncated: false }),
    fetchMemberships: async () => [{ space_id: 's', user_id: 'a' }, { space_id: 's', user_id: 'b' }, { space_id: 's', user_id: 'a' }],
    fetchSubscriptions: async () => [...subscriptions, subscriptions[0]],
    claim: async i => `event:${i.subscriptionId}`, claimRecurring: async i => `recurring:${i.subscriptionId}`, claimImportantDate: async i => `date:${i.subscriptionId}`,
    checkImportantDate: async () => {},
    claimTask: async i => {
      assert.equal(i.expectedReminderScheduleChangedAt, source.reminder_schedule_changed_at);
      const key = `${i.taskId}:${i.occurrenceDate}:${i.subscriptionId}:${i.dueAt}`;
      if (claims.has(key)) return null; claims.add(key); return key;
    },
    checkTask: async () => {},
    send: async (sub, payload) => { sent.push({ id: sub.id, payload }); return { classification: 'delivered', status: 201, provider: 'fcm.googleapis.com' }; },
    disableSubscription: async () => false, finalize: async value => { final.push(value); return 1; },
  };
  return { deps, claims, sent, final };
}
test('unassigned Shared Task fans out per current member/device, dedupes and concurrent runs claim once', async () => {
  const f = fixture(); const results = await Promise.all([runSendReminders(context, f.deps), runSendReminders(context, f.deps)]);
  assert.equal(f.sent.length, 3); assert.equal(f.claims.size, 3); assert.equal(results.reduce((n,r) => n+r.sent,0), 3);
  assert.deepEqual(f.sent.map(s => s.id).sort(), ['sub0','sub1','sub2']);
  assert.equal(new Set(f.sent.map(s => s.payload.tag)).size, 1);
  assert.equal(f.sent[0].payload.tag, await createReminderTag('task:same-id', now, source.due_on));
});
test('Personal self, assigned member and missing assignee membership use Task semantics', async () => {
  for (const [changes, expected] of [
    [{ space_kind: 'personal', assigned_to_user_id: 'b' }, ['sub0']],
    [{ assigned_to_user_id: 'b' }, ['sub1','sub2']],
    [{ assigned_to_user_id: 'gone' }, []],
  ] as const) {
    const f = fixture(); f.deps.fetchTaskCandidatePage = async () => [{ ...source, ...changes }];
    await runSendReminders(context, f.deps); assert.deepEqual(f.sent.map(s => s.id).sort(), [...expected]);
  }
});
test('newly-past and microsecond marker reject Task candidates before claim', async () => {
  const f = fixture(); f.deps.fetchTaskCandidatePage = async () => [{ ...source, reminder_schedule_changed_at: '2026-10-06T08:00:00.000001Z' }];
  const result = await runSendReminders(context, f.deps); assert.equal(result.newly_past_skipped, 1); assert.equal(f.sent.length, 0); assert.equal(f.claims.size,0);
});
test('canonical pre-send completion or transport error blocks provider and finalizes failed without retry', async () => {
  const f = fixture(); f.deps.checkTask = async () => { throw new Error('Task completed after claim'); };
  const result = await runSendReminders(context, f.deps); assert.equal(result.failed, 3); assert.equal(result.sent, 0); assert.equal(f.sent.length,0);
  assert.ok(f.final.every(f => f.status === 'failed' && f.resultCode === 'unexpected_task_error'));
  await runSendReminders(context, f.deps); assert.equal(f.final.length,3);
});
test('mixed Event/Important Date/Task retain distinct tags, one worker/selection path and original Event payload', async () => {
  const f = fixture();
  f.deps.fetchCandidatePage = async () => [{ id: source.id, space_id: 's', scope: 'shared', owner_user_id: null, title: 'Event', starts_at: now.toISOString(), all_day: false,
    reminder_kind: 'timed_at_start', time_zone: 'UTC', reminder_schedule_changed_at: source.reminder_schedule_changed_at }];
  f.deps.fetchImportantDateCandidatePage = async () => [{ id: source.id, space_id: 's', name: 'Date', repeat_kind: 'annual', month: 10, day: 6, year: null,
    reminder_kind: 'all_day_same_day_08', time_zone: 'UTC', reminder_schedule_changed_at: source.reminder_schedule_changed_at }];
  const result = await runSendReminders(context, f.deps); assert.equal(result.sent,9); assert.equal(new Set(f.sent.map(s => s.payload.tag)).size,3);
  const event = f.sent.find(s => s.payload.body === 'Event')!;
  assert.deepEqual(event.payload, { title: '共享日历', body: 'Event', url: '/', tag: await createReminderTag(source.id,now) });
});
test('Task 1001st source aborts all sources before claims; 1000 keyset sources do not truncate', async () => {
  for (const count of [1000,1001]) {
    const f=fixture(); const rows = Array.from({length:count}, (_,i) => ({...source,id:String(i).padStart(4,'0'),due_on:'2026-10-07'}));
    f.deps.fetchTaskCandidatePage = async ({afterId,limit}) => rows.filter(r => afterId === null || r.id>afterId).slice(0,limit);
    const result=await runSendReminders(context,f.deps); assert.equal(result.candidate_truncated,count>1000); assert.equal(f.claims.size,0); assert.equal(f.sent.length,0);
  }
});
