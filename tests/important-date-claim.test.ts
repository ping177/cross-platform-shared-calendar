import assert from 'node:assert/strict';
import test from 'node:test';
import { claimImportantDateReminder, assertImportantDateReminderSendable } from '../supabase/functions/send-reminders/important-date-claim.ts';
import { runSendReminders } from '../supabase/functions/send-reminders/logic.ts';

const id = '93000000-0000-4000-8000-000000000001';
const marker = '2026-10-01T12:34:56.123456+00:00';
const input = { importantDateId: id, occurrenceDate: '2026-10-02', recipientUserId: id, subscriptionId: id,
  dueAt: '2026-10-01T20:00:00.000Z', expectedReminderKind: 'all_day_previous_day_20' as const,
  expectedReminderScheduleChangedAt: marker };

test('Important Date claim delegates exact civil date/preset/raw marker to its own RPC', async () => {
  const result = await claimImportantDateReminder(async (name, args) => {
    assert.equal(name, 'claim_important_date_reminder_delivery');
    assert.deepEqual(args, { p_important_date_id: id, p_occurrence_date: input.occurrenceDate,
      p_recipient_user_id: id, p_subscription_id: id, p_due_at: input.dueAt,
      p_expected_reminder_kind: input.expectedReminderKind, p_expected_reminder_schedule_changed_at: marker });
    return { data: id, error: null };
  }, input);
  assert.equal(result, id);
  assert.equal(await claimImportantDateReminder(async () => ({ data: null, error: null }), input), null);
  for (const data of [true, 12, {}, 'not-a-uuid']) {
    await assert.rejects(claimImportantDateReminder(async () => ({ data, error: null }), input), /claim failed/);
  }
  await assert.rejects(claimImportantDateReminder(async () => ({ data: id, error: {} }), input), /claim failed/);
});

test('pre-send check binds claimed ledger and raw marker; only exact true permits continuation', async () => {
  await assertImportantDateReminderSendable(async (name, args) => {
    assert.equal(name, 'check_important_date_reminder_delivery');
    assert.deepEqual(args, { p_delivery_id: id, p_expected_reminder_kind: input.expectedReminderKind,
      p_expected_reminder_schedule_changed_at: marker });
    return { data: true, error: null };
  }, id, input.expectedReminderKind, marker);
  for (const data of [false, null, undefined, 1, 'true', {}, [true]]) {
    await assert.rejects(assertImportantDateReminderSendable(async () => ({ data, error: null }), id,
      input.expectedReminderKind, marker), /pre-send check failed/);
  }
  await assert.rejects(assertImportantDateReminderSendable(async () => ({ data: true, error: {} }), id,
    input.expectedReminderKind, marker), /pre-send check failed/);
  await assert.rejects(assertImportantDateReminderSendable(async () => { throw new Error('private transport detail'); }, id,
    input.expectedReminderKind, marker), error => error instanceof Error
      && error.message === 'Important Date pre-send check failed.');
});

test('check failure/exception blocks provider and retains existing failed/finalize behavior', async () => {
  // Test injection only: no production orchestrator wiring or Important Date send path.
  for (const throws of [false, true]) {
    const now = new Date('2026-10-01T20:00:00Z');
    let providerCalls = 0;
    const finalizations: unknown[] = [];
    const result = await runSendReminders({ runNow: now, startedAt: 0, monotonicNow: () => 0 }, {
      fetchCandidatePage: async () => [{ id, space_id: id, scope: 'shared', owner_user_id: null,
        title: 'Fixture', starts_at: now.toISOString(), all_day: false, reminder_kind: 'timed_at_start',
        time_zone: 'UTC', reminder_schedule_changed_at: '2026-10-01T12:00:00Z' }],
      fetchRecurringCandidatePage: async () => [],
      fetchTaskCandidatePage: async () => [],
      claimTask: async () => { throw new Error('Unexpected Task claim'); },
      checkTask: async () => { throw new Error('Unexpected Task check'); },
      fetchImportantDateCandidatePage: async () => [],
      claimImportantDate: async () => { throw new Error('Unexpected Important Date claim'); },
      checkImportantDate: async () => { throw new Error('Unexpected Important Date check'); },
      fetchRecurringExceptions: async () => { throw new Error('Unexpected recurring lookup'); },
      fetchMemberships: async () => [{ space_id: id, user_id: id }],
      fetchSubscriptions: async () => [{ id, user_id: id, installation_id: id,
        endpoint: 'https://fcm.googleapis.com/fixture', p256dh: 'fake', auth: 'fake', expiration_time: null, disabled_at: null }],
      claim: async () => id, claimRecurring: async () => { throw new Error('Unexpected recurring claim'); },
      send: async () => {
        await assertImportantDateReminderSendable(async () => {
          if (throws) throw new Error('Unavailable');
          return { data: false, error: null };
        }, id, input.expectedReminderKind, marker);
        providerCalls += 1;
        throw new Error('Provider must not be reached');
      },
      disableSubscription: async () => false,
      finalize: async value => { finalizations.push(value); return 1; },
    });
    assert.equal(providerCalls, 0);
    assert.equal(result.failed, 1);
    assert.equal(result.sent, 0);
    assert.deepEqual(finalizations, [{ deliveryId: id, status: 'failed', resultCode: 'unexpected_task_error', providerStatus: null }]);
  }
});
