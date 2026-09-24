import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarSpaces, completeRows, readAggregateCalendar, spaceLabel, type CalendarFilter } from '../src/lib/aggregate-calendar.ts';
import { expandRecurringEvents } from '../src/lib/recurrence.ts';
import type { CalendarEvent, CurrentSpace, EventOccurrenceException, SpaceMember } from '../src/types.ts';

const personal = { id: 'personal', kind: 'personal', name: '私人', membershipRole: 'owner' } as CurrentSpace;
const shared = { id: 'shared', kind: 'shared', name: '旅行', membershipRole: 'member' } as CurrentSpace;
const event = (id: string, space_id: string, recurring = false) => ({ id, space_id, recurrence_rule: recurring ? { version: 1, frequency: 'daily', interval: 1, time_zone: 'Asia/Shanghai' } : null }) as CalendarEvent;
const member = (space_id: string, user_id: string) => ({ space_id, user_id, profiles: { display_name: user_id } }) as SpaceMember;

test('Calendar filter defaults to all and validates without changing selected Space', () => {
  const selectedSpaceId = shared.id;
  assert.deepEqual(calendarSpaces([personal, shared], 'all'), [personal, shared]);
  assert.deepEqual(calendarSpaces([personal, shared], { spaceId: personal.id }), [personal]);
  assert.deepEqual(calendarSpaces([personal, shared], { spaceId: shared.id }), [shared]);
  const invalid: CalendarFilter = { spaceId: 'former' };
  assert.deepEqual(calendarSpaces([personal, shared], invalid), [personal, shared]);
  assert.equal(selectedSpaceId, shared.id);
  assert.equal(spaceLabel(personal), '我的空间');
  assert.equal(spaceLabel(shared), '共享空间 · 旅行');
});

test('completeRows reads 500-row pages and rejects duplicates, wrong Space and count drift', async () => {
  const rows = Array.from({ length: 501 }, (_, index) => event(String(index), personal.id));
  const page = async (start: number, end: number) => ({ data: rows.slice(start, end + 1), count: rows.length, error: null });
  assert.equal((await completeRows(page, (item) => item.id, (item) => item.space_id === personal.id)).length, 501);
  await assert.rejects(completeRows(async (start, end) => ({ data: start ? [rows[0]] : rows.slice(start, end + 1), count: 501, error: null }), (item) => item.id));
  await assert.rejects(completeRows(async () => ({ data: [event('x', shared.id)], count: 1, error: null }), (item) => item.id, (item) => item.space_id === personal.id));
  await assert.rejects(completeRows(async () => ({ data: [rows[0]], count: 2, error: null }), (item) => item.id));
});

test('aggregate read keeps canonical cross-Space identity and batches recurring exception IDs', async () => {
  const events = [event('p1', personal.id), ...Array.from({ length: 101 }, (_, index) => event(`s${index}`, shared.id, true))];
  const batchSizes: number[] = [];
  const result = await readAggregateCalendar([personal, shared], {
    eventPage: async (spaceId, start, end) => ({ data: events.filter((item) => item.space_id === spaceId).slice(start, end + 1), count: events.filter((item) => item.space_id === spaceId).length, error: null }),
    exceptionPage: async (ids, start, end) => {
      batchSizes.push(ids.length);
      const rows = ids.map((id) => ({ id: `exception-${id}`, event_id: id, occurrence_date: '2026-09-24' }) as EventOccurrenceException);
      return { data: rows.slice(start, end + 1), count: rows.length, error: null };
    },
    members: async (spaceId) => [member(spaceId, 'user-a')],
  });
  assert.equal(result.events.length, 102);
  assert.deepEqual(result.events.slice(0, 2).map((item) => item.space_id), ['personal', 'shared']);
  assert.deepEqual(batchSizes, [100, 1]);
  assert.equal(result.exceptions.length, 101);
  assert.equal(result.membersBySpaceId[personal.id][0].space_id, personal.id);
});

test('aggregate read rejects Event, exception and member failures without partial result', async () => {
  const operations = {
    eventPage: async (spaceId: string) => ({ data: [event(spaceId, spaceId, true)], count: 1, error: null }),
    exceptionPage: async () => ({ data: [] as EventOccurrenceException[], count: 0, error: null }),
    members: async (spaceId: string) => [member(spaceId, 'user-a')],
  };
  await assert.rejects(readAggregateCalendar([personal, shared], { ...operations, eventPage: async (spaceId) => spaceId === shared.id ? { data: [], count: null, error: new Error('event failure') } : operations.eventPage(spaceId) }));
  await assert.rejects(readAggregateCalendar([personal, shared], { ...operations, exceptionPage: async () => ({ data: [], count: null, error: new Error('exception failure') }) }));
  await assert.rejects(readAggregateCalendar([personal, shared], { ...operations, members: async (spaceId) => { if (spaceId === shared.id) throw new Error('members failure'); return operations.members(spaceId); } }));
  await assert.rejects(readAggregateCalendar([shared], {
    eventPage: async () => ({ data: [{ ...event('owned', shared.id), scope: 'personal', owner_user_id: 'former-member' }], count: 1, error: null }),
    exceptionPage: operations.exceptionPage,
    members: operations.members,
  }));
});

test('exception pagination and identity checks reject incomplete or mismatched batches', async () => {
  const many = Array.from({ length: 501 }, (_, index) => ({ id: `x${index}`, event_id: 'source', occurrence_date: `2026-09-${String(index + 1).padStart(3, '0')}` }) as EventOccurrenceException);
  const base = {
    eventPage: async () => ({ data: [event('source', personal.id, true)], count: 1, error: null }),
    members: async () => [member(personal.id, 'user-a')],
  };
  const complete = await readAggregateCalendar([personal], { ...base, exceptionPage: async (_ids, start, end) => ({ data: many.slice(start, end + 1), count: many.length, error: null }) });
  assert.equal(complete.exceptions.length, 501);
  await assert.rejects(readAggregateCalendar([personal], { ...base, exceptionPage: async (_ids, start) => ({ data: start ? [many[0]] : many.slice(0, 500), count: 501, error: null }) }));
  await assert.rejects(readAggregateCalendar([personal], { ...base, exceptionPage: async () => ({ data: [{ ...many[0], event_id: 'other' }], count: 1, error: null }) }));
});

test('aggregate recurrence preserves source Space and only-this exceptions across Spaces', () => {
  const date = new Date(2026, 8, 24, 9).toISOString();
  const source = (id: string, space_id: string) => ({ ...event(id, space_id, true), starts_at: date, ends_at: null, title: id, description: null, all_day: false, recurrence_until: null });
  const events = [source('personal-series', personal.id), source('shared-series', shared.id)] as CalendarEvent[];
  const exceptions = [
    { id: 'x', event_id: 'personal-series', occurrence_date: '2026-09-25', exception_type: 'deleted', override_data: null },
    { id: 'y', event_id: 'shared-series', occurrence_date: '2026-09-25', exception_type: 'override', override_data: { title: '仅本次改名' } },
  ] as EventOccurrenceException[];
  const range = { start: new Date(2026, 8, 24), end: new Date(2026, 8, 26) };
  const projected = expandRecurringEvents(events, range, exceptions);
  assert.deepEqual(projected.errors, []);
  assert.equal(projected.occurrences.filter((item) => item.source_event.space_id === personal.id).length, 1);
  assert.equal(projected.occurrences.filter((item) => item.source_event.space_id === shared.id).length, 2);
  assert.equal(projected.occurrences.find((item) => item.source_event_id === 'shared-series' && item.occurrence_date === '2026-09-25')?.title, '仅本次改名');
  assert.notEqual(projected.occurrences[0].occurrence_id, projected.occurrences[1].occurrence_id);
});

test('this-and-future child keeps its source Space beside another Space series', () => {
  const start = new Date(2026, 8, 24, 9).toISOString();
  const split = new Date(2026, 8, 25, 9).toISOString();
  const rule = { version: 1, frequency: 'daily', interval: 1, time_zone: 'Asia/Shanghai' } as const;
  const old = { ...event('old', shared.id, true), starts_at: start, recurrence_rule: rule, recurrence_until: split, ends_at: null, title: '旧', description: null, all_day: false } as CalendarEvent;
  const child = { ...old, id: 'child', starts_at: split, recurrence_until: null, series_id: 'old', parent_event_id: 'old', title: '新' } as CalendarEvent;
  const other = { ...old, id: 'other', space_id: personal.id, recurrence_until: null } as CalendarEvent;
  const projected = expandRecurringEvents([old, child, other], { start: new Date(2026, 8, 24), end: new Date(2026, 8, 26) });
  assert.deepEqual(projected.errors, []);
  assert.deepEqual(projected.occurrences.filter((item) => item.source_event.space_id === shared.id).map((item) => item.source_event_id), ['old', 'child']);
  assert.equal(projected.occurrences.filter((item) => item.source_event.space_id === personal.id).length, 2);
});
