import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  validateImportantDateFields,
  resolveImportantDateOccurrence,
  nextImportantDateOccurrence,
  deriveImportantDateDisplay,
} from '../supabase/functions/_shared/important-date.ts';
import type { CivilDate, ImportantDateFields } from '../supabase/functions/_shared/important-date.ts';

const date = (year: number, month: number, day: number): CivilDate => ({ year, month, day });
const annual = (year: number | null, month: number, day: number): ImportantDateFields => ({ repeat_kind: 'annual', year, month, day });
const once = (year: number, month: number, day: number): ImportantDateFields => ({ repeat_kind: 'none', year, month, day });

test('validates annual optional year and non-repeat full date without normalizing overflow', () => {
  for (const fields of [annual(null, 2, 29), annual(2028, 2, 29), once(2028, 2, 29), annual(2030, 9, 30)]) {
    assert.deepEqual(validateImportantDateFields(fields), { ok: true, value: fields });
  }
  for (const fields of [
    annual(2027, 2, 29), once(2027, 2, 29), { ...once(2028, 2, 29), year: null },
    annual(null, 2, 30), once(2026, 4, 31), annual(null, 0, 1), annual(null, 13, 1),
    annual(null, 1, 0), annual(null, 1, 32), annual(null, 1.5, 1), annual(0, 1, 1),
    annual(-1, 1, 1), annual(2026.5, 1, 1), annual(Number.MAX_SAFE_INTEGER, 1, 1),
    { ...annual(2026, 1, 1), repeat_kind: 'monthly' },
    { ...annual(2026, 1, 1), day: '1' }, { ...annual(2026, 1, 1), year: undefined },
    null, [], '2026-01-01', {},
  ]) assert.equal(validateImportantDateFields(fields).ok, false, JSON.stringify(fields));
});

test('Gregorian century leap rules apply both to anchors and annual fallback', () => {
  for (const year of [4, 400, 2000, 2400]) {
    assert.equal(validateImportantDateFields(annual(year, 2, 29)).ok, true);
    assert.deepEqual(resolveImportantDateOccurrence(annual(null, 2, 29), year), date(year, 2, 29));
  }
  for (const year of [100, 1900, 2100, 2200]) {
    assert.equal(validateImportantDateFields(annual(year, 2, 29)).ok, false);
    assert.deepEqual(resolveImportantDateOccurrence(annual(null, 2, 29), year), date(year, 2, 28));
  }
});

test('2028 leap anchor excludes 2027 and resolves its exact first date and later fallback', () => {
  const fields = annual(2028, 2, 29);
  assert.equal(resolveImportantDateOccurrence(fields, 2027), null);
  assert.deepEqual(resolveImportantDateOccurrence(fields, 2028), date(2028, 2, 29));
  assert.deepEqual(resolveImportantDateOccurrence(fields, 2029), date(2029, 2, 28));
  assert.deepEqual(nextImportantDateOccurrence(fields, date(2027, 2, 28)), date(2028, 2, 29));
  assert.deepEqual(deriveImportantDateDisplay(fields, date(2029, 2, 28)), {
    kind: 'anniversary', nextOccurrence: date(2029, 2, 28), daysUntil: 0, anniversary: 1, dayCount: 366,
  });
});

test('future start year produces only the true anchor and a nonnegative countdown', () => {
  const fields = annual(2030, 9, 30);
  for (const year of [2026, 2027, 2028, 2029]) {
    assert.equal(resolveImportantDateOccurrence(fields, year), null);
    assert.deepEqual(nextImportantDateOccurrence(fields, date(year, 9, 30)), date(2030, 9, 30));
  }
  assert.deepEqual(deriveImportantDateDisplay(fields, date(2026, 9, 30)), {
    kind: 'countdown', nextOccurrence: date(2030, 9, 30), daysUntil: 1461,
  });
  assert.deepEqual(resolveImportantDateOccurrence(fields, 2030), date(2030, 9, 30));
});

test('anchor day is Day 1 with a positive first-anniversary secondary target', () => {
  assert.deepEqual(deriveImportantDateDisplay(annual(2028, 2, 29), date(2028, 2, 29)), {
    kind: 'day-count', nextOccurrence: date(2028, 2, 29), daysUntil: 0, dayCount: 1,
    nextAnniversary: { years: 1, date: date(2029, 2, 28), daysUntil: 365 },
  });
  const followingDay = deriveImportantDateDisplay(annual(2028, 2, 29), date(2028, 3, 1));
  assert.equal(followingDay.kind === 'day-count' ? followingDay.dayCount : null, 2);
});

test('anniversaries use resolved calendar dates, not integer multiples of 365 days', () => {
  assert.deepEqual(deriveImportantDateDisplay(annual(2023, 3, 1), date(2024, 2, 29)), {
    kind: 'day-count', nextOccurrence: date(2024, 3, 1), daysUntil: 1, dayCount: 366,
    nextAnniversary: { years: 1, date: date(2024, 3, 1), daysUntil: 1 },
  });
  assert.deepEqual(deriveImportantDateDisplay(annual(2023, 3, 1), date(2024, 3, 1)), {
    kind: 'anniversary', nextOccurrence: date(2024, 3, 1), daysUntil: 0, anniversary: 1, dayCount: 367,
  });
  const eighth = deriveImportantDateDisplay(annual(2020, 2, 29), date(2028, 2, 29));
  assert.equal(eighth.kind === 'anniversary' ? eighth.anniversary : null, 8);
});

test('yearless annual has countdown/today only, never age or an anniversary', () => {
  const fields = annual(null, 2, 29);
  assert.deepEqual(deriveImportantDateDisplay(fields, date(2029, 2, 27)), {
    kind: 'countdown', nextOccurrence: date(2029, 2, 28), daysUntil: 1,
  });
  assert.deepEqual(deriveImportantDateDisplay(fields, date(2029, 2, 28)), {
    kind: 'today', nextOccurrence: date(2029, 2, 28), daysUntil: 0,
  });
  assert.deepEqual(nextImportantDateOccurrence(fields, date(2029, 3, 1)), date(2030, 2, 28));
});

test('non-repeat future/today/Past retains the exact date and elapsed days exclude Day 1', () => {
  const fields = once(2026, 9, 30);
  assert.equal(resolveImportantDateOccurrence(fields, 2025), null);
  assert.deepEqual(resolveImportantDateOccurrence(fields, 2026), date(2026, 9, 30));
  assert.equal(resolveImportantDateOccurrence(fields, 2027), null);
  assert.deepEqual(deriveImportantDateDisplay(fields, date(2026, 9, 29)), {
    kind: 'countdown', nextOccurrence: date(2026, 9, 30), daysUntil: 1,
  });
  assert.deepEqual(deriveImportantDateDisplay(fields, date(2026, 9, 30)), {
    kind: 'today', nextOccurrence: date(2026, 9, 30), daysUntil: 0,
  });
  assert.equal(nextImportantDateOccurrence(fields, date(2026, 10, 1)), null);
  assert.deepEqual(deriveImportantDateDisplay(fields, date(2026, 10, 1)), {
    kind: 'past', nextOccurrence: null, originalDate: date(2026, 9, 30), elapsedDays: 1,
  });
});

test('next occurrence includes today and advances across the year boundary only afterwards', () => {
  const fields = annual(null, 12, 31);
  assert.deepEqual(nextImportantDateOccurrence(fields, date(2026, 12, 31)), date(2026, 12, 31));
  assert.deepEqual(nextImportantDateOccurrence(fields, date(2027, 1, 1)), date(2027, 12, 31));
  assert.deepEqual(nextImportantDateOccurrence(annual(null, 1, 1), date(2026, 12, 31)), date(2027, 1, 1));
  const followingDay = deriveImportantDateDisplay(annual(2026, 12, 31), date(2027, 1, 1));
  assert.equal(followingDay.kind === 'day-count' ? followingDay.dayCount : null, 2);
});

test('civil-day differences cross DST and leap boundaries without midnight durations', () => {
  for (const [start, end, days] of [
    [date(2026, 3, 7), date(2026, 3, 9), 2],
    [date(2026, 10, 31), date(2026, 11, 2), 2],
    [date(2024, 2, 28), date(2024, 3, 1), 2],
    [date(2023, 2, 28), date(2023, 3, 1), 1],
    [date(1899, 12, 31), date(1900, 3, 1), 60],
    [date(1999, 12, 31), date(2000, 3, 1), 61],
  ] as const) {
    const past = deriveImportantDateDisplay(once(start.year, start.month, start.day), end);
    const countUp = deriveImportantDateDisplay(annual(start.year, start.month, start.day), end);
    assert.equal(past.kind === 'past' ? past.elapsedDays : null, days);
    assert.equal(countUp.kind === 'day-count' ? countUp.dayCount : null, days + 1);
  }
});

test('small years are literal Gregorian years and do not acquire the JS 1900 offset', () => {
  assert.deepEqual(nextImportantDateOccurrence(annual(1, 1, 1), date(1, 1, 1)), date(1, 1, 1));
  assert.deepEqual(resolveImportantDateOccurrence(annual(4, 2, 29), 5), date(5, 2, 28));
  const century = deriveImportantDateDisplay(once(99, 12, 31), date(100, 1, 1));
  const leap = deriveImportantDateDisplay(once(4, 2, 28), date(4, 3, 1));
  assert.equal(century.kind === 'past' ? century.elapsedDays : null, 1);
  assert.equal(leap.kind === 'past' ? leap.elapsedDays : null, 2);
});

test('annual next year has no timestamp or four-digit-year overflow', () => {
  assert.deepEqual(nextImportantDateOccurrence(annual(9999, 1, 1), date(9999, 12, 31)), date(10000, 1, 1));
  assert.deepEqual(resolveImportantDateOccurrence(annual(9999, 1, 1), 10000), date(10000, 1, 1));
  assert.deepEqual(deriveImportantDateDisplay(once(9999, 12, 31), date(10000, 1, 1)), {
    kind: 'past', nextOccurrence: null, originalDate: date(9999, 12, 31), elapsedDays: 1,
  });
});

test('civil display results are identical under UTC, New York DST and Auckland timezones', () => {
  const moduleUrl = new URL('../supabase/functions/_shared/important-date.ts', import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import { deriveImportantDateDisplay } from ${JSON.stringify(moduleUrl)};
    for (const [month, startDay, endDay] of [[3, 7, 9], [11, 1, 3]]) {
      assert.deepEqual(deriveImportantDateDisplay(
        { repeat_kind: 'none', year: 2026, month, day: startDay },
        { year: 2026, month, day: endDay }
      ), { kind: 'past', nextOccurrence: null, originalDate: { year: 2026, month, day: startDay }, elapsedDays: 2 });
    }
    assert.deepEqual(deriveImportantDateDisplay(
      { repeat_kind: 'none', year: 2026, month: 12, day: 31 },
      { year: 2027, month: 1, day: 1 }
    ), { kind: 'past', nextOccurrence: null, originalDate: { year: 2026, month: 12, day: 31 }, elapsedDays: 1 });
  `;
  for (const timeZone of ['UTC', 'America/New_York', 'Pacific/Auckland']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      env: { ...process.env, TZ: timeZone }, encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(result.status, 0, `${timeZone}: ${result.stderr || result.error?.message}`);
  }
});

test('invalid fields, target years and explicit today dates fail instead of overflowing', () => {
  assert.throws(() => resolveImportantDateOccurrence(annual(2027, 2, 29), 2028), RangeError);
  for (const year of [0, -1, 2026.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => resolveImportantDateOccurrence(annual(null, 1, 1), year), RangeError);
  }
  for (const today of [date(2026, 2, 29), date(2026, 13, 1), date(0, 1, 1)]) {
    assert.throws(() => nextImportantDateOccurrence(annual(null, 1, 1), today), RangeError);
    assert.throws(() => deriveImportantDateDisplay(once(2026, 1, 1), today), RangeError);
  }
});

test('helpers leave caller inputs untouched and return fresh date values', () => {
  const fields = Object.freeze(annual(2028, 2, 29));
  const today = Object.freeze(date(2028, 2, 29));
  const next = nextImportantDateOccurrence(fields, today);
  assert.deepEqual(next, today);
  assert.notEqual(next, today);
  deriveImportantDateDisplay(fields, today);
  assert.deepEqual(fields, annual(2028, 2, 29));
  assert.deepEqual(today, date(2028, 2, 29));
});
