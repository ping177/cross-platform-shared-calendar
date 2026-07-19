import assert from 'node:assert/strict';
import test from 'node:test';

import { calendarVisibleRange } from '../src/lib/calendar-display.ts';
import { defaultRecurrenceDraft, expandEventOccurrences, expandRecurringEvents, parseRecurrenceRule, recurrenceDraftFromRule, recurrenceRuleFromDraft, recurrenceSummary } from '../src/lib/recurrence.ts';
import type { CalendarEvent, EventOccurrenceException, RecurrenceRule } from '../src/types.ts';

const timeZone = 'Asia/Shanghai';

function eventWithRule(startsAt: string, recurrenceRule: RecurrenceRule | null): CalendarEvent {
  return {
    id: 'event-1',
    space_id: 'space-1',
    created_by: 'user-1',
    scope: 'shared',
    owner_user_id: null,
    title: 'Recurring test',
    description: null,
    starts_at: startsAt,
    ends_at: null,
    all_day: false,
    recurrence_rule: recurrenceRule,
    series_id: recurrenceRule ? 'event-1' : null,
    parent_event_id: null,
    recurrence_until: null,
    created_at: startsAt,
    updated_at: startsAt,
  };
}

function exception(overrides: Partial<EventOccurrenceException>): EventOccurrenceException {
  return {
    id: 'exception-1',
    event_id: 'event-1',
    occurrence_date: '2026-07-27',
    exception_type: 'override',
    override_data: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function rule(ruleInput: Omit<RecurrenceRule, 'version' | 'time_zone'>): RecurrenceRule {
  return { version: 1, time_zone: timeZone, ...ruleInput } as RecurrenceRule;
}

function expand(event: CalendarEvent, start: string, end: string) {
  return expandEventOccurrences(event, {
    start: new Date(start),
    end: new Date(end),
  });
}

function occurrenceDates(result: ReturnType<typeof expandEventOccurrences>) {
  return result.occurrences.map((occurrence) => occurrence.occurrence_starts_at.slice(0, 10));
}

test('projects a non-recurring event without changing its start', () => {
  const event = eventWithRule('2026-01-05T01:00:00.000Z', null);

  const result = expand(event, '2026-01-05T00:00:00.000Z', '2026-01-05T23:59:59.999Z');

  assert.equal(result.error, null);
  assert.deepEqual(occurrenceDates(result), ['2026-01-05']);
  assert.equal(result.occurrences[0].source_event_id, event.id);
});

test('expands a daily rule every N days', () => {
  const event = eventWithRule('2026-01-01T01:00:00.000Z', rule({ frequency: 'daily', interval: 2 }));

  const result = expand(event, '2026-01-01T00:00:00.000Z', '2026-01-08T23:59:59.999Z');

  assert.equal(result.error, null);
  assert.deepEqual(occurrenceDates(result), ['2026-01-01', '2026-01-03', '2026-01-05', '2026-01-07']);
});

test('expands weekly rules on selected weekdays', () => {
  const event = eventWithRule('2026-01-05T01:00:00.000Z', rule({ frequency: 'weekly', interval: 1, days_of_week: [1, 3, 5] }));

  const result = expand(event, '2026-01-05T00:00:00.000Z', '2026-01-11T23:59:59.999Z');

  assert.equal(result.error, null);
  assert.deepEqual(occurrenceDates(result), ['2026-01-05', '2026-01-07', '2026-01-09']);
});

test('anchors a multi-week rule to the source week', () => {
  const event = eventWithRule('2026-01-05T01:00:00.000Z', rule({ frequency: 'weekly', interval: 2, days_of_week: [6] }));

  const result = expand(event, '2026-01-01T00:00:00.000Z', '2026-02-01T23:59:59.999Z');

  assert.equal(result.error, null);
  assert.deepEqual(occurrenceDates(result), ['2026-01-05', '2026-01-10', '2026-01-24']);
});

test('skips absent numeric monthly dates', () => {
  const event = eventWithRule('2026-01-31T01:00:00.000Z', rule({ frequency: 'monthly', interval: 1, day_of_month: 31 }));

  const result = expand(event, '2026-01-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z');

  assert.equal(result.error, null);
  assert.deepEqual(occurrenceDates(result), ['2026-01-31', '2026-03-31']);
});

test('expands monthly last_day rules on each month end', () => {
  const event = eventWithRule('2026-01-31T01:00:00.000Z', rule({ frequency: 'monthly', interval: 1, day_of_month: 'last_day' }));

  const result = expand(event, '2026-01-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z');

  assert.equal(result.error, null);
  assert.deepEqual(occurrenceDates(result), ['2026-01-31', '2026-02-28', '2026-03-31']);
});

test('expands yearly rules on the selected month and day', () => {
  const event = eventWithRule('2026-07-17T01:00:00.000Z', rule({ frequency: 'yearly', interval: 1, month: 7, day: 17 }));

  const result = expand(event, '2026-01-01T00:00:00.000Z', '2028-01-01T00:00:00.000Z');

  assert.equal(result.error, null);
  assert.deepEqual(occurrenceDates(result), ['2026-07-17', '2027-07-17']);
});

test('skips non-leap years for a yearly February 29 rule', () => {
  const event = eventWithRule('2024-02-29T01:00:00.000Z', rule({ frequency: 'yearly', interval: 1, month: 2, day: 29 }));

  const result = expand(event, '2024-01-01T00:00:00.000Z', '2029-01-01T00:00:00.000Z');

  assert.equal(result.error, null);
  assert.deepEqual(occurrenceDates(result), ['2024-02-29', '2028-02-29']);
});

test('rejects invalid recurrence rules', () => {
  assert.equal(parseRecurrenceRule({ version: 1, frequency: 'hourly', interval: 1, time_zone: timeZone }).ok, false);
  assert.equal(parseRecurrenceRule({ version: 1, frequency: 'weekly', interval: 1, days_of_week: [0], time_zone: timeZone }).ok, false);
  assert.equal(parseRecurrenceRule({ version: 1, frequency: 'yearly', interval: 1, month: 2, day: 30, time_zone: timeZone }).ok, false);
});

test('returns an error instead of partial results when the candidate limit is reached', () => {
  const event = eventWithRule('2026-01-01T01:00:00.000Z', rule({ frequency: 'daily', interval: 1 }));

  const result = expand(event, '2026-01-01T00:00:00.000Z', '2028-01-01T00:00:00.000Z');

  assert.match(result.error ?? '', /500/);
  assert.deepEqual(result.occurrences, []);
});

test('projects one-off and recurring source events into range-bounded display occurrences', () => {
  const oneOff = eventWithRule('2026-01-05T01:00:00.000Z', null);
  const recurring = { ...eventWithRule('2026-01-01T01:00:00.000Z', rule({ frequency: 'daily', interval: 2 })), id: 'event-2' };

  const result = expandRecurringEvents([oneOff, recurring], {
    start: new Date('2026-01-05T00:00:00.000Z'),
    end: new Date('2026-01-07T23:59:59.999Z'),
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.occurrences.map((occurrence) => occurrence.occurrence_id), [
    'event-1:2026-01-05',
    'event-2:2026-01-05',
    'event-2:2026-01-07',
  ]);
  assert.equal(result.occurrences[1].source_event_id, 'event-2');
  assert.equal(result.occurrences[1].source_event.id, result.occurrences[1].source_event_id);
});

test('projects a split series as one old occurrence followed by the child baseline', () => {
  const oldSegment = {
    ...eventWithRule('2026-07-20T11:00:00.000Z', rule({ frequency: 'weekly', interval: 1, days_of_week: [1] })),
    id: 'event-old',
    title: '旧基线',
    recurrence_until: '2026-07-27T11:00:00.000Z',
  };
  const childSegment = {
    ...eventWithRule('2026-07-27T12:00:00.000Z', rule({ frequency: 'weekly', interval: 1, days_of_week: [1] })),
    id: 'event-child',
    title: '新基线',
    series_id: 'event-old',
    parent_event_id: 'event-old',
  };

  const result = expandRecurringEvents([oldSegment, childSegment], {
    start: new Date('2026-07-20T00:00:00.000Z'),
    end: new Date('2026-08-03T23:59:59.999Z'),
  });

  assert.deepEqual(result.occurrences.map((occurrence) => [occurrence.occurrence_date, occurrence.source_event_id, occurrence.title]), [
    ['2026-07-20', 'event-old', '旧基线'],
    ['2026-07-27', 'event-child', '新基线'],
    ['2026-08-03', 'event-child', '新基线'],
  ]);
});

test('removes a scheduled occurrence with a deleted exception', () => {
  const event = eventWithRule('2026-07-20T11:00:00.000Z', rule({ frequency: 'weekly', interval: 1, days_of_week: [1] }));

  const result = expandRecurringEvents([event], {
    start: new Date('2026-07-20T00:00:00.000Z'),
    end: new Date('2026-08-03T23:59:59.999Z'),
  }, [exception({ exception_type: 'deleted' })]);

  assert.deepEqual(occurrenceDates({ occurrences: result.occurrences, error: null }), ['2026-07-20', '2026-08-03']);
});

test('applies a starts_at override without changing occurrence identity or duration', () => {
  const event = { ...eventWithRule('2026-07-27T11:00:00.000Z', rule({ frequency: 'weekly', interval: 1, days_of_week: [1] })), ends_at: '2026-07-27T12:00:00.000Z' };

  const result = expandRecurringEvents([event], {
    start: new Date('2026-07-27T00:00:00.000Z'),
    end: new Date('2026-07-27T23:59:59.999Z'),
  }, [exception({ override_data: { starts_at: '2026-07-27T12:00:00.000Z', title: 'Override title', description: null } })]);

  assert.equal(result.occurrences.length, 1);
  assert.equal(result.occurrences[0].occurrence_id, 'event-1:2026-07-27');
  assert.equal(result.occurrences[0].occurrence_date, '2026-07-27');
  assert.equal(result.occurrences[0].occurrence_starts_at, '2026-07-27T12:00:00.000Z');
  assert.equal(result.occurrences[0].occurrence_ends_at, '2026-07-27T13:00:00.000Z');
  assert.equal(result.occurrences[0].title, 'Override title');
  assert.equal(result.occurrences[0].description, null);
});

test('matches exceptions by the scheduled date in the source recurrence timezone', () => {
  const event = eventWithRule('2026-07-26T16:00:00.000Z', rule({ frequency: 'weekly', interval: 1, days_of_week: [1] }));

  const result = expandRecurringEvents([event], {
    start: new Date('2026-07-26T15:00:00.000Z'),
    end: new Date('2026-07-26T18:00:00.000Z'),
  }, [exception({ occurrence_date: '2026-07-27', override_data: { starts_at: '2026-07-26T17:00:00.000Z' } })]);

  assert.equal(result.occurrences[0].occurrence_id, 'event-1:2026-07-27');
  assert.equal(result.occurrences[0].occurrence_starts_at, '2026-07-26T17:00:00.000Z');
});

test('includes an override moved into the visible range and excludes it from its scheduled range', () => {
  const event = eventWithRule('2026-07-20T11:00:00.000Z', rule({ frequency: 'weekly', interval: 1, days_of_week: [1] }));
  const moved = exception({ occurrence_date: '2026-07-20', override_data: { starts_at: '2026-07-22T11:00:00.000Z' } });

  const movedIntoRange = expandRecurringEvents([event], {
    start: new Date('2026-07-22T00:00:00.000Z'),
    end: new Date('2026-07-22T23:59:59.999Z'),
  }, [moved]);
  const movedOutOfRange = expandRecurringEvents([event], {
    start: new Date('2026-07-20T00:00:00.000Z'),
    end: new Date('2026-07-20T23:59:59.999Z'),
  }, [moved]);

  assert.deepEqual(movedIntoRange.occurrences.map((occurrence) => occurrence.occurrence_id), ['event-1:2026-07-20']);
  assert.deepEqual(movedOutOfRange.occurrences, []);
});

test('ignores invalid exceptions safely', () => {
  const event = eventWithRule('2026-07-27T11:00:00.000Z', rule({ frequency: 'weekly', interval: 1, days_of_week: [1] }));

  const result = expandRecurringEvents([event], {
    start: new Date('2026-07-27T00:00:00.000Z'),
    end: new Date('2026-07-27T23:59:59.999Z'),
  }, [exception({ override_data: { starts_at: 'not-a-date', owner_user_id: 'not-allowed' } })]);

  assert.equal(result.occurrences.length, 1);
  assert.equal(result.occurrences[0].occurrence_starts_at, '2026-07-27T11:00:00.000Z');
});

test('builds exact Today, Week, and 42-cell Month visible ranges', () => {
  const selectedDate = new Date(2026, 6, 15, 12);

  const today = calendarVisibleRange('today', selectedDate);
  const week = calendarVisibleRange('week', selectedDate);
  const month = calendarVisibleRange('month', selectedDate);

  assert.deepEqual([today.start.getFullYear(), today.start.getMonth(), today.start.getDate(), today.end.getDate()], [2026, 6, 15, 15]);
  assert.deepEqual([week.start.getFullYear(), week.start.getMonth(), week.start.getDate(), week.end.getMonth(), week.end.getDate()], [2026, 6, 13, 6, 19]);
  assert.deepEqual([month.start.getFullYear(), month.start.getMonth(), month.start.getDate(), month.end.getFullYear(), month.end.getMonth(), month.end.getDate()], [2026, 5, 29, 2026, 7, 9]);
});

test('builds a null recurrence rule for a non-recurring event', () => {
  const result = recurrenceRuleFromDraft(defaultRecurrenceDraft('2026-07-17T09:00'), timeZone);

  assert.equal(result.ok, true);
  assert.equal(result.rule, null);
});

test('builds daily, weekly, monthly, and yearly rules from form drafts', () => {
  const daily = recurrenceRuleFromDraft({ ...defaultRecurrenceDraft('2026-07-17T09:00'), frequency: 'daily', interval: 2 }, timeZone);
  const weekly = recurrenceRuleFromDraft({ ...defaultRecurrenceDraft('2026-07-17T09:00'), frequency: 'weekly', interval: 2, days_of_week: [1, 3, 5] }, timeZone);
  const monthly = recurrenceRuleFromDraft({ ...defaultRecurrenceDraft('2026-07-17T09:00'), frequency: 'monthly', interval: 3, day_of_month: 'last_day' }, timeZone);
  const yearly = recurrenceRuleFromDraft({ ...defaultRecurrenceDraft('2026-07-17T09:00'), frequency: 'yearly', interval: 1, month: 7, day: 17 }, timeZone);

  assert.deepEqual(daily.rule, rule({ frequency: 'daily', interval: 2 }));
  assert.deepEqual(weekly.rule, rule({ frequency: 'weekly', interval: 2, days_of_week: [1, 3, 5] }));
  assert.deepEqual(monthly.rule, rule({ frequency: 'monthly', interval: 3, day_of_month: 'last_day' }));
  assert.deepEqual(yearly.rule, rule({ frequency: 'yearly', interval: 1, month: 7, day: 17 }));
});

test('loads a saved recurring rule back into an editable draft for whole-series updates', () => {
  const savedRule = rule({ frequency: 'weekly', interval: 2, days_of_week: [2, 4] });
  const draft = recurrenceDraftFromRule(savedRule, '2026-07-17T09:00');
  const updated = recurrenceRuleFromDraft({ ...draft, interval: 3 }, timeZone);

  assert.deepEqual(updated.rule, rule({ frequency: 'weekly', interval: 3, days_of_week: [2, 4] }));
});

test('rejects invalid selector combinations from recurrence form drafts', () => {
  const weekly = recurrenceRuleFromDraft({ ...defaultRecurrenceDraft('2026-07-17T09:00'), frequency: 'weekly', days_of_week: [] }, timeZone);
  const yearly = recurrenceRuleFromDraft({ ...defaultRecurrenceDraft('2026-07-17T09:00'), frequency: 'yearly', month: 2, day: 30 }, timeZone);

  assert.equal(weekly.ok, false);
  assert.equal(yearly.ok, false);
});

test('uses non-technical recurrence summaries in read-only event details', () => {
  assert.equal(recurrenceSummary(rule({ frequency: 'weekly', interval: 2, days_of_week: [1, 3, 5] })), '每 2 周 · 周一 周三 周五');
  assert.equal(recurrenceSummary(rule({ frequency: 'monthly', interval: 1, day_of_month: 'last_day' })), '每 1 月 · 月末');
});
