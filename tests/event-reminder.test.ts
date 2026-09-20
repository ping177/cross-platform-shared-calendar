import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultReminderKind,
  detectBrowserTimeZone,
  mapReminderKindForAllDay,
  resolveEventTimeZone,
} from '../src/lib/reminder.ts';
import { buildEventUpdatePayload } from '../src/lib/event-edit-mutation.ts';
import type { EventDraft } from '../src/lib/event-edit-draft.ts';
import type { CalendarEvent, RecurrenceRule } from '../src/types.ts';

const baseEvent: CalendarEvent = {
  id: 'event-1',
  space_id: 'space-1',
  created_by: 'user-1',
  scope: 'shared',
  owner_user_id: null,
  title: 'Original title',
  description: 'Original description',
  starts_at: '2026-09-20T09:00:37.456Z',
  ends_at: '2026-09-20T10:00:42.789Z',
  all_day: false,
  reminder_kind: 'timed_10m_before',
  time_zone: 'Asia/Shanghai',
  reminder_schedule_changed_at: '2026-09-19T00:00:00.000Z',
  recurrence_rule: null,
  series_id: null,
  parent_event_id: null,
  recurrence_until: null,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-19T00:00:00.000Z',
};

const initialDraft: EventDraft = {
  title: baseEvent.title,
  description: baseEvent.description ?? '',
  audience: 'shared',
  startsAt: '2026-09-20T17:00',
  endsAt: '2026-09-20T18:00',
  allDay: false,
  reminderKind: 'timed_10m_before',
  recurrence: {
    frequency: 'none',
    interval: 1,
    days_of_week: [7],
    day_of_month: 20,
    month: 9,
    day: 20,
  },
};

test('new Event reminder defaults follow timed and all-day semantics', () => {
  assert.equal(defaultReminderKind(false), 'timed_10m_before');
  assert.equal(defaultReminderKind(true), 'all_day_same_day_08');
});

test('all-day conversion maps non-null reminders and preserves null', () => {
  assert.equal(mapReminderKindForAllDay(null, true), null);
  assert.equal(mapReminderKindForAllDay('timed_at_start', true), 'all_day_same_day_08');
  assert.equal(mapReminderKindForAllDay('all_day_previous_day_20', false), 'timed_10m_before');
});

test('timezone detection returns a controlled failure instead of UTC fallback', () => {
  assert.deepEqual(detectBrowserTimeZone(() => 'Asia/Shanghai'), { ok: true, timeZone: 'Asia/Shanghai' });
  assert.deepEqual(detectBrowserTimeZone(() => 'Not/A_Time_Zone'), {
    ok: false,
    error: '无法获取有效的设备时区，请检查系统设置后重试。',
  });
  assert.deepEqual(detectBrowserTimeZone(() => { throw new Error('unavailable'); }), {
    ok: false,
    error: '无法获取有效的设备时区，请检查系统设置后重试。',
  });
});

test('existing canonical timezone survives device timezone changes', () => {
  assert.deepEqual(resolveEventTimeZone(baseEvent, true, () => 'America/New_York'), {
    ok: true,
    timeZone: 'Asia/Shanghai',
  });
});

test('historical null timezone remains null unless capture is explicitly required', () => {
  const historical = { ...baseEvent, reminder_kind: null, time_zone: null };
  assert.deepEqual(resolveEventTimeZone(historical, false, () => { throw new Error('must not detect'); }), {
    ok: true,
    timeZone: null,
  });
  assert.deepEqual(resolveEventTimeZone(historical, true, () => 'Asia/Tokyo'), {
    ok: true,
    timeZone: 'Asia/Tokyo',
  });
});

test('existing recurring Event keeps its authoritative recurrence timezone', () => {
  const recurrenceRule: RecurrenceRule = {
    version: 1,
    frequency: 'daily',
    interval: 1,
    time_zone: 'Europe/Paris',
  };
  const recurring = { ...baseEvent, reminder_kind: null, time_zone: 'Europe/Paris', recurrence_rule: recurrenceRule };
  assert.deepEqual(resolveEventTimeZone(recurring, true, () => 'America/New_York'), {
    ok: true,
    timeZone: 'Europe/Paris',
  });
});

test('title-only update omits every schedule and identity field', () => {
  const payload = buildEventUpdatePayload(
    baseEvent,
    initialDraft,
    { ...initialDraft, title: 'Edited title' },
    null,
    'Asia/Shanghai',
    (value) => `iso:${value}`,
  );

  assert.deepEqual(payload, { title: 'Edited title' });
  for (const field of [
    'starts_at', 'ends_at', 'all_day', 'reminder_kind', 'time_zone', 'recurrence_rule',
    'space_id', 'created_by', 'scope', 'owner_user_id', 'reminder_schedule_changed_at',
  ]) {
    assert.equal(field in payload, false);
  }
});

test('datetime fields are written only when their initial form values change', () => {
  assert.deepEqual(buildEventUpdatePayload(
    baseEvent,
    initialDraft,
    { ...initialDraft, endsAt: '2026-09-20T18:30' },
    null,
    'Asia/Shanghai',
    (value) => `iso:${value}`,
  ), { ends_at: 'iso:2026-09-20T18:30' });
});

test('enabling a historical Reminder captures timezone and disabling keeps it', () => {
  const historical = { ...baseEvent, reminder_kind: null, time_zone: null };
  const historicalDraft = { ...initialDraft, reminderKind: null };
  assert.deepEqual(buildEventUpdatePayload(
    historical,
    historicalDraft,
    { ...historicalDraft, reminderKind: 'timed_30m_before' },
    null,
    'Asia/Tokyo',
    (value) => `iso:${value}`,
  ), {
    reminder_kind: 'timed_30m_before',
    time_zone: 'Asia/Tokyo',
  });

  assert.deepEqual(buildEventUpdatePayload(
    baseEvent,
    initialDraft,
    { ...initialDraft, reminderKind: null },
    null,
    'Asia/Shanghai',
    (value) => `iso:${value}`,
  ), { reminder_kind: null });
});
