import assert from 'node:assert/strict';
import test from 'node:test';
import { draftFromEditTarget } from '../src/lib/event-edit-draft.ts';
import { eventEditTargetForEvent, eventEditTargetForOccurrence } from '../src/lib/event-edit-target.ts';
import { toDateInputValue } from '../src/lib/date.ts';
import type { CalendarEvent, CalendarOccurrence } from '../src/types.ts';

const sourceEvent: CalendarEvent = {
  id: 'event-1',
  space_id: 'space-1',
  created_by: 'user-1',
  scope: 'personal',
  owner_user_id: 'user-1',
  title: 'A',
  description: 'source description',
  starts_at: '2026-07-18T09:00:00.000Z',
  ends_at: '2026-07-18T10:00:00.000Z',
  all_day: false,
  recurrence_rule: { version: 1, frequency: 'weekly', interval: 1, days_of_week: [6], time_zone: 'Asia/Shanghai' },
  series_id: 'event-1',
  parent_event_id: null,
  recurrence_until: null,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

const sourceDraft = {
  title: 'A',
  description: 'source description',
  audience: 'mine' as const,
  startsAt: toDateInputValue(new Date(sourceEvent.starts_at)),
  endsAt: toDateInputValue(new Date(sourceEvent.ends_at!)),
  allDay: false,
  recurrence: { frequency: 'weekly' as const, interval: 1, days_of_week: [6], day_of_month: 18, month: 7, day: 18 },
};

test('hydrates a normal event draft from the source event baseline', () => {
  const draft = draftFromEditTarget(eventEditTargetForEvent(sourceEvent), sourceDraft, toDateInputValue);

  assert.equal(draft.title, 'A');
  assert.equal(draft.description, 'source description');
  assert.equal(draft.startsAt, toDateInputValue(new Date(sourceEvent.starts_at)));
  assert.equal(draft.endsAt, toDateInputValue(new Date(sourceEvent.ends_at!)));
  assert.equal(draft.allDay, false);
  assert.deepEqual(draft.recurrence, { frequency: 'weekly', interval: 1, days_of_week: [6], day_of_month: 18, month: 7, day: 18 });
});

test('hydrates a recurring occurrence draft from its display values without changing the source recurrence rule', () => {
  const occurrence: CalendarOccurrence = {
    occurrence_id: 'event-1:2026-07-25',
    occurrence_date: '2026-07-25',
    source_event_id: sourceEvent.id,
    occurrence_starts_at: '2026-07-25T11:00:00.000Z',
    occurrence_ends_at: '2026-07-25T12:30:00.000Z',
    title: 'B',
    description: 'overridden description',
    all_day: true,
    source_event: sourceEvent,
  };
  const sourceRule = structuredClone(sourceEvent.recurrence_rule);

  const draft = draftFromEditTarget(eventEditTargetForOccurrence(occurrence), sourceDraft, toDateInputValue);

  assert.equal(draft.title, 'B');
  assert.equal(draft.description, 'overridden description');
  assert.equal(draft.startsAt, toDateInputValue(new Date(occurrence.occurrence_starts_at)));
  assert.equal(draft.endsAt, toDateInputValue(new Date(occurrence.occurrence_ends_at!)));
  assert.notEqual(draft.startsAt, toDateInputValue(new Date(sourceEvent.starts_at)));
  assert.equal(draft.allDay, true);
  assert.deepEqual(sourceEvent.recurrence_rule, sourceRule);
  assert.deepEqual(draft.recurrence, { frequency: 'weekly', interval: 1, days_of_week: [6], day_of_month: 18, month: 7, day: 18 });
});
