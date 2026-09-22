import assert from 'node:assert/strict';
import test from 'node:test';

import {
  projectRecurringReminderCandidates,
  recurringReminderOccurrenceRange,
  type RecurringReminderSource,
} from '../supabase/functions/send-reminders/recurring.ts';
import {
  classifyReminderCandidates,
  createDeliveryTasks,
  createReminderTag,
  runSendReminders,
  type ClaimRecurringReminderInput,
} from '../supabase/functions/send-reminders/logic.ts';
import { expandEventOccurrences } from '../src/lib/recurrence.ts';
import type { EventOccurrenceException } from '../src/types.ts';

const runNow = new Date('2026-09-22T12:00:00.000Z');

function source(overrides: Partial<RecurringReminderSource> = {}): RecurringReminderSource {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    space_id: '20000000-0000-4000-8000-000000000001',
    created_by: '30000000-0000-4000-8000-000000000001',
    scope: 'shared',
    owner_user_id: null,
    title: 'Recurring title',
    description: null,
    starts_at: '2026-09-20T12:00:00.000Z',
    ends_at: '2026-09-20T13:00:00.000Z',
    all_day: false,
    reminder_kind: 'timed_at_start',
    time_zone: 'UTC',
    reminder_schedule_changed_at: '2026-09-20T10:00:00.123456+00:00',
    recurrence_rule: { version: 1, frequency: 'daily', interval: 1, time_zone: 'UTC' },
    series_id: '10000000-0000-4000-8000-000000000001',
    parent_event_id: null,
    recurrence_until: null,
    created_at: '2026-09-20T09:00:00.000Z',
    updated_at: '2026-09-20T10:00:00.654321+00:00',
    ...overrides,
  };
}

function exception(
  occurrenceDate: string,
  overrideData: Record<string, unknown> | null,
  overrides: Partial<EventOccurrenceException> = {},
): EventOccurrenceException {
  return {
    id: `40000000-0000-4000-8000-${occurrenceDate.replaceAll('-', '').padEnd(12, '0')}`,
    event_id: '10000000-0000-4000-8000-000000000001',
    occurrence_date: occurrenceDate,
    exception_type: overrideData === null ? 'deleted' : 'override',
    override_data: overrideData,
    created_at: '2026-09-22T10:00:00.000Z',
    updated_at: '2026-09-22T10:00:00.123456+00:00',
    ...overrides,
  };
}

test('builds the bounded Reminder projection range from local calendar dates across a full-day transition', () => {
  const range = recurringReminderOccurrenceRange(
    new Date('2011-12-29T10:05:00.000Z'),
    'Pacific/Apia',
  );

  assert.equal(range.start.toISOString(), '2011-12-28T10:00:00.000Z');
  assert.equal(range.end.toISOString(), '2011-12-30T09:59:59.999Z');
});

test('projects normal recurring occurrences through the canonical recurrence engine', () => {
  const result = projectRecurringReminderCandidates([source()], [], runNow);
  const due = classifyReminderCandidates(result.candidates, runNow);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(due.eligible.map((entry) => [
    entry.event.title,
    entry.event.recurrence.occurrenceDate,
  ]), [['Recurring title', '2026-09-22']]);
});

test('projects a due occurrence without duration-overlap history for a very long recurring Event', () => {
  const longDurationSource = source({
    starts_at: '2024-01-01T12:00:00.000Z',
    ends_at: '2027-01-01T12:00:00.000Z',
  });
  const originalSource = structuredClone(longDurationSource);
  const range = recurringReminderOccurrenceRange(runNow, longDurationSource.time_zone);

  const calendarExpansion = expandEventOccurrences(longDurationSource, range, []);
  const projected = projectRecurringReminderCandidates([longDurationSource], [], runNow);
  const due = classifyReminderCandidates(projected.candidates, runNow);

  assert.equal(calendarExpansion.error, '重复日程在当前范围内超过 500 个候选。');
  assert.deepEqual(projected.errors, []);
  assert.equal(due.eligible.length, 1);
  assert.equal(due.eligible[0].dueAt.toISOString(), runNow.toISOString());
  assert.equal(due.eligible[0].event.recurrence.logicalSeriesId, longDurationSource.series_id);
  assert.equal(due.eligible[0].event.recurrence.occurrenceDate, '2026-09-22');
  assert.deepEqual(longDurationSource, originalSource);
});

test('uses effective overrides, omits deletions, and only treats a changed start as a schedule change', () => {
  const titleOnly = exception('2026-09-22', {
    title: 'Occurrence title',
    starts_at: '2026-09-22T12:00:00.000Z',
  }, { updated_at: '2026-09-22T12:00:00.000001+00:00' });
  const titleResult = projectRecurringReminderCandidates([source()], [titleOnly], runNow);
  const titleDue = classifyReminderCandidates(titleResult.candidates, runNow);

  assert.equal(titleDue.eligible.length, 1);
  assert.equal(titleDue.eligible[0].event.title, 'Occurrence title');
  assert.equal(titleDue.eligible[0].event.recurrence.exceptionChangesSchedule, false);

  const moved = exception('2026-09-22', {
    title: 'Moved occurrence',
    starts_at: '2026-09-22T12:00:00.000Z',
  });
  const movedSource = source({ starts_at: '2026-09-20T23:00:00.000Z', ends_at: null });
  const movedResult = projectRecurringReminderCandidates([movedSource], [moved], runNow);

  assert.equal(classifyReminderCandidates(movedResult.candidates, runNow).eligible.length, 1);
  assert.equal(movedResult.candidates[0].recurrence.exceptionChangesSchedule, true);

  const deletedResult = projectRecurringReminderCandidates(
    [source()],
    [exception('2026-09-22', null)],
    runNow,
  );
  assert.equal(deletedResult.candidates.some((entry) => entry.recurrence.occurrenceDate === '2026-09-22'), false);
});

test('skips a newly-past moved override but permits the same occurrence on a later due run', () => {
  const movedAfterDue = exception('2026-09-22', {
    starts_at: '2026-09-22T11:59:00.000Z',
  }, { updated_at: '2026-09-22T11:59:00.000001+00:00' });
  const projected = projectRecurringReminderCandidates([source()], [movedAfterDue], runNow);
  const first = classifyReminderCandidates(projected.candidates, runNow);

  assert.equal(first.newlyPastSkipped, 1);
  assert.equal(first.eligible.length, 0);

  const futureMove = exception('2026-09-22', {
    starts_at: '2026-09-22T12:05:00.000Z',
  }, { updated_at: '2026-09-22T12:00:00.000001+00:00' });
  const laterProjected = projectRecurringReminderCandidates([source()], [futureMove], new Date('2026-09-22T12:05:00.000Z'));
  assert.equal(classifyReminderCandidates(laterProjected.candidates, new Date('2026-09-22T12:05:00.000Z')).eligible.length, 1);
});

test('skips an override moved out of the current due window', () => {
  const movedOut = exception('2026-09-22', {
    starts_at: '2026-09-22T12:30:00.000Z',
  });
  const projected = projectRecurringReminderCandidates([source()], [movedOut], runNow);
  const due = classifyReminderCandidates(projected.candidates, runNow);

  assert.equal(
    projected.candidates.find((candidate) => candidate.recurrence.occurrenceDate === '2026-09-22')?.starts_at,
    '2026-09-22T12:30:00.000Z',
  );
  assert.equal(
    due.eligible.some((entry) => entry.event.recurrence.occurrenceDate === '2026-09-22'),
    false,
  );
  assert.ok(due.futureSkipped >= 1);
});

test('calculates both recurring all-day Reminder kinds in the canonical recurrence timezone', () => {
  const allDaySource = source({
    starts_at: '2026-09-20T16:00:00.000Z',
    ends_at: null,
    all_day: true,
    time_zone: 'Asia/Shanghai',
    recurrence_rule: {
      version: 1,
      frequency: 'daily',
      interval: 1,
      time_zone: 'Asia/Shanghai',
    },
    reminder_kind: 'all_day_same_day_08',
  });
  const sameDayNow = new Date('2026-09-22T00:00:00.000Z');
  const sameDay = classifyReminderCandidates(
    projectRecurringReminderCandidates([allDaySource], [], sameDayNow).candidates,
    sameDayNow,
  );

  assert.deepEqual(
    sameDay.eligible.map((entry) => entry.event.recurrence.occurrenceDate),
    ['2026-09-22'],
  );

  const previousDayNow = new Date('2026-09-22T12:00:00.000Z');
  const previousDay = classifyReminderCandidates(
    projectRecurringReminderCandidates([{
      ...allDaySource,
      reminder_kind: 'all_day_previous_day_20',
    }], [], previousDayNow).candidates,
    previousDayNow,
  );

  assert.deepEqual(
    previousDay.eligible.map((entry) => entry.event.recurrence.occurrenceDate),
    ['2026-09-23'],
  );
});

test('a current-and-future cutoff removes the selected and later occurrence from Reminder projection', () => {
  const projected = projectRecurringReminderCandidates([source({
    recurrence_until: runNow.toISOString(),
  })], [], runNow);

  assert.equal(
    projected.candidates.some((candidate) => candidate.recurrence.occurrenceDate === '2026-09-22'),
    false,
  );
});

test('keeps colliding effective instants independently deliverable by occurrence date', () => {
  const exceptions = [
    exception('2026-09-22', { starts_at: runNow.toISOString() }),
    exception('2026-09-23', { starts_at: runNow.toISOString() }),
  ];
  const projected = projectRecurringReminderCandidates([source()], exceptions, runNow);
  const eligible = classifyReminderCandidates(projected.candidates, runNow).eligible;
  const delivery = createDeliveryTasks(
    eligible,
    [{ space_id: source().space_id, user_id: 'user-1' }],
    [{
      id: 'subscription-1',
      user_id: 'user-1',
      installation_id: 'installation-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/test',
      p256dh: 'p256dh',
      auth: 'auth',
      expiration_time: null,
      disabled_at: null,
    }],
    runNow,
  );

  assert.deepEqual(
    delivery.tasks.map((task) => task.recurrence?.occurrenceDate).sort(),
    ['2026-09-22', '2026-09-23'],
  );
});

test('uses occurrence date in the opaque Push tag for colliding recurring due instants', async () => {
  const first = await createReminderTag(source().series_id!, runNow, '2026-09-22');
  const second = await createReminderTag(source().series_id!, runNow, '2026-09-23');
  const ordinary = await createReminderTag(source().id, runNow);

  assert.notEqual(first, second);
  assert.notEqual(first, ordinary);
});

test('orchestrates recurring projection through the recurring claim snapshot and effective title', async () => {
  const titleOverride = exception('2026-09-22', {
    title: 'Effective occurrence title',
    starts_at: runNow.toISOString(),
  });
  const claims: ClaimRecurringReminderInput[] = [];
  const payloads: Array<{ body: string; tag: string }> = [];

  const result = await runSendReminders(
    { runNow, startedAt: 0, monotonicNow: () => 1 },
    {
      fetchCandidatePage: async () => [],
      fetchRecurringCandidatePage: async ({ afterId }) => afterId === null ? [source()] : [],
      fetchRecurringExceptions: async () => ({
        exceptions: [titleOverride],
        exceptionsScanned: 1,
        exceptionTruncated: false,
      }),
      fetchMemberships: async () => [{ space_id: source().space_id, user_id: 'user-1' }],
      fetchSubscriptions: async () => [{
        id: 'subscription-1',
        user_id: 'user-1',
        installation_id: 'installation-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        p256dh: 'p256dh',
        auth: 'auth',
        expiration_time: null,
        disabled_at: null,
      }],
      claim: async () => { throw new Error('ordinary claim must not run'); },
      claimRecurring: async (input) => {
        claims.push(input);
        return '50000000-0000-4000-8000-000000000001';
      },
      send: async (_subscription, payload) => {
        payloads.push({ body: payload.body, tag: payload.tag });
        return { classification: 'delivered', provider: 'fcm.googleapis.com', status: 201 };
      },
      disableSubscription: async () => true,
      finalize: async () => 1,
    },
  );

  assert.equal(result.sent, 1);
  assert.deepEqual(claims, [{
    sourceEventId: source().id,
    logicalSeriesId: source().series_id,
    occurrenceDate: '2026-09-22',
    recipientUserId: 'user-1',
    subscriptionId: 'subscription-1',
    dueAt: runNow.toISOString(),
    expectedSourceUpdatedAt: source().updated_at,
    expectedReminderScheduleChangedAt: source().reminder_schedule_changed_at,
    expectedExceptionId: titleOverride.id,
    expectedExceptionUpdatedAt: titleOverride.updated_at,
    expectedExceptionType: 'override',
    effectiveScheduleChangedAt: source().reminder_schedule_changed_at,
  }]);
  assert.equal(payloads[0].body, 'Effective occurrence title');
  assert.match(payloads[0].tag, /^reminder-v1-[A-Za-z0-9_-]{43}$/);
});

test('aborts a truncated recurring exception scan before membership, claim, or send', async () => {
  let downstreamCalls = 0;
  const result = await runSendReminders(
    { runNow, startedAt: 0, monotonicNow: () => 1 },
    {
      fetchCandidatePage: async () => [],
      fetchRecurringCandidatePage: async ({ afterId }) => afterId === null ? [source()] : [],
      fetchRecurringExceptions: async () => ({
        exceptions: [],
        exceptionsScanned: 1001,
        exceptionTruncated: true,
      }),
      fetchMemberships: async () => { downstreamCalls += 1; return []; },
      fetchSubscriptions: async () => { downstreamCalls += 1; return []; },
      claim: async () => { downstreamCalls += 1; return null; },
      claimRecurring: async () => { downstreamCalls += 1; return null; },
      send: async () => {
        downstreamCalls += 1;
        return { classification: 'network_error', provider: 'fcm.googleapis.com' };
      },
      disableSubscription: async () => true,
      finalize: async () => 1,
    },
  );

  assert.equal(result.status, 'candidate_limit_exceeded');
  assert.equal(result.candidate_truncated, true);
  assert.equal(downstreamCalls, 0);
});
