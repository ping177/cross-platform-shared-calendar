import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAllDayReminderDue } from '../supabase/functions/_shared/reminder-due.ts';
import {
  projectImportantDateReminderCandidates,
  type ImportantDateReminderSource,
} from '../supabase/functions/send-reminders/important-dates.ts';

function source(patch: Partial<ImportantDateReminderSource> = {}): ImportantDateReminderSource {
  return { id: 'date-1', space_id: 'space-1', name: 'Birthday', repeat_kind: 'annual',
    year: null, month: 7, day: 18, reminder_kind: 'all_day_same_day_08', time_zone: 'Asia/Shanghai',
    reminder_schedule_changed_at: '2026-01-01T00:00:00.123456+00:00', ...patch };
}

function candidates(sources: ImportantDateReminderSource[], now: string) {
  const result = projectImportantDateReminderCandidates(sources, new Date(now));
  assert.deepEqual(result.errors, []);
  return result.candidates.map((candidate) => [candidate.source.id, candidate.occurrenceDate, candidate.dueAt.toISOString()]);
}

test('civil-date due handles disabled and the two frozen all-day presets without an Event', () => {
  const input = { date: { year: 2026, month: 7, day: 18 }, timeZone: 'Asia/Shanghai' };
  assert.deepEqual(calculateAllDayReminderDue({ ...input, reminderKind: null, timeZone: null }), { status: 'disabled' });
  assert.deepEqual(calculateAllDayReminderDue({ ...input, reminderKind: 'all_day_same_day_08' }),
    { status: 'scheduled', dueAt: new Date('2026-07-18T00:00:00Z') });
  assert.deepEqual(calculateAllDayReminderDue({ ...input, reminderKind: 'all_day_previous_day_20' }),
    { status: 'scheduled', dueAt: new Date('2026-07-17T12:00:00Z') });
});

test('civil-date due rejects missing/invalid timezone and overflow dates without guessed UTC', () => {
  const input = { date: { year: 2026, month: 7, day: 18 }, reminderKind: 'all_day_same_day_08' as const };
  for (const timeZone of [null, '']) assert.deepEqual(calculateAllDayReminderDue({ ...input, timeZone }),
    { status: 'invalid', reason: 'missing_time_zone' });
  for (const timeZone of ['invalid', '+08:00']) assert.deepEqual(calculateAllDayReminderDue({ ...input, timeZone }),
    { status: 'invalid', reason: 'invalid_time_zone' });
  for (const date of [{ year: 2027, month: 2, day: 29 }, { year: 2026, month: 4, day: 31 },
    { year: 2026, month: 7.5, day: 18 }, { year: 30_000_000, month: 1, day: 1 }]) {
    assert.deepEqual(calculateAllDayReminderDue({ ...input, date, timeZone: 'UTC' }), { status: 'invalid', reason: 'invalid_start' });
  }
});

test('adapter emits occurrence identity and due for both presets, and omits null', () => {
  assert.deepEqual(candidates([source(), source({ id: 'off', reminder_kind: null })], '2026-07-18T00:05:00Z'),
    [['date-1', '2026-07-18', '2026-07-18T00:00:00.000Z']]);
  assert.deepEqual(candidates([source({ reminder_kind: 'all_day_previous_day_20' })], '2026-07-17T12:05:00Z'),
    [['date-1', '2026-07-18', '2026-07-17T12:00:00.000Z']]);
});

test('UTC due window includes its exact grace boundary and excludes future/expired due', () => {
  for (const now of ['2026-07-18T00:00:00Z', '2026-07-18T00:10:00Z']) {
    assert.equal(candidates([source()], now).length, 1);
  }
  for (const now of ['2026-07-17T23:59:59.999Z', '2026-07-18T00:10:00.001Z', '2026-07-19T00:00:00Z']) {
    assert.deepEqual(candidates([source()], now), []);
  }
});

test('grace crossing a skipped civil day retains the previous date and independent colliding occurrences', () => {
  const skipped = source({ id: 'skipped', year: 2011, repeat_kind: 'none', month: 12, day: 30, time_zone: 'Pacific/Apia' });
  const next = source({ id: 'next', year: 2011, repeat_kind: 'none', month: 12, day: 31,
    time_zone: 'Pacific/Apia', reminder_kind: 'all_day_previous_day_20' });
  assert.deepEqual(candidates([skipped, next], '2011-12-30T10:05:00Z'), [
    ['next', '2011-12-31', '2011-12-30T10:00:00.000Z'],
    ['skipped', '2011-12-30', '2011-12-30T10:00:00.000Z'],
  ]);
  assert.equal(candidates([skipped], '2011-12-30T10:10:00Z').length, 1);
  assert.deepEqual(candidates([skipped], '2011-12-30T10:10:00.001Z'), []);
});

test('grace crossing local midnight and New Year does not discard last-year occurrence', () => {
  const skipped = source({ month: 12, day: 31, time_zone: 'Pacific/Kiritimati' });
  assert.deepEqual(candidates([skipped], '1994-12-31T10:05:00Z'),
    [['date-1', '1994-12-31', '1994-12-31T10:00:00.000Z']]);
  const next = source({ month: 1, day: 1, time_zone: 'Pacific/Auckland', reminder_kind: 'all_day_previous_day_20' });
  assert.deepEqual(candidates([next], '2025-12-31T07:05:00Z'),
    [['date-1', '2026-01-01', '2025-12-31T07:00:00.000Z']]);
});

test('DST uses saved timezone and previous local calendar day, including a half-hour transition', () => {
  for (const [month, day, time_zone, same, previous] of [
    [3, 8, 'America/New_York', '2026-03-08T12:00:00Z', '2026-03-08T01:00:00Z'],
    [3, 9, 'America/New_York', '2026-03-09T12:00:00Z', '2026-03-09T00:00:00Z'],
    [11, 1, 'America/New_York', '2026-11-01T13:00:00Z', '2026-11-01T00:00:00Z'],
    [11, 2, 'America/New_York', '2026-11-02T13:00:00Z', '2026-11-02T01:00:00Z'],
    [10, 4, 'Australia/Lord_Howe', '2026-10-03T21:00:00Z', '2026-10-03T09:30:00Z'],
  ] as const) {
    const date = source({ month, day, time_zone });
    assert.equal(candidates([date], same)[0][2], new Date(same).toISOString());
    assert.equal(candidates([{ ...date, reminder_kind: 'all_day_previous_day_20' }], previous)[0][2], new Date(previous).toISOString());
  }
});

test('annual February 29 uses canonical fallback and respects the first leap anchor', () => {
  const leap = source({ month: 2, day: 29 });
  assert.deepEqual(candidates([leap], '2027-02-28T00:05:00Z'), [['date-1', '2027-02-28', '2027-02-28T00:00:00.000Z']]);
  assert.deepEqual(candidates([leap], '2028-02-29T00:05:00Z'), [['date-1', '2028-02-29', '2028-02-29T00:00:00.000Z']]);
  assert.deepEqual(candidates([{ ...leap, year: 2028 }], '2027-02-28T00:05:00Z'), []);
  assert.deepEqual(candidates([{ ...leap, year: 2028 }], '2029-02-28T00:05:00Z'), [['date-1', '2029-02-28', '2029-02-28T00:00:00.000Z']]);
});

test('future anchor has no fictional occurrence but permits its first previous-day reminder', () => {
  const future = source({ year: 2030, month: 9, day: 30, reminder_kind: 'all_day_previous_day_20' });
  assert.deepEqual(candidates([future], '2026-09-29T12:05:00Z'), []);
  assert.deepEqual(candidates([future], '2030-09-29T12:05:00Z'), [['date-1', '2030-09-30', '2030-09-29T12:00:00.000Z']]);
});

test('non-repeat discovers only its exact date; large future years never enter timestamp conversion', () => {
  const once = source({ year: 2026, repeat_kind: 'none' });
  assert.equal(candidates([once], '2026-07-18T00:05:00Z').length, 1);
  assert.deepEqual(candidates([once], '2027-07-18T00:05:00Z'), []);
  for (const repeat_kind of ['annual', 'none'] as const) {
    assert.deepEqual(candidates([source({ repeat_kind, year: 30_000_000 })], '2026-07-18T00:05:00Z'), []);
  }
});

test('projection preserves raw source/marker without treating it as send eligibility or mutating inputs', () => {
  const date = source({ reminder_schedule_changed_at: '2026-07-18T00:00:00.000001+00:00' });
  const before = structuredClone(date);
  const result = projectImportantDateReminderCandidates([date], new Date('2026-07-18T00:05:00Z'));
  assert.deepEqual(result.errors, []);
  assert.equal(result.candidates[0].source, date);
  assert.equal(result.candidates[0].source.reminder_schedule_changed_at, before.reminder_schedule_changed_at);
  assert.deepEqual(date, before);
});

test('projection reports invalid enabled sources explicitly and rejects an invalid run clock', () => {
  const result = projectImportantDateReminderCandidates([
    source({ id: 'bad-zone', time_zone: 'invalid' }), source({ id: 'bad-date', month: 4, day: 31 }),
    source({ id: 'off', reminder_kind: null, time_zone: 'invalid' }), source(),
  ], new Date('2026-07-18T00:05:00Z'));
  assert.deepEqual(result.errors, [
    { important_date_id: 'bad-zone', error: 'invalid_time_zone' },
    { important_date_id: 'bad-date', error: 'invalid_fields' },
  ]);
  assert.equal(result.candidates.length, 1);
  assert.throws(() => projectImportantDateReminderCandidates([], new Date('invalid')), RangeError);
});
