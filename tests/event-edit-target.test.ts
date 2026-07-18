import assert from 'node:assert/strict';
import test from 'node:test';
import { eventEditTargetForEvent, eventEditTargetForOccurrence } from '../src/lib/event-edit-target.ts';
import type { CalendarEvent, CalendarOccurrence } from '../src/types.ts';

const event: CalendarEvent = {
  id: 'event-1',
  space_id: 'space-1',
  created_by: 'user-1',
  scope: 'shared',
  owner_user_id: null,
  title: 'Weekly sync',
  description: null,
  starts_at: '2026-07-20T09:00:00.000Z',
  ends_at: '2026-07-20T10:00:00.000Z',
  all_day: false,
  recurrence_rule: { version: 1, frequency: 'weekly', interval: 1, days_of_week: [1], time_zone: 'Asia/Shanghai' },
  series_id: 'event-1',
  parent_event_id: null,
  recurrence_until: null,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

test('occurrence edit target preserves the occurrence identity and display metadata', () => {
  const occurrence: CalendarOccurrence = {
    occurrence_id: 'event-1:2026-07-27',
    occurrence_date: '2026-07-27',
    source_event_id: event.id,
    occurrence_starts_at: '2026-07-27T09:00:00.000Z',
    occurrence_ends_at: '2026-07-27T10:00:00.000Z',
    title: event.title,
    description: event.description,
    all_day: event.all_day,
    source_event: event,
  };

  const target = eventEditTargetForOccurrence(occurrence);

  assert.equal(target.kind, 'occurrence');
  assert.equal(target.event, event);
  assert.equal(target.occurrence.occurrence_id, 'event-1:2026-07-27');
  assert.equal(target.occurrence.occurrence_date, '2026-07-27');
  assert.equal(target.occurrence.title, 'Weekly sync');
  assert.equal(target.occurrence.description, null);
  assert.equal(target.occurrence.occurrence_starts_at, '2026-07-27T09:00:00.000Z');
  assert.equal(target.occurrence.occurrence_ends_at, '2026-07-27T10:00:00.000Z');
  assert.equal(target.occurrence.all_day, false);
});

test('normal event edit target has no occurrence context', () => {
  const target = eventEditTargetForEvent(event);

  assert.equal(target.kind, 'event');
  assert.equal(target.event, event);
  assert.equal('occurrence' in target, false);
});
