import assert from 'node:assert/strict';
import test from 'node:test';
import { eventEditUiState } from '../src/lib/event-edit-ui.ts';
import { eventEditTargetForEvent, eventEditTargetForOccurrence } from '../src/lib/event-edit-target.ts';
import type { CalendarEvent, CalendarOccurrence } from '../src/types.ts';

const recurringEvent: CalendarEvent = {
  id: 'event-1',
  space_id: 'space-1',
  created_by: 'user-1',
  scope: 'shared',
  owner_user_id: null,
  title: 'Weekly sync',
  description: null,
  starts_at: '2026-07-20T09:00:00.000Z',
  ends_at: null,
  all_day: false,
  recurrence_rule: { version: 1, frequency: 'weekly', interval: 1, days_of_week: [1], time_zone: 'Asia/Shanghai' },
  series_id: 'event-1',
  parent_event_id: null,
  recurrence_until: null,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

const occurrence: CalendarOccurrence = {
  occurrence_id: 'event-1:2026-07-27',
  occurrence_date: '2026-07-27',
  source_event_id: recurringEvent.id,
  occurrence_starts_at: '2026-07-27T09:00:00.000Z',
  occurrence_ends_at: null,
  title: recurringEvent.title,
  description: recurringEvent.description,
  all_day: recurringEvent.all_day,
  source_event: recurringEvent,
};

test('marks an occurrence target as an only-this recurring edit', () => {
  const state = eventEditUiState(eventEditTargetForOccurrence(occurrence));

  assert.equal(state.isRecurringOccurrenceEdit, true);
});

test('keeps a normal event target outside the only-this edit state', () => {
  const state = eventEditUiState(eventEditTargetForEvent(recurringEvent));

  assert.equal(state.isRecurringOccurrenceEdit, false);
});

test('restricts recurrence and all-day edits for an occurrence target', () => {
  const state = eventEditUiState(eventEditTargetForOccurrence(occurrence));

  assert.equal(state.canEditRecurrence, false);
  assert.equal(state.canEditAllDay, false);
});
