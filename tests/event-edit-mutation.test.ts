import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteMutationRoute, occurrenceOverrideRpcArgs, saveMutationRoute } from '../src/lib/event-edit-mutation.ts';
import { eventEditTargetForEvent, eventEditTargetForOccurrence } from '../src/lib/event-edit-target.ts';
import type { CalendarEvent, CalendarOccurrence } from '../src/types.ts';

const event: CalendarEvent = {
  id: 'event-1',
  space_id: 'space-1',
  created_by: 'user-1',
  scope: 'shared',
  owner_user_id: null,
  title: 'Source title',
  description: 'Source description',
  starts_at: '2026-07-20T09:00:00.000Z',
  ends_at: '2026-07-20T10:00:00.000Z',
  all_day: false,
  recurrence_rule: { version: 1, frequency: 'weekly', interval: 1, days_of_week: [1], time_zone: 'Asia/Shanghai' },
  series_id: 'event-1',
  parent_event_id: null,
  recurrence_until: null,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-02T00:00:00.000Z',
};

const occurrence: CalendarOccurrence = {
  occurrence_id: 'event-1:2026-07-27',
  occurrence_date: '2026-07-27',
  source_event_id: event.id,
  occurrence_starts_at: '2026-07-27T11:00:00.000Z',
  occurrence_ends_at: '2026-07-27T12:30:00.000Z',
  title: 'Occurrence title',
  description: 'Occurrence description',
  all_day: true,
  source_event: event,
};

const draft = {
  title: 'Edited occurrence',
  description: 'Edited description',
  audience: 'shared' as const,
  startsAt: '2026-07-27T19:00',
  endsAt: '2026-07-27T20:30',
  allDay: true,
  recurrence: { frequency: 'weekly' as const, interval: 1, days_of_week: [1], day_of_month: 27, month: 7, day: 27 },
};

test('routes an occurrence save to the override RPC', () => {
  assert.equal(saveMutationRoute(eventEditTargetForOccurrence(occurrence)), 'occurrence-override');
});

test('routes a normal event save to events.update', () => {
  assert.equal(saveMutationRoute(eventEditTargetForEvent(event)), 'event-update');
});

test('routes an occurrence delete to the delete_occurrence RPC', () => {
  assert.equal(deleteMutationRoute(eventEditTargetForOccurrence(occurrence)), 'occurrence-delete');
});

test('routes a normal event delete to events.delete', () => {
  assert.equal(deleteMutationRoute(eventEditTargetForEvent(event)), 'event-delete');
});

test('builds an override RPC payload without all_day or recurrence_rule', () => {
  const target = eventEditTargetForOccurrence(occurrence);
  if (target.kind !== 'occurrence') {
    throw new Error('Expected occurrence target');
  }

  const args = occurrenceOverrideRpcArgs(target, draft, (value) => `iso:${value}`);

  assert.deepEqual(args, {
    p_event_id: 'event-1',
    p_occurrence_date: '2026-07-27',
    p_expected_updated_at: '2026-07-02T00:00:00.000Z',
    p_override_data: {
      title: 'Edited occurrence',
      description: 'Edited description',
      starts_at: 'iso:2026-07-27T19:00',
      ends_at: 'iso:2026-07-27T20:30',
    },
  });
  assert.equal('all_day' in args.p_override_data, false);
  assert.equal('recurrence_rule' in args.p_override_data, false);
});
