import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import {
  createReminderTag, runSendReminders, selectDeliveryTasks, type RunSendRemindersDependencies,
  type ReminderCandidate, type ReminderSubscription, type CandidatePageRequest, type DeliveryTask,
} from '../supabase/functions/send-reminders/logic.ts';
import type { RecurringReminderSource } from '../supabase/functions/send-reminders/recurring.ts';
import type { ImportantDateReminderSource } from '../supabase/functions/send-reminders/important-dates.ts';
import { assertImportantDateReminderSendable } from '../supabase/functions/send-reminders/important-date-claim.ts';
import type { WebPushDeliveryResult } from '../supabase/functions/_shared/web-push.ts';

const now = new Date('2026-10-02T08:05:00Z');
const space = '20000000-0000-4000-8000-000000000001';
const marker = '2026-10-01T12:34:56.123456+00:00';
const uuid = (n: number) => `93000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const context = () => ({ runNow: now, startedAt: 0, monotonicNow: () => 0 });
function pages<T extends { id: string }>(rows: T[]) {
  return async ({ afterId, limit }: CandidatePageRequest) => rows.filter(row => afterId === null || row.id > afterId).slice(0, limit);
}
function event(n = 1): ReminderCandidate {
  return { id: uuid(n), space_id: space, scope: 'shared', owner_user_id: null, title: `Event ${n}`,
    starts_at: '2026-10-02T08:04:00Z', all_day: false, reminder_kind: 'timed_at_start', time_zone: 'UTC',
    reminder_schedule_changed_at: marker };
}
function recurring(n = 2): RecurringReminderSource {
  return { ...event(n), title: `Recurring ${n}`, starts_at: '2026-10-01T08:02:00Z', ends_at: null,
    created_by: 'member', description: null, recurrence_rule: { version: 1, frequency: 'daily', interval: 1, time_zone: 'UTC' },
    series_id: uuid(n), parent_event_id: null, recurrence_until: null, created_at: marker, updated_at: marker };
}
function important(n = 3): ImportantDateReminderSource {
  return { id: uuid(n), space_id: space, name: `Important ${n}`, repeat_kind: 'annual', month: 10, day: 2, year: null,
    reminder_kind: 'all_day_same_day_08', time_zone: 'UTC', reminder_schedule_changed_at: marker };
}
function subscription(id = 'subscription', user = 'member'): ReminderSubscription {
  return { id, user_id: user, installation_id: id, endpoint: 'https://fcm.googleapis.com/fixture',
    p256dh: 'fake', auth: 'fake', disabled_at: null, expiration_time: null };
}
function dependencies(overrides: Partial<RunSendRemindersDependencies> = {}): RunSendRemindersDependencies {
  return {
    fetchCandidatePage: pages([event()]), fetchRecurringCandidatePage: pages([recurring()]),
    fetchTaskCandidatePage: async () => [],
    claimTask: async () => { throw new Error('Unexpected Task claim'); },
    checkTask: async () => { throw new Error('Unexpected Task check'); },
    fetchImportantDateCandidatePage: pages([important()]),
    fetchRecurringExceptions: async () => ({ exceptions: [], exceptionsScanned: 0, exceptionTruncated: false }),
    fetchMemberships: async () => [{ space_id: space, user_id: 'member' }],
    fetchSubscriptions: async () => [subscription()],
    claim: async () => uuid(11), claimRecurring: async () => uuid(12), claimImportantDate: async () => uuid(13),
    checkImportantDate: async () => {},
    send: async () => ({ classification: 'delivered', provider: 'fcm.googleapis.com', status: 201 }),
    disableSubscription: async () => true, finalize: async () => 1, ...overrides,
  };
}
function importantOnly(overrides: Partial<RunSendRemindersDependencies> = {}) {
  return dependencies({ fetchCandidatePage: pages([]), fetchRecurringCandidatePage: pages([]), ...overrides });
}

test('mixed sources use exact source contracts, raw marker, pre-send and unchanged Event tags', async () => {
  const sequence: string[] = [];
  const payloads: { body?: string; tag?: string; title: string; url?: string }[] = [];
  const claims: unknown[] = [];
  const finalizations: unknown[] = [];
  const result = await runSendReminders(context(), dependencies({
    claim: async input => { sequence.push('event'); claims.push(input); return uuid(11); },
    claimRecurring: async input => { sequence.push('recurring'); claims.push(input); return uuid(12); },
    claimImportantDate: async input => { sequence.push('important'); claims.push(input); return uuid(13); },
    checkImportantDate: async (id, kind, raw) => {
      assert.equal(id, uuid(13)); assert.equal(kind, 'all_day_same_day_08'); assert.equal(raw, marker);
      sequence.push('check');
    },
    send: async (_sub, payload) => { payloads.push(payload); return { classification: 'delivered', provider: 'fcm.googleapis.com', status: 201 }; },
    finalize: async input => { finalizations.push(input); return 1; },
  }));
  assert.equal(result.candidates_scanned, 3); assert.equal(result.sent, 3);
  assert.deepEqual(sequence.filter(entry => entry !== 'check').sort(), ['event', 'important', 'recurring']);
  assert.equal(sequence.filter(entry => entry === 'check').length, 1);
  assert.deepEqual(claims.find(input => 'importantDateId' in (input as object)), { importantDateId: uuid(3), occurrenceDate: '2026-10-02', recipientUserId: 'member',
    subscriptionId: 'subscription', dueAt: '2026-10-02T08:00:00.000Z', expectedReminderKind: 'all_day_same_day_08',
    expectedReminderScheduleChangedAt: marker });
  assert.ok(claims.every(input => (input as { expectedReminderScheduleChangedAt: string }).expectedReminderScheduleChangedAt === marker));
  const byBody = new Map(payloads.map(payload => [payload.body, payload]));
  assert.equal(byBody.get('Event 1')?.tag, await createReminderTag(uuid(1), new Date(event().starts_at)));
  assert.equal(byBody.get('Recurring 2')?.tag, await createReminderTag(uuid(2), new Date('2026-10-02T08:02:00Z'), '2026-10-02'));
  assert.equal(byBody.get('Important 3')?.tag, await createReminderTag(`important-date:${uuid(3)}`, new Date('2026-10-02T08:00:00Z'), '2026-10-02'));
  assert.ok(payloads.every(payload => payload.title === '共享日历' && payload.url === '/'));
  assert.ok(finalizations.every(input => (input as { status: string }).status === 'sent'));
});

test('Important Date tag is separate from recurring Event with identical source UUID/date/due', async () => {
  const tags: string[] = [];
  await runSendReminders(context(), dependencies({ fetchCandidatePage: pages([]),
    fetchRecurringCandidatePage: pages([{ ...recurring(3), starts_at: '2026-10-01T08:00:00Z' }]),
    send: async (_sub, payload) => { tags.push(payload.tag!); return { classification: 'delivered', provider: 'fcm.googleapis.com', status: 201 }; },
  }));
  assert.equal(tags.length, 2); assert.equal(new Set(tags).size, 2);
});

test('Important Dates resolve current members and share active-subscription filtering/deduplication', async () => {
  const claimed: string[] = [];
  const result = await runSendReminders(context(), importantOnly({
    fetchMemberships: async () => [{ space_id: space, user_id: 'member' }, { space_id: space, user_id: 'other' },
      { space_id: space, user_id: 'member' }],
    fetchSubscriptions: async () => [subscription(), subscription(), subscription('other-device', 'other'),
      subscription('former', 'former'), { ...subscription('disabled'), disabled_at: marker },
      { ...subscription('expired'), expiration_time: now.toISOString() },
      { ...subscription('invalid'), expiration_time: 'invalid' }],
    claimImportantDate: async input => { claimed.push(input.recipientUserId); return uuid(13); },
  }));
  assert.deepEqual(claimed.sort(), ['member', 'other']); assert.equal(result.active_subscriptions, 2); assert.equal(result.sent, 2);
  const none = await runSendReminders(context(), importantOnly({ fetchMemberships: async () => [] }));
  assert.equal(none.claimed, 0);
});

test('Important Date newly-past and invalid markers are classified without rebuilding raw timestamp precision', async () => {
  for (const raw of ['2026-10-02T08:00:00.000001Z', 'invalid']) {
    const result = await runSendReminders(context(), importantOnly({
      fetchImportantDateCandidatePage: pages([{ ...important(), reminder_schedule_changed_at: raw }]),
    }));
    assert.equal(result.claimed, 0);
    assert.equal(raw === 'invalid' ? result.invalid_skipped : result.newly_past_skipped, 1);
  }
});

test('any source overflow aborts mixed work before recipients, claims or sends', async () => {
  for (const source of ['event', 'recurring', 'important'] as const) {
    let sideEffects = 0;
    const rows = Array.from({ length: 1001 }, (_, i) => source === 'event' ? event(i + 1) : source === 'recurring' ? recurring(i + 1) : important(i + 1));
    const fetchPage = pages(rows);
    const result = await runSendReminders(context(), dependencies({
      ...(source === 'event' ? { fetchCandidatePage: fetchPage } : source === 'recurring'
        ? { fetchRecurringCandidatePage: fetchPage } : { fetchImportantDateCandidatePage: fetchPage }),
      fetchMemberships: async () => { sideEffects += 1; return []; },
      claim: async () => { sideEffects += 1; return null; }, claimRecurring: async () => { sideEffects += 1; return null; },
      claimImportantDate: async () => { sideEffects += 1; return null; },
    } as Partial<RunSendRemindersDependencies>));
    assert.equal(result.status, 'candidate_limit_exceeded'); assert.equal(result.candidate_truncated, true);
    assert.equal(sideEffects, 0); assert.equal(result.claimed, 0);
  }
});

test('incomplete or duplicate pagination in any source aborts the whole mixed run', async () => {
  for (const field of ['fetchCandidatePage', 'fetchRecurringCandidatePage', 'fetchImportantDateCandidatePage']) {
    const rows = Array.from({ length: 100 }, (_, i) => important(i + 1));
    for (const fetch of [async () => rows, async () => [rows[0], rows[0]], async () => rows.toReversed(),
      async () => [null], async () => [{ id: undefined }], async () => null,
      async () => { throw new Error('Incomplete scan'); }]) {
      let claims = 0;
      await assert.rejects(runSendReminders(context(), dependencies({ [field]: fetch,
        claim: async () => { claims += 1; return null; }, claimRecurring: async () => { claims += 1; return null; },
        claimImportantDate: async () => { claims += 1; return null; },
      })));
      assert.equal(claims, 0);
    }
  }
});

test('recurring exception overflow blocks all three sources before membership/claim work', async () => {
  let downstream = 0;
  const result = await runSendReminders(context(), dependencies({
    fetchRecurringExceptions: async () => ({ exceptions: [], exceptionsScanned: 1001, exceptionTruncated: true }),
    fetchMemberships: async () => { downstream += 1; return []; },
    claim: async () => { downstream += 1; return null; }, claimRecurring: async () => { downstream += 1; return null; },
    claimImportantDate: async () => { downstream += 1; return null; },
  }));
  assert.equal(result.status, 'candidate_limit_exceeded'); assert.equal(downstream, 0);
});

test('duplicate scans/concurrent runs share durable identities and only winning Important Date claim sends', async () => {
  // Shared atomic ledger stub: the actual unique-constraint concurrency boundary is verified by T2B SQL tests.
  const ledger = new Set<string>(); let sends = 0; let checks = 0;
  const deps = importantOnly({ claimImportantDate: async input => {
    const identity = [input.importantDateId, input.occurrenceDate, input.subscriptionId, input.dueAt].join('|');
    if (ledger.has(identity)) return null;
    ledger.add(identity); return uuid(13);
  }, checkImportantDate: async () => { checks += 1; },
  send: async () => { sends += 1; return { classification: 'delivered', provider: 'fcm.googleapis.com', status: 201 }; } });
  const runs = await Promise.all([runSendReminders(context(), deps), runSendReminders(context(), deps)]);
  assert.equal(runs.reduce((sum, result) => sum + result.claimed, 0), 1);
  assert.equal(runs.reduce((sum, result) => sum + result.claim_rejected, 0), 1);
  assert.equal((await runSendReminders(context(), deps)).claim_rejected, 1);
  assert.equal(sends, 1); assert.equal(checks, 1); assert.equal(ledger.size, 1);
});

test('claim rejection/exception does not check, send or finalize Important Dates', async () => {
  for (const throws of [false, true]) {
    let sideEffects = 0;
    const result = await runSendReminders(context(), importantOnly({ claimImportantDate: async () => {
      if (throws) throw new Error('claim unavailable'); return null;
    }, checkImportantDate: async () => { sideEffects += 1; }, finalize: async () => { sideEffects += 1; return 1; },
    send: async () => { sideEffects += 1; return { classification: 'network_error', provider: 'fcm.googleapis.com' }; } }));
    assert.equal(sideEffects, 0); assert.equal(throws ? result.unexpected_task_errors : result.claim_rejected, 1);
  }
});

test('claim-to-pre-send invalidation or check exception prevents provider and finalizes failed without retry', async () => {
  for (const throws of [false, true]) {
    let valid = true; let sends = 0; const finalizations: unknown[] = [];
    const result = await runSendReminders(context(), importantOnly({ claimImportantDate: async () => { valid = false; return uuid(13); },
      checkImportantDate: (id, kind, raw) => assertImportantDateReminderSendable(async () => {
        if (throws) throw new Error('private transport'); return { data: valid, error: null };
      }, id, kind, raw),
      send: async () => { sends += 1; return { classification: 'network_error', provider: 'fcm.googleapis.com' }; },
      finalize: async input => { finalizations.push(input); return 1; },
    }));
    assert.equal(sends, 0); assert.equal(result.failed, 1); assert.equal(result.unexpected_task_errors, 1);
    assert.deepEqual(finalizations, [{ deliveryId: uuid(13), status: 'failed', resultCode: 'unexpected_task_error', providerStatus: null }]);
  }
});

test('mixed sources share one 50-task budget and five workers, ordered by due across all sources', async () => {
  let active = 0; let maximum = 0; const claims: string[] = [];
  let release!: () => void;
  const firstWave = new Promise<void>(resolve => { release = resolve; });
  const result = await runSendReminders(context(), dependencies({
    fetchCandidatePage: pages(Array.from({ length: 30 }, (_, i) => event(i + 1))),
    fetchRecurringCandidatePage: pages(Array.from({ length: 30 }, (_, i) => recurring(i + 101))),
    fetchImportantDateCandidatePage: pages(Array.from({ length: 30 }, (_, i) => important(i + 201))),
    claim: async () => { claims.push('event'); return uuid(11); },
    claimRecurring: async () => { claims.push('recurring'); return uuid(12); },
    claimImportantDate: async () => { claims.push('important'); return uuid(13); },
    send: async () => { active += 1; maximum = Math.max(maximum, active); if (active === 5) release(); await firstWave;
      active -= 1; return { classification: 'delivered', provider: 'fcm.googleapis.com', status: 201 }; },
  }));
  assert.equal(result.delivery_tasks, 90); assert.equal(result.selected_delivery_tasks, 50); assert.equal(result.overflow_delivery_tasks, 40);
  assert.deepEqual(claims.sort(), [...Array(30).fill('important'), ...Array(20).fill('recurring')]); assert.equal(maximum, 5);
});

test('mixed sources share cutoff; already-claimed Important Date still checks, sends and finalizes after cutoff', async () => {
  const stopped = await runSendReminders({ ...context(), monotonicNow: () => 95_000 }, dependencies());
  assert.equal(stopped.claimed, 0); assert.equal(stopped.runtime_deferred, 3);
  let elapsed = 94_000; let checks = 0; let finalized = 0;
  const result = await runSendReminders({ ...context(), monotonicNow: () => elapsed }, importantOnly({
    fetchImportantDateCandidatePage: pages([important(3), important(4), important(5)]),
    claimImportantDate: async () => { elapsed = 96_000; return uuid(13); },
    checkImportantDate: async () => { checks += 1; }, finalize: async () => { finalized += 1; return 1; },
  }));
  assert.equal(result.claimed, 1); assert.equal(result.sent, 1); assert.equal(checks, 1); assert.equal(finalized, 1);
  assert.equal(result.runtime_deferred, 2); assert.equal(result.runtime_stop_reason, 'claim_acquisition_cutoff');
});

test('Important Date provider outcomes retain sender/finalize codes and 404/410 retirement semantics', async () => {
  const outcomes: [WebPushDeliveryResult, string, number | null][] = [
    [{ classification: 'delivered', provider: 'fcm.googleapis.com', status: 201 }, 'delivered', 201],
    [{ classification: 'provider_rejected', provider: 'fcm.googleapis.com', status: 503 }, 'provider_rejected', 503],
    [{ classification: 'network_error', provider: 'fcm.googleapis.com' }, 'network_error', null],
    [{ classification: 'network_timeout', provider: 'fcm.googleapis.com' }, 'network_timeout', null],
    [{ classification: 'invalid_sender_result', provider: null }, 'invalid_sender_result', null],
    [{ classification: 'subscription_gone', provider: 'fcm.googleapis.com', status: 404 }, 'subscription_gone', 404],
    [{ classification: 'subscription_gone', provider: 'fcm.googleapis.com', status: 410 }, 'subscription_gone', 410],
  ];
  for (const [outcome, code, status] of outcomes) {
    let checked = false; let retirementCalls = 0; const finalizations: unknown[] = [];
    const result = await runSendReminders(context(), importantOnly({ checkImportantDate: async () => { checked = true; },
      send: async () => { assert.equal(checked, true); return outcome; },
      disableSubscription: async id => { assert.equal(id, 'subscription'); retirementCalls += 1; return true; },
      finalize: async input => { finalizations.push(input); return 1; },
    }));
    assert.deepEqual(finalizations, [{ deliveryId: uuid(13), status: code === 'delivered' ? 'sent' : 'failed', resultCode: code, providerStatus: status }]);
    assert.equal(retirementCalls, code === 'subscription_gone' ? 1 : 0);
    assert.equal(result.gone_disabled, retirementCalls);
  }
  for (const throws of [false, true]) {
    const result = await runSendReminders(context(), importantOnly({
      send: async () => ({ classification: 'subscription_gone', provider: 'fcm.googleapis.com', status: 410 }),
      disableSubscription: async () => { if (throws) throw new Error('retire failure'); return false; },
    }));
    assert.equal(result.failed, 1); assert.equal(result.disable_failures, 1); assert.equal(result.finalize_failures, 0);
  }
});

test('Important Date finalize zero/multiple/exception and sender throw do not retry a claimed identity', async () => {
  for (const outcome of ['zero', 'multiple', 'exception', 'sender-throw']) {
    let claimed = false; let sends = 0;
    const deps = importantOnly({ claimImportantDate: async () => { if (claimed) return null; claimed = true; return uuid(13); },
      send: async () => { sends += 1; if (outcome === 'sender-throw') throw new Error('private provider');
        return { classification: 'delivered', provider: 'fcm.googleapis.com', status: 201 }; },
      finalize: async input => {
        if (outcome === 'sender-throw') { assert.equal(input.status, 'failed'); assert.equal(input.resultCode, 'unexpected_task_error'); return 1; }
        if (outcome === 'exception') throw new Error('finalize failure'); return outcome === 'zero' ? 0 : 2;
      },
    });
    const first = await runSendReminders(context(), deps);
    assert.equal(outcome === 'sender-throw' ? first.failed : first.finalize_failures, 1);
    assert.equal((await runSendReminders(context(), deps)).claim_rejected, 1); assert.equal(sends, 1);
  }
});

test('Important Date cutoff is rechecked after asynchronous tag creation, immediately before claim', async () => {
  const ticks = [94_000, 95_000]; let claims = 0;
  const result = await runSendReminders({ ...context(), monotonicNow: () => ticks.shift() ?? 95_000 },
    importantOnly({ claimImportantDate: async () => { claims += 1; return null; } }));
  assert.equal(claims, 0); assert.equal(result.runtime_deferred, 1);
});

test('invalid Important Date projection aborts Event delivery before claims', async () => {
  let claims = 0;
  await assert.rejects(runSendReminders(context(), dependencies({ fetchImportantDateCandidatePage: pages([{ ...important(), time_zone: 'invalid' }]),
    claim: async () => { claims += 1; return null; },
  })), /Important Date.*projection failed/);
  assert.equal(claims, 0);
});

test('mixed selection keeps chronological/source/occurrence/member/subscription ties deterministic', () => {
  const common = { recipientUserId: 'member', subscription: subscription(), dueAt: new Date('2026-10-02T08:00:00Z'),
    rawReminderScheduleChangedAt: marker };
  const ordinary: DeliveryTask = { ...common, eventId: uuid(3), eventTitle: 'Event', recurrence: null };
  const date: DeliveryTask = { ...common, importantDate: { id: uuid(3), name: 'Date', occurrenceDate: '2026-10-02', reminderKind: 'all_day_same_day_08' } };
  const earlier: DeliveryTask = { ...ordinary, eventId: uuid(99), dueAt: new Date('2026-10-02T07:59:00Z') };
  const laterOccurrence: DeliveryTask = { ...date, importantDate: { ...date.importantDate, occurrenceDate: '2026-10-03' } };
  const otherMember: DeliveryTask = { ...date, recipientUserId: 'other', subscription: subscription('other', 'other') };
  const otherDevice: DeliveryTask = { ...date, subscription: subscription('zz-device') };
  const unordered = [otherMember, date, ordinary, laterOccurrence, otherDevice, earlier];
  const expected = [earlier, ordinary, date, otherDevice, otherMember, laterOccurrence];
  assert.deepEqual(selectDeliveryTasks(unordered).selected, expected);
  assert.deepEqual(selectDeliveryTasks(unordered.toReversed()).selected, expected);
});

test('Important Date previous-day/year/grace/fallback/future-anchor occurrences reach the actual claim branch', async () => {
  const cases = [
    { at: '2026-12-31T20:05:00Z', fields: { month: 1, day: 1, year: 2027 }, kind: 'all_day_previous_day_20' as const, date: '2027-01-01', due: '2026-12-31T20:00:00.000Z' },
    { at: '2027-02-28T08:10:00Z', fields: { month: 2, day: 29, year: null }, kind: 'all_day_same_day_08' as const, date: '2027-02-28', due: '2027-02-28T08:00:00.000Z' },
    { at: '2027-02-28T08:10:00.001Z', fields: { month: 2, day: 29, year: null }, kind: 'all_day_same_day_08' as const, date: null, due: null },
    { at: '2026-12-31T20:05:00Z', fields: { month: 1, day: 1, year: 2028 }, kind: 'all_day_previous_day_20' as const, date: null, due: null },
  ];
  for (const item of cases) {
    const claims: { occurrenceDate: string; dueAt: string }[] = [];
    const result = await runSendReminders({ ...context(), runNow: new Date(item.at) }, importantOnly({
      fetchImportantDateCandidatePage: pages([{ ...important(), ...item.fields, reminder_kind: item.kind }]),
      claimImportantDate: async input => { claims.push(input); return uuid(13); },
    }));
    assert.equal(result.claimed, item.date === null ? 0 : 1);
    if (item.date !== null) assert.deepEqual(claims.map(input => [input.occurrenceDate, input.dueAt]), [[item.date, item.due]]);
  }
});
