import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { ImportantDate } from '../src/types.ts';
import { resolveImportantDateOccurrence } from '../supabase/functions/_shared/important-date.ts';
import { calendarVisibleRange } from '../src/lib/calendar-display.ts';
import { expandRecurringEvents } from '../src/lib/recurrence.ts';

const civil = (year: number, month: number, day: number) => ({ year, month, day });
const row = (id: string, patch: Partial<ImportantDate> = {}): ImportantDate => ({
  id, space_id: 'shared', name: '同名', emoji: '❤️', repeat_kind: 'annual', year: null, month: 2, day: 29,
  reminder_kind: null, time_zone: 'Asia/Shanghai', created_by: 'me', created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', reminder_schedule_changed_at: '2026-01-01T00:00:00Z', ...patch,
});
const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' } as any);
test.after(() => vite.close());
const projection = await vite.ssrLoadModule('/src/lib/important-date-projection.ts');

test('Home derives 0/1/3/>3 with global date order, ID ties and no past non-repeat', () => {
  const today = civil(2027, 2, 27);
  const dates = [row('b'), row('a', { space_id: 'personal' }), row('c', { repeat_kind: 'none', year: 2027, day: 28 }),
    row('far', { year: 2030, month: 9, day: 30 }), row('past', { repeat_kind: 'none', year: 2026, day: 28 })];
  for (const size of [0, 1, 3, 5]) {
    const result = projection.homeImportantDates(dates.slice(0, size), today);
    assert.equal(result.length, Math.min(size, 3));
    assert.ok(result.every((item: any) => item.importantDateId !== 'past'));
    assert.ok(result.every((item: any) => !('date' in item) && !('source' in item) && !('reminder_kind' in item)));
  }
  const result = projection.homeImportantDates(dates, today);
  assert.deepEqual(result.map((item: any) => item.importantDateId), ['a', 'b', 'c']);
  assert.equal(result[0].primary, '还有 1 天');
  assert.deepEqual(result[0].occurrenceDate, civil(2027, 2, 28));
  assert.deepEqual(projection.homeImportantDates([dates[3]], today)[0].occurrenceDate, civil(2030, 9, 30));
  assert.equal(projection.homeImportantDates([row('old-anchor', { year: 2020, month: 3, day: 1 })], today).length, 1);
});

test('per-Space non-repeat top three plus complete annual sources retains the true global top three', () => {
  const today = civil(2027, 2, 27);
  const all = ['personal', 'shared', 'third'].flatMap((space_id, index) => [
    row(`${space_id}-annual`, { space_id, month: 3, day: 1 + index }),
    ...Array.from({ length: 12 }, (_, day) => row(`${space_id}-${String(day).padStart(2, '0')}`, {
      space_id, repeat_kind: 'none', year: 2027, month: 3, day: day + 1,
    })),
    row(`${space_id}-past`, { space_id, repeat_kind: 'none', year: 2026, month: 1, day: 1 }),
  ]);
  const bounded = ['personal', 'shared', 'third'].flatMap((id) => [
    ...all.filter((date) => date.space_id === id && date.repeat_kind === 'annual'),
    ...all.filter((date) => date.space_id === id && date.repeat_kind === 'none' && date.year === 2027)
      .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id)).slice(0, 3),
  ]);
  assert.deepEqual(projection.homeImportantDates(bounded, today), projection.homeImportantDates(all, today));
});

test('Calendar projects the actual day/week/42-cell grid including cross-month and cross-year edges', () => {
  const sources = [row('dec', { month: 12, day: 31 }), row('jan', { month: 1, day: 1 }),
    row('history', { repeat_kind: 'none', year: 2026, month: 12, day: 29 }),
    row('future', { repeat_kind: 'none', year: 2027, month: 1, day: 2 })];
  for (const view of ['today', 'week', 'month'] as const) {
    const window = calendarVisibleRange(view, new Date(2026, 11, 31));
    const range = { start: civil(window.start.getFullYear(), window.start.getMonth() + 1, window.start.getDate()),
      end: civil(window.end.getFullYear(), window.end.getMonth() + 1, window.end.getDate()) };
    const result = projection.projectImportantDates(sources, range);
    assert.ok(result.some((item: any) => item.importantDateId === 'dec'));
    assert.equal(result.some((item: any) => item.importantDateId === 'jan'), view !== 'today');
    assert.equal(result.some((item: any) => item.importantDateId === 'history'), view !== 'today');
    assert.equal(result.some((item: any) => item.importantDateId === 'future'), view !== 'today');
  }
});

test('annual multi-year projection uses canonical fallback and never precedes the true future anchor', () => {
  const range = { start: civil(2027, 1, 1), end: civil(2030, 12, 31) };
  const sources = [row('yearless'), row('anchored', { year: 2028 }), row('future', { year: 2030, month: 9, day: 30 })];
  const result = projection.projectImportantDates(sources, range);
  for (const source of sources) {
    assert.deepEqual(result.filter((item: any) => item.importantDateId === source.id).map((item: any) => item.occurrenceDate),
      [2027, 2028, 2029, 2030].map((year) => resolveImportantDateOccurrence(source, year)).filter(Boolean));
  }
  assert.equal(result.filter((item: any) => item.importantDateId === 'anchored').length, 3);
  assert.deepEqual(result.find((item: any) => item.importantDateId === 'future').occurrenceDate, civil(2030, 9, 30));
});

test('historical/future non-repeat projections use the real date; identity does not depend on name or Emoji', () => {
  const dates = [row('same', { space_id: 'personal', repeat_kind: 'none', year: 2000, month: 1, day: 1 }),
    row('other', { repeat_kind: 'none', year: 2000, month: 1, day: 1 }),
    row('later', { repeat_kind: 'none', year: 2030, month: 1, day: 1 })];
  const before = structuredClone(dates);
  const range = { start: civil(2000, 1, 1), end: civil(2000, 1, 1) };
  const result = projection.projectImportantDates(dates, range);
  assert.equal(result.length, 2);
  assert.equal(new Set(result.map((item: any) => `${item.spaceId}:${item.importantDateId}:${JSON.stringify(item.occurrenceDate)}`)).size, 2);
  assert.deepEqual(result, projection.projectImportantDates([...dates].reverse(), range));
  assert.equal(projection.projectImportantDates(dates, { start: civil(2030, 1, 1), end: civil(2030, 1, 1) }).length, 1);
  assert.deepEqual(dates, before);
  result[0].occurrenceDate.day = 5;
  assert.deepEqual(dates, before);
});

test('invalid ranges/fields and repeated source identities fail explicitly instead of partial output', () => {
  for (const range of [{ start: civil(2027, 2, 29), end: civil(2027, 3, 1) },
    { start: civil(2027, 3, 1), end: civil(2027, 2, 28) }]) {
    assert.throws(() => projection.projectImportantDates([], range));
  }
  assert.throws(() => projection.projectImportantDates([row('bad', { day: 30 })], { start: civil(2027, 1, 1), end: civil(2027, 12, 31) }));
  assert.throws(() => projection.homeImportantDates([row('a'), row('a')], civil(2027, 1, 1)));
  assert.throws(() => projection.projectImportantDates([row('a'), row('a')], { start: civil(2027, 1, 1), end: civil(2027, 12, 31) }));
});

test('Important Date Feb29 fallback does not change the Event leap-day skip baseline', () => {
  const event = { id: 'event', space_id: 'shared', title: '闰日', description: null, scope: 'shared', owner_user_id: null,
    starts_at: '2024-02-29T00:00:00Z', ends_at: null, all_day: true, recurrence_until: null,
    recurrence_rule: { version: 1, frequency: 'yearly', interval: 1, time_zone: 'UTC' } } as any;
  const events = expandRecurringEvents([event], { start: new Date('2027-02-27T00:00:00Z'), end: new Date('2027-03-01T00:00:00Z') });
  assert.equal(events.occurrences.length, 0);
  assert.deepEqual(projection.projectImportantDates([row('date')], { start: civil(2027, 2, 28), end: civil(2027, 2, 28) })[0].occurrenceDate, civil(2027, 2, 28));
});
