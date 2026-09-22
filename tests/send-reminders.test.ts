import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  classifyReminderCandidates,
  createDeliveryTasks,
  createReminderTag,
  handleSendRemindersRequest,
  ledgerResultForSenderResult,
  runSendReminders,
  scanReminderCandidates,
  selectDeliveryTasks,
  type DeliveryTask,
  type ReminderCandidate,
  type ReminderSubscription,
  type RunSendRemindersDependencies,
  type SendRemindersDiagnostics,
} from '../supabase/functions/send-reminders/logic.ts';

const runNow = new Date('2026-09-21T12:00:00.000Z');

function candidate(id: string, overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    id,
    space_id: '20000000-0000-4000-8000-000000000001',
    scope: 'shared',
    owner_user_id: null,
    title: 'Safe event title',
    starts_at: runNow.toISOString(),
    all_day: false,
    reminder_kind: 'timed_at_start',
    time_zone: 'UTC',
    reminder_schedule_changed_at: '2026-09-21T11:00:00.123456+00:00',
    ...overrides,
  };
}

function completedDiagnostics(): SendRemindersDiagnostics {
  return {
    status: 'completed',
    candidates_scanned: 0,
    candidate_truncated: false,
    due_eligible: 0,
    future_skipped: 0,
    newly_past_skipped: 0,
    grace_expired_skipped: 0,
    invalid_skipped: 0,
    recipients: 0,
    active_subscriptions: 0,
    delivery_tasks: 0,
    selected_delivery_tasks: 0,
    overflow_delivery_tasks: 0,
    claim_rejected: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
    gone_disabled: 0,
    disable_failures: 0,
    finalize_failures: 0,
    unexpected_task_errors: 0,
    runtime_deferred: 0,
    runtime_stop_reason: null,
    elapsed_ms: 0,
  };
}

test('rejects missing, malformed, empty, wrong-scheme, and mismatched authorization before invoking work', async () => {
  const authorizationValues = [
    null,
    'malformed',
    'Bearer',
    'Bearer ',
    'Basic synthetic-secret',
    'Bearer wrong-secret',
  ];
  let runCalls = 0;

  for (const authorization of authorizationValues) {
    const headers = authorization === null ? undefined : { Authorization: authorization };
    const response = await handleSendRemindersRequest(
      new Request('http://localhost/send-reminders', { method: 'POST', headers }),
      {
        expectedSecret: 'synthetic-secret',
        run: async () => {
          runCalls += 1;
          return completedDiagnostics();
        },
      },
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { status: 'unauthorized' });
  }

  assert.equal(runCalls, 0);
});

test('accepts the exact synthetic bearer secret and establishes one fixed run context', async () => {
  const fixedNow = new Date('2026-09-21T12:34:56.789Z');
  let nowCalls = 0;
  let observedContext: unknown;

  const response = await handleSendRemindersRequest(
    new Request('http://localhost/send-reminders', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-secret' },
    }),
    {
      expectedSecret: 'synthetic-secret',
      now: () => {
        nowCalls += 1;
        return fixedNow;
      },
      monotonicNow: () => 1234,
      run: async (context) => {
        observedContext = context;
        return completedDiagnostics();
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(nowCalls, 1);
  assert.equal((observedContext as { runNow: Date }).runNow, fixedNow);
  assert.equal((observedContext as { startedAt: number }).startedAt, 1234);
  assert.equal(typeof (observedContext as { monotonicNow: unknown }).monotonicNow, 'function');
});

test('scans fewer than 1000 candidates in stable id pages of 100', async () => {
  const candidates = Array.from({ length: 235 }, (_, index) => candidate(index.toString().padStart(4, '0')));
  const calls: Array<{ afterId: string | null; limit: number }> = [];

  const result = await scanReminderCandidates(async ({ afterId, limit }) => {
    calls.push({ afterId, limit });
    const start = afterId === null ? 0 : candidates.findIndex((entry) => entry.id === afterId) + 1;
    return candidates.slice(start, start + limit);
  });

  assert.equal(result.candidates.length, 235);
  assert.equal(result.candidatesScanned, 235);
  assert.equal(result.candidateTruncated, false);
  assert.deepEqual(calls.map((call) => call.limit), [100, 100, 100]);
  assert.deepEqual(calls.map((call) => call.afterId), [null, '0099', '0199']);
});

test('accepts exactly 1000 candidates only after an empty 1001st-row probe', async () => {
  const candidates = Array.from({ length: 1000 }, (_, index) => candidate(index.toString().padStart(4, '0')));
  const calls: Array<{ afterId: string | null; limit: number }> = [];

  const result = await scanReminderCandidates(async ({ afterId, limit }) => {
    calls.push({ afterId, limit });
    const start = afterId === null ? 0 : candidates.findIndex((entry) => entry.id === afterId) + 1;
    return candidates.slice(start, start + limit);
  });

  assert.equal(result.candidates.length, 1000);
  assert.equal(result.candidatesScanned, 1000);
  assert.equal(result.candidateTruncated, false);
  assert.deepEqual(calls.at(-1), { afterId: '0999', limit: 1 });
});

test('marks a 1001st candidate as truncated without including it for processing', async () => {
  const candidates = Array.from({ length: 1001 }, (_, index) => candidate(index.toString().padStart(4, '0')));

  const result = await scanReminderCandidates(async ({ afterId, limit }) => {
    const start = afterId === null ? 0 : candidates.findIndex((entry) => entry.id === afterId) + 1;
    return candidates.slice(start, start + limit);
  });

  assert.equal(result.candidates.length, 1000);
  assert.equal(result.candidatesScanned, 1001);
  assert.equal(result.candidateTruncated, true);
});

test('rejects a candidate page that is not strictly ordered by id', async () => {
  await assert.rejects(
    () => scanReminderCandidates(async () => [candidate('0002'), candidate('0001')]),
    /strictly ordered/,
  );
});

test('classifies due-now, grace, future, newly-past, expired, and invalid candidates', () => {
  const result = classifyReminderCandidates([
    candidate('due-now'),
    candidate('within-grace', { starts_at: '2026-09-21T11:50:00.000Z' }),
    candidate('future', { starts_at: '2026-09-21T12:00:00.001Z' }),
    candidate('newly-past', {
      starts_at: '2026-09-21T11:59:00.000Z',
      reminder_schedule_changed_at: '2026-09-21T11:59:00.000001+00:00',
    }),
    candidate('expired', { starts_at: '2026-09-21T11:49:59.999Z' }),
    candidate('invalid', { starts_at: 'not-a-date' }),
  ], runNow);

  assert.deepEqual(result.eligible.map((entry) => entry.event.id), ['due-now', 'within-grace']);
  assert.equal(result.futureSkipped, 1);
  assert.equal(result.newlyPastSkipped, 1);
  assert.equal(result.graceExpiredSkipped, 1);
  assert.equal(result.invalidSkipped, 1);
  assert.equal(
    result.eligible[0].rawReminderScheduleChangedAt,
    '2026-09-21T11:00:00.123456+00:00',
  );
});

test('creates stable opaque reminder tags from Event and canonical due instant', async () => {
  const eventId = '10000000-0000-4000-8000-000000000001';
  const dueAt = new Date('2026-09-21T12:00:00.123Z');
  const [first, second, changedEvent, changedDue] = await Promise.all([
    createReminderTag(eventId, dueAt),
    createReminderTag(eventId, dueAt),
    createReminderTag('10000000-0000-4000-8000-000000000002', dueAt),
    createReminderTag(eventId, new Date('2026-09-21T12:00:00.124Z')),
  ]);

  assert.equal(first, second);
  assert.notEqual(first, changedEvent);
  assert.notEqual(first, changedDue);
  assert.match(first, /^reminder-v1-[A-Za-z0-9_-]{43}$/);
  assert.doesNotMatch(first, /10000000|0000-4000/);
});

function subscription(
  id: string,
  userId: string,
  overrides: Partial<ReminderSubscription> = {},
): ReminderSubscription {
  return {
    id,
    user_id: userId,
    installation_id: `installation-${id}`,
    endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
    p256dh: `p256dh-${id}`,
    auth: `auth-${id}`,
    expiration_time: null,
    disabled_at: null,
    ...overrides,
  };
}

test('resolves current personal/shared recipients and only their active installations', () => {
  const eligible = classifyReminderCandidates([
    candidate('personal-current', {
      scope: 'personal',
      owner_user_id: 'user-1',
    }),
    candidate('personal-former', {
      scope: 'personal',
      owner_user_id: 'user-2',
    }),
    candidate('shared-current'),
  ], runNow).eligible;

  const result = createDeliveryTasks(
    eligible,
    [
      { space_id: '20000000-0000-4000-8000-000000000001', user_id: 'user-1' },
      { space_id: '20000000-0000-4000-8000-000000000001', user_id: 'user-3' },
    ],
    [
      subscription('sub-1a', 'user-1'),
      subscription('sub-1b', 'user-1', { expiration_time: '2026-09-21T12:00:00.001Z' }),
      subscription('sub-1-disabled', 'user-1', { disabled_at: '2026-09-21T11:00:00.000Z' }),
      subscription('sub-1-expired', 'user-1', { expiration_time: '2026-09-21T12:00:00.000Z' }),
      subscription('sub-2', 'user-2'),
      subscription('sub-3', 'user-3'),
    ],
    runNow,
  );

  assert.equal(result.recipients, 3);
  assert.equal(result.activeSubscriptions, 3);
  assert.deepEqual(
    result.tasks.map((task) => [task.eventId, task.recipientUserId, task.subscription.id]),
    [
      ['personal-current', 'user-1', 'sub-1a'],
      ['personal-current', 'user-1', 'sub-1b'],
      ['shared-current', 'user-1', 'sub-1a'],
      ['shared-current', 'user-1', 'sub-1b'],
      ['shared-current', 'user-3', 'sub-3'],
    ],
  );
});

test('creates no delivery tasks when resolved recipients have no active subscriptions', () => {
  const eligible = classifyReminderCandidates([candidate('shared-current')], runNow).eligible;
  const result = createDeliveryTasks(
    eligible,
    [{ space_id: '20000000-0000-4000-8000-000000000001', user_id: 'user-1' }],
    [subscription('disabled', 'user-1', { disabled_at: runNow.toISOString() })],
    runNow,
  );

  assert.equal(result.recipients, 1);
  assert.equal(result.activeSubscriptions, 0);
  assert.deepEqual(result.tasks, []);
});

function task(
  eventId: string,
  recipientUserId: string,
  subscriptionId: string,
  dueAt: string,
): DeliveryTask {
  return {
    eventId,
    eventTitle: 'Safe title',
    recipientUserId,
    subscription: subscription(subscriptionId, recipientUserId),
    dueAt: new Date(dueAt),
    rawReminderScheduleChangedAt: '2026-09-21T11:00:00.123456+00:00',
    recurrence: null,
  };
}

test('selects at most 50 tasks after deterministic due/event/recipient/subscription ordering', () => {
  const tasks = Array.from({ length: 51 }, (_, index) => task(
    `event-${index.toString().padStart(2, '0')}`,
    'user-1',
    `subscription-${index.toString().padStart(2, '0')}`,
    '2026-09-21T12:00:00.000Z',
  ));
  tasks.push(
    task('event-aa', 'user-b', 'subscription-b', '2026-09-21T11:59:59.999Z'),
    task('event-aa', 'user-a', 'subscription-b', '2026-09-21T11:59:59.999Z'),
    task('event-aa', 'user-a', 'subscription-a', '2026-09-21T11:59:59.999Z'),
  );
  tasks.reverse();

  const result = selectDeliveryTasks(tasks);

  assert.equal(result.selected.length, 50);
  assert.equal(result.overflow, 4);
  assert.deepEqual(
    result.selected.slice(0, 3).map((entry) => [
      entry.eventId,
      entry.recipientUserId,
      entry.subscription.id,
    ]),
    [
      ['event-aa', 'user-a', 'subscription-a'],
      ['event-aa', 'user-a', 'subscription-b'],
      ['event-aa', 'user-b', 'subscription-b'],
    ],
  );
});

test('maps all shared sender results to the frozen ledger result shapes', () => {
  assert.deepEqual(ledgerResultForSenderResult({
    classification: 'delivered', provider: 'fcm.googleapis.com', status: 201,
  }), { status: 'sent', resultCode: 'delivered', providerStatus: 201 });
  assert.deepEqual(ledgerResultForSenderResult({
    classification: 'subscription_gone', provider: 'fcm.googleapis.com', status: 410,
  }), { status: 'failed', resultCode: 'subscription_gone', providerStatus: 410 });
  assert.deepEqual(ledgerResultForSenderResult({
    classification: 'provider_rejected', provider: 'fcm.googleapis.com', status: 503,
  }), { status: 'failed', resultCode: 'provider_rejected', providerStatus: 503 });
  assert.deepEqual(ledgerResultForSenderResult({
    classification: 'network_timeout', provider: 'fcm.googleapis.com',
  }), { status: 'failed', resultCode: 'network_timeout', providerStatus: null });
  assert.deepEqual(ledgerResultForSenderResult({
    classification: 'network_error', provider: 'fcm.googleapis.com',
  }), { status: 'failed', resultCode: 'network_error', providerStatus: null });
  assert.deepEqual(ledgerResultForSenderResult({
    classification: 'invalid_sender_result', provider: 'fcm.googleapis.com', status: 500,
  }), { status: 'failed', resultCode: 'invalid_sender_result', providerStatus: 500 });
});

function pageFetcher(candidates: ReminderCandidate[]) {
  return async ({ afterId, limit }: { afterId: string | null; limit: number }) => {
    const start = afterId === null ? 0 : candidates.findIndex((entry) => entry.id === afterId) + 1;
    return candidates.slice(start, start + limit);
  };
}

function orchestrationDependencies(
  overrides: Partial<RunSendRemindersDependencies> = {},
): RunSendRemindersDependencies {
  return {
    fetchCandidatePage: pageFetcher([candidate('event-0001')]),
    fetchRecurringCandidatePage: async () => [],
    fetchRecurringExceptions: async () => ({
      exceptions: [],
      exceptionsScanned: 0,
      exceptionTruncated: false,
    }),
    fetchMemberships: async () => [{
      space_id: '20000000-0000-4000-8000-000000000001',
      user_id: 'user-1',
    }],
    fetchSubscriptions: async () => [subscription('subscription-1', 'user-1')],
    claim: async () => '30000000-0000-4000-8000-000000000001',
    claimRecurring: async () => '30000000-0000-4000-8000-000000000002',
    send: async () => ({
      classification: 'delivered',
      provider: 'fcm.googleapis.com',
      status: 201,
    }),
    disableSubscription: async () => true,
    finalize: async () => 1,
    ...overrides,
  };
}

test('aborts a 1001-candidate scan before membership, claim, or Push work', async () => {
  const candidates = Array.from({ length: 1001 }, (_, index) => (
    candidate(`event-${index.toString().padStart(4, '0')}`)
  ));
  let membershipCalls = 0;
  let claimCalls = 0;
  let sendCalls = 0;

  const result = await runSendReminders(
    { runNow, startedAt: 0, monotonicNow: () => 1 },
    orchestrationDependencies({
      fetchCandidatePage: pageFetcher(candidates),
      fetchMemberships: async () => {
        membershipCalls += 1;
        return [];
      },
      claim: async () => {
        claimCalls += 1;
        return null;
      },
      send: async () => {
        sendCalls += 1;
        return { classification: 'network_error', provider: 'fcm.googleapis.com' };
      },
    }),
  );

  assert.equal(result.status, 'candidate_limit_exceeded');
  assert.equal(result.candidates_scanned, 1001);
  assert.equal(result.candidate_truncated, true);
  assert.equal(membershipCalls, 0);
  assert.equal(claimCalls, 0);
  assert.equal(sendCalls, 0);
  assert.equal(result.claimed, 0);
  assert.equal(result.sent, 0);
});

test('claims, sends the exact payload, and finalizes with the raw marker unchanged', async () => {
  const claimInputs: unknown[] = [];
  const payloads: unknown[] = [];
  const finalizations: unknown[] = [];

  const result = await runSendReminders(
    { runNow, startedAt: 0, monotonicNow: () => 10 },
    orchestrationDependencies({
      claim: async (input) => {
        claimInputs.push(input);
        return '30000000-0000-4000-8000-000000000001';
      },
      send: async (_subscription, payload) => {
        payloads.push(payload);
        return { classification: 'delivered', provider: 'fcm.googleapis.com', status: 201 };
      },
      finalize: async (input) => {
        finalizations.push(input);
        return 1;
      },
    }),
  );

  assert.equal(result.claimed, 1);
  assert.equal(result.sent, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(claimInputs, [{
    eventId: 'event-0001',
    recipientUserId: 'user-1',
    subscriptionId: 'subscription-1',
    dueAt: '2026-09-21T12:00:00.000Z',
    expectedReminderScheduleChangedAt: '2026-09-21T11:00:00.123456+00:00',
  }]);
  assert.deepEqual({
    title: (payloads[0] as { title: string }).title,
    body: (payloads[0] as { body: string }).body,
    url: (payloads[0] as { url: string }).url,
  }, {
    title: '共享日历',
    body: 'Safe event title',
    url: '/',
  });
  assert.match((payloads[0] as { tag: string }).tag, /^reminder-v1-[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(finalizations, [{
    deliveryId: '30000000-0000-4000-8000-000000000001',
    status: 'sent',
    resultCode: 'delivered',
    providerStatus: 201,
  }]);
});

test('does not send or finalize when C1 rejects the claim', async () => {
  let sendCalls = 0;
  let finalizeCalls = 0;
  const result = await runSendReminders(
    { runNow, startedAt: 0, monotonicNow: () => 1 },
    orchestrationDependencies({
      claim: async () => null,
      send: async () => {
        sendCalls += 1;
        return { classification: 'network_error', provider: 'fcm.googleapis.com' };
      },
      finalize: async () => {
        finalizeCalls += 1;
        return 1;
      },
    }),
  );

  assert.equal(result.claim_rejected, 1);
  assert.equal(result.claimed, 0);
  assert.equal(sendCalls, 0);
  assert.equal(finalizeCalls, 0);
});

test('finalizes gone subscriptions even when one disable attempt fails', async () => {
  const finalizations: unknown[] = [];
  const result = await runSendReminders(
    { runNow, startedAt: 0, monotonicNow: () => 1 },
    orchestrationDependencies({
      fetchSubscriptions: async () => [
        subscription('subscription-a', 'user-1'),
        subscription('subscription-b', 'user-1'),
      ],
      claim: async (input) => `claim-${input.subscriptionId}`,
      send: async () => ({
        classification: 'subscription_gone',
        provider: 'fcm.googleapis.com',
        status: 410,
      }),
      disableSubscription: async (subscriptionId) => subscriptionId === 'subscription-a',
      finalize: async (input) => {
        finalizations.push(input);
        return 1;
      },
    }),
  );

  assert.equal(result.failed, 2);
  assert.equal(result.gone_disabled, 1);
  assert.equal(result.disable_failures, 1);
  assert.equal(finalizations.length, 2);
  assert.ok(finalizations.every((entry) => (
    (entry as { resultCode: string }).resultCode === 'subscription_gone'
  )));
});

test('counts zero, multiple, and thrown finalize outcomes without resending', async () => {
  let finalizeIndex = 0;
  let sendCalls = 0;
  const result = await runSendReminders(
    { runNow, startedAt: 0, monotonicNow: () => 1 },
    orchestrationDependencies({
      fetchSubscriptions: async () => [
        subscription('subscription-a', 'user-1'),
        subscription('subscription-b', 'user-1'),
        subscription('subscription-c', 'user-1'),
      ],
      claim: async (input) => `claim-${input.subscriptionId}`,
      send: async () => {
        sendCalls += 1;
        return { classification: 'delivered', provider: 'fcm.googleapis.com', status: 201 };
      },
      finalize: async () => {
        const outcome = finalizeIndex;
        finalizeIndex += 1;
        if (outcome === 0) return 0;
        if (outcome === 1) return 2;
        throw new Error('safe synthetic finalize failure');
      },
    }),
  );

  assert.equal(sendCalls, 3);
  assert.equal(result.sent, 3);
  assert.equal(result.finalize_failures, 3);
});

test('constrains active delivery work to five and leaves task overflow unclaimed', async () => {
  const subscriptions = Array.from({ length: 55 }, (_, index) => (
    subscription(`subscription-${index.toString().padStart(2, '0')}`, 'user-1')
  ));
  let activeSends = 0;
  let maximumActiveSends = 0;
  let claimCalls = 0;

  const result = await runSendReminders(
    { runNow, startedAt: 0, monotonicNow: () => 1 },
    orchestrationDependencies({
      fetchSubscriptions: async () => subscriptions,
      claim: async () => {
        claimCalls += 1;
        return `claim-${claimCalls}`;
      },
      send: async () => {
        activeSends += 1;
        maximumActiveSends = Math.max(maximumActiveSends, activeSends);
        await new Promise((resolve) => setImmediate(resolve));
        activeSends -= 1;
        return { classification: 'delivered', provider: 'fcm.googleapis.com', status: 201 };
      },
    }),
  );

  assert.equal(result.delivery_tasks, 55);
  assert.equal(result.selected_delivery_tasks, 50);
  assert.equal(result.overflow_delivery_tasks, 5);
  assert.equal(claimCalls, 50);
  assert.equal(maximumActiveSends, 5);
});

test('does not acquire claims at the runtime cutoff', async () => {
  let claimCalls = 0;
  const result = await runSendReminders(
    { runNow, startedAt: 0, monotonicNow: () => 95_000 },
    orchestrationDependencies({
      claim: async () => {
        claimCalls += 1;
        return null;
      },
    }),
  );

  assert.equal(claimCalls, 0);
  assert.equal(result.runtime_deferred, 1);
  assert.equal(result.runtime_stop_reason, 'claim_acquisition_cutoff');
});

test('rechecks the cutoff immediately before claim acquisition', async () => {
  const elapsedValues = [94_000, 95_000, 95_000];
  let claimCalls = 0;
  const result = await runSendReminders(
    {
      runNow,
      startedAt: 0,
      monotonicNow: () => elapsedValues.shift() ?? 95_000,
    },
    orchestrationDependencies({
      claim: async () => {
        claimCalls += 1;
        return null;
      },
    }),
  );

  assert.equal(claimCalls, 0);
  assert.equal(result.runtime_deferred, 1);
  assert.equal(result.runtime_stop_reason, 'claim_acquisition_cutoff');
});

test('continues send and finalize after an acquired claim crosses the cutoff', async () => {
  let elapsed = 94_000;
  let sendCalls = 0;
  let finalizeCalls = 0;
  const result = await runSendReminders(
    { runNow, startedAt: 0, monotonicNow: () => elapsed },
    orchestrationDependencies({
      claim: async () => {
        elapsed = 96_000;
        return '30000000-0000-4000-8000-000000000001';
      },
      send: async () => {
        sendCalls += 1;
        return { classification: 'delivered', provider: 'fcm.googleapis.com', status: 201 };
      },
      finalize: async () => {
        finalizeCalls += 1;
        return 1;
      },
    }),
  );

  assert.equal(sendCalls, 1);
  assert.equal(finalizeCalls, 1);
  assert.equal(result.sent, 1);
});

test('converts an unexpected sender throw into failed ledger state without exposing task data', async () => {
  const finalizations: unknown[] = [];
  const result = await runSendReminders(
    { runNow, startedAt: 0, monotonicNow: () => 1 },
    orchestrationDependencies({
      send: async () => {
        throw new Error('private endpoint and Event data');
      },
      finalize: async (input) => {
        finalizations.push(input);
        return 1;
      },
    }),
  );

  assert.equal(result.failed, 1);
  assert.equal(result.unexpected_task_errors, 1);
  assert.deepEqual(finalizations, [{
    deliveryId: '30000000-0000-4000-8000-000000000001',
    status: 'failed',
    resultCode: 'unexpected_task_error',
    providerStatus: null,
  }]);
  assert.doesNotMatch(JSON.stringify(result), /Safe event title|event-0001|subscription-1|private endpoint/);
});

test('keeps the Edge entry thin and wires the frozen query, C1, sender, and finalize contracts', async () => {
  const source = await readFile(
    new URL('../supabase/functions/send-reminders/index.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /REMINDER_CRON_SECRET/);
  assert.match(source, /handleSendRemindersRequest/);
  assert.match(source, /runSendReminders/);
  assert.match(source, /\.is\('recurrence_rule', null\)/);
  assert.match(source, /fetchRecurringCandidatePage/);
  assert.match(source, /\.not\('recurrence_rule', 'is', null\)/);
  assert.match(source, /event_occurrence_exceptions/);
  assert.match(source, /afterExceptionId/);
  assert.match(source, /query = query[.]gt\('id', afterExceptionId\)/);
  assert.match(source, /\.not\('reminder_kind', 'is', null\)/);
  assert.match(source, /\.not\('time_zone', 'is', null\)/);
  assert.match(source, /\.order\('id', \{ ascending: true \}\)/);
  assert.match(source, /\.limit\(limit\)/);
  assert.match(source, /\.gt\('id', afterId\)/);
  assert.match(source, /\.rpc\('claim_reminder_delivery'/);
  assert.match(source, /\.rpc\('claim_recurring_reminder_delivery'/);
  assert.match(source, /p_expected_reminder_schedule_changed_at: input\.expectedReminderScheduleChangedAt/);
  assert.match(source, /sendWebPush/);
  assert.match(source, /\.eq\('id', input\.deliveryId\)[\s\S]*\.eq\('status', 'claimed'\)[\s\S]*\.select\('id'\)/);
  assert.doesNotMatch(source, /insert\([^)]*reminder_deliveries|from\('reminder_deliveries'\)\s*\.insert/);
});

test('uses only the existing function-scoped pinned dependencies', async () => {
  const denoConfig = JSON.parse(await readFile(
    new URL('../supabase/functions/send-reminders/deno.json', import.meta.url),
    'utf8',
  )) as { imports: Record<string, string> };
  const packageJson = await readFile(new URL('../package.json', import.meta.url), 'utf8');

  assert.deepEqual(denoConfig.imports, {
    '@mmmike/web-push/send': 'npm:@mmmike/web-push@1.3.0/send',
    '@supabase/supabase-js': 'npm:@supabase/supabase-js@2.57.0',
  });
  assert.doesNotMatch(packageJson, /@mmmike\/web-push/);
});

test('returns HTTP 409 with aggregate-only diagnostics for a candidate-limit abort', async () => {
  const diagnostics = completedDiagnostics();
  diagnostics.status = 'candidate_limit_exceeded';
  diagnostics.candidates_scanned = 1001;
  diagnostics.candidate_truncated = true;

  const response = await handleSendRemindersRequest(
    new Request('http://localhost/send-reminders', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-secret' },
    }),
    {
      expectedSecret: 'synthetic-secret',
      run: async () => diagnostics,
    },
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), diagnostics);
});

test('returns only aggregate diagnostics after an authorized orchestration run', async () => {
  const secret = 'synthetic-private-token';
  const sensitiveCandidate = candidate('private-event-id', { title: 'Private Event Title' });
  const sensitiveSubscription = subscription('private-subscription-id', 'private-user-id', {
    endpoint: 'https://fcm.googleapis.com/fcm/send/private-endpoint',
    p256dh: 'private-p256dh',
    auth: 'private-auth',
  });

  const response = await handleSendRemindersRequest(
    new Request('http://localhost/send-reminders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    }),
    {
      expectedSecret: secret,
      now: () => runNow,
      monotonicNow: () => 1,
      run: (context) => runSendReminders(context, orchestrationDependencies({
        fetchCandidatePage: pageFetcher([sensitiveCandidate]),
        fetchMemberships: async () => [{
          space_id: sensitiveCandidate.space_id,
          user_id: 'private-user-id',
        }],
        fetchSubscriptions: async () => [sensitiveSubscription],
        claim: async () => 'private-claim-id',
      })),
    },
  );
  const serialized = JSON.stringify(await response.json());

  assert.equal(response.status, 200);
  assert.doesNotMatch(
    serialized,
    /Private Event Title|private-event-id|private-user-id|private-subscription-id|private-endpoint|private-p256dh|private-auth|synthetic-private-token|private-claim-id/,
  );
});
