import { addLocalDays, canonicalTimeZone, localParts, zonedDateTimeToInstant } from './time-zone.ts';

export type ReminderKind =
  | 'timed_at_start'
  | 'timed_10m_before'
  | 'timed_30m_before'
  | 'timed_1h_before'
  | 'timed_previous_day_same_time'
  | 'all_day_same_day_08'
  | 'all_day_previous_day_20';

export type ReminderDueInput = {
  startsAt: string;
  allDay: boolean;
  reminderKind: ReminderKind | null;
  timeZone: string | null;
};

export type ReminderDueResult =
  | { status: 'disabled' }
  | { status: 'invalid'; reason: 'invalid_start' | 'missing_time_zone' | 'invalid_time_zone' | 'kind_event_type_mismatch' }
  | { status: 'scheduled'; dueAt: Date };

const TIMED_OFFSETS = {
  timed_at_start: 0,
  timed_10m_before: 10,
  timed_30m_before: 30,
  timed_1h_before: 60,
} as const;

function isTimedKind(reminderKind: ReminderKind): reminderKind is keyof typeof TIMED_OFFSETS | 'timed_previous_day_same_time' {
  return reminderKind.startsWith('timed_');
}

export function calculateReminderDue(input: ReminderDueInput): ReminderDueResult {
  if (input.reminderKind === null) {
    return { status: 'disabled' };
  }

  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) {
    return { status: 'invalid', reason: 'invalid_start' };
  }

  if (input.timeZone === null || input.timeZone.length === 0) {
    return { status: 'invalid', reason: 'missing_time_zone' };
  }

  const timeZone = canonicalTimeZone(input.timeZone);
  if (timeZone === null || /^[+-]\d{2}:\d{2}$/.test(timeZone)) {
    return { status: 'invalid', reason: 'invalid_time_zone' };
  }

  const timedKind = isTimedKind(input.reminderKind);
  if (timedKind === input.allDay) {
    return { status: 'invalid', reason: 'kind_event_type_mismatch' };
  }

  if (input.reminderKind in TIMED_OFFSETS) {
    const minutes = TIMED_OFFSETS[input.reminderKind as keyof typeof TIMED_OFFSETS];
    return { status: 'scheduled', dueAt: new Date(start.getTime() - minutes * 60_000) };
  }

  const startLocal = localParts(start, timeZone);
  if (input.reminderKind === 'timed_previous_day_same_time') {
    const previousDate = addLocalDays(startLocal, -1);
    return {
      status: 'scheduled',
      dueAt: zonedDateTimeToInstant({ ...startLocal, ...previousDate }, timeZone),
    };
  }

  const previousDay = input.reminderKind === 'all_day_previous_day_20';
  const reminderDate = addLocalDays(startLocal, previousDay ? -1 : 0);
  return {
    status: 'scheduled',
    dueAt: zonedDateTimeToInstant({
      ...reminderDate,
      hour: previousDay ? 20 : 8,
      minute: 0,
      second: 0,
      millisecond: 0,
    }, timeZone),
  };
}
