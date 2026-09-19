import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateReminderDue } from '../supabase/functions/_shared/reminder-due.ts';

function dueAt(input: Parameters<typeof calculateReminderDue>[0]) {
  const result = calculateReminderDue(input);
  assert.equal(result.status, 'scheduled');
  if (result.status !== 'scheduled') {
    throw new Error(`Expected a scheduled reminder, received ${result.status}.`);
  }
  return result.dueAt.toISOString();
}

test('returns disabled for a null reminder kind', () => {
  assert.deepEqual(calculateReminderDue({
    startsAt: '2026-07-18T01:00:00.000Z',
    allDay: false,
    reminderKind: null,
    timeZone: null,
  }), { status: 'disabled' });
});

test('calculates all five timed reminder kinds', () => {
  const base = {
    startsAt: '2026-07-18T01:00:00.000Z',
    allDay: false,
    timeZone: 'Asia/Shanghai',
  } as const;

  assert.equal(dueAt({ ...base, reminderKind: 'timed_at_start' }), '2026-07-18T01:00:00.000Z');
  assert.equal(dueAt({ ...base, reminderKind: 'timed_10m_before' }), '2026-07-18T00:50:00.000Z');
  assert.equal(dueAt({ ...base, reminderKind: 'timed_30m_before' }), '2026-07-18T00:30:00.000Z');
  assert.equal(dueAt({ ...base, reminderKind: 'timed_1h_before' }), '2026-07-18T00:00:00.000Z');
  assert.equal(dueAt({ ...base, reminderKind: 'timed_previous_day_same_time' }), '2026-07-17T01:00:00.000Z');
});

test('uses local calendar arithmetic for previous-day reminders across the spring DST gap', () => {
  assert.equal(dueAt({
    startsAt: '2026-03-09T06:30:00.000Z',
    allDay: false,
    reminderKind: 'timed_previous_day_same_time',
    timeZone: 'America/New_York',
  }), '2026-03-08T07:00:00.000Z');
});

test('uses the existing earlier-instant policy for a previous-day reminder in a DST overlap', () => {
  assert.equal(dueAt({
    startsAt: '2026-11-02T06:30:00.000Z',
    allDay: false,
    reminderKind: 'timed_previous_day_same_time',
    timeZone: 'America/New_York',
  }), '2026-11-01T05:30:00.000Z');
});

test('calculates both all-day reminder kinds from the canonical local start date', () => {
  const base = {
    startsAt: '2026-07-17T16:30:00.000Z',
    allDay: true,
    timeZone: 'Asia/Shanghai',
  } as const;

  assert.equal(dueAt({ ...base, reminderKind: 'all_day_same_day_08' }), '2026-07-18T00:00:00.000Z');
  assert.equal(dueAt({ ...base, reminderKind: 'all_day_previous_day_20' }), '2026-07-17T12:00:00.000Z');
});

test('rejects reminder kinds that do not match the event all-day mode', () => {
  assert.deepEqual(calculateReminderDue({
    startsAt: '2026-07-18T01:00:00.000Z',
    allDay: true,
    reminderKind: 'timed_10m_before',
    timeZone: 'Asia/Shanghai',
  }), { status: 'invalid', reason: 'kind_event_type_mismatch' });

  assert.deepEqual(calculateReminderDue({
    startsAt: '2026-07-18T01:00:00.000Z',
    allDay: false,
    reminderKind: 'all_day_same_day_08',
    timeZone: 'Asia/Shanghai',
  }), { status: 'invalid', reason: 'kind_event_type_mismatch' });
});

test('rejects missing and invalid timezones for enabled reminders', () => {
  assert.deepEqual(calculateReminderDue({
    startsAt: '2026-07-18T01:00:00.000Z',
    allDay: false,
    reminderKind: 'timed_at_start',
    timeZone: null,
  }), { status: 'invalid', reason: 'missing_time_zone' });

  assert.deepEqual(calculateReminderDue({
    startsAt: '2026-07-18T01:00:00.000Z',
    allDay: false,
    reminderKind: 'timed_at_start',
    timeZone: 'Not/A_Time_Zone',
  }), { status: 'invalid', reason: 'invalid_time_zone' });

  assert.deepEqual(calculateReminderDue({
    startsAt: '2026-07-18T01:00:00.000Z',
    allDay: false,
    reminderKind: 'timed_at_start',
    timeZone: '+01:00',
  }), { status: 'invalid', reason: 'invalid_time_zone' });
});

test('rejects an invalid start instant', () => {
  assert.deepEqual(calculateReminderDue({
    startsAt: 'not-a-date',
    allDay: false,
    reminderKind: 'timed_at_start',
    timeZone: 'Asia/Shanghai',
  }), { status: 'invalid', reason: 'invalid_start' });
});

test('does not accept or use an event end when calculating a reminder', () => {
  const inputWithUnrelatedEnd = {
    startsAt: '2026-07-18T01:00:00.000Z',
    endsAt: '2026-07-25T01:00:00.000Z',
    allDay: false,
    reminderKind: 'timed_10m_before' as const,
    timeZone: 'Asia/Shanghai',
  };

  assert.equal(dueAt(inputWithUnrelatedEnd), '2026-07-18T00:50:00.000Z');
});
