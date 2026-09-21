import assert from 'node:assert/strict';
import test from 'node:test';

import { zonedDateTimeToInstant } from '../supabase/functions/_shared/time-zone.ts';

test('converts an ordinary valid local datetime without changing its wall-clock fields', () => {
  assert.equal(zonedDateTimeToInstant({
    year: 2026,
    month: 7,
    day: 18,
    hour: 9,
    minute: 0,
    second: 15,
    millisecond: 123,
  }, 'Asia/Shanghai').toISOString(), '2026-07-18T01:00:15.123Z');
});

test('moves a nonexistent New York wall clock to the existing first-minute-after-gap result', () => {
  assert.equal(zonedDateTimeToInstant({
    year: 2026,
    month: 3,
    day: 8,
    hour: 2,
    minute: 30,
    second: 15,
    millisecond: 123,
  }, 'America/New_York').toISOString(), '2026-03-08T07:00:15.246Z');
});

test('chooses the earlier instant for a repeated New York wall clock', () => {
  assert.equal(zonedDateTimeToInstant({
    year: 2026,
    month: 11,
    day: 1,
    hour: 1,
    minute: 30,
    second: 15,
    millisecond: 123,
  }, 'America/New_York').toISOString(), '2026-11-01T05:30:15.123Z');
});

test('preserves the existing first-minute-after-gap result for a legal two-hour Troll gap', () => {
  assert.equal(zonedDateTimeToInstant({
    year: 2026,
    month: 3,
    day: 29,
    hour: 1,
    minute: 30,
    second: 15,
    millisecond: 123,
  }, 'Antarctica/Troll').toISOString(), '2026-03-29T01:00:15.246Z');
});
