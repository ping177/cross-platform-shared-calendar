import assert from 'node:assert/strict';
import test from 'node:test';
import { eventEditUiState, occurrenceActionCopy } from '../src/lib/event-edit-ui.ts';
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
  assert.equal(state.showOccurrenceScope, false);
  assert.deepEqual(state.occurrenceScopes, []);
});

test('restricts recurrence and all-day edits for an occurrence target', () => {
  const state = eventEditUiState(eventEditTargetForOccurrence(occurrence));

  assert.equal(state.canEditRecurrence, false);
  assert.equal(state.canEditAllDay, false);
});

test('offers exactly only-this and this-and-future scopes for an occurrence', () => {
  const state = eventEditUiState(eventEditTargetForOccurrence(occurrence));

  assert.equal(state.showOccurrenceScope, true);
  assert.deepEqual(state.occurrenceScopes, ['only-this', 'this-and-future']);
  assert.equal(state.occurrenceScopes.includes('all-series' as never), false);
});

test('uses action-specific chooser copy for both occurrence scopes', () => {
  assert.deepEqual(occurrenceActionCopy('save', 'only-this'), {
    title: '选择修改范围',
    label: '仅修改当前事件',
  });
  assert.deepEqual(occurrenceActionCopy('save', 'this-and-future'), {
    title: '选择修改范围',
    label: '修改当前及未来事件',
  });
  assert.deepEqual(occurrenceActionCopy('delete', 'only-this'), {
    title: '选择删除范围',
    label: '仅删除当前事件',
  });
  assert.deepEqual(occurrenceActionCopy('delete', 'this-and-future'), {
    title: '选择删除范围',
    label: '删除当前及未来事件',
  });
});
