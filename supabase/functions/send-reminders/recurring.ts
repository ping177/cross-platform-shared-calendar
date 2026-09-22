import type { ReminderKind } from '../_shared/reminder-due.ts';
import {
  addLocalDays,
  localParts,
  zonedDateTimeToInstant,
  type LocalDateTime,
} from '../_shared/time-zone.ts';
import {
  expandEventOccurrences,
  scheduledOccurrenceStart,
} from '../../../src/lib/recurrence.ts';
import type {
  CalendarEvent,
  EventOccurrenceException,
  RecurrenceRule,
} from '../../../src/types.ts';

const GRACE_WINDOW_MS = 10 * 60_000;

export type RecurringReminderSource = CalendarEvent & {
  reminder_kind: ReminderKind;
  time_zone: string;
  recurrence_rule: RecurrenceRule;
};

export type RecurringReminderSnapshot = {
  logicalSeriesId: string;
  occurrenceDate: string;
  sourceUpdatedAt: string;
  sourceReminderScheduleChangedAt: string;
  exceptionId: string | null;
  exceptionUpdatedAt: string | null;
  exceptionType: EventOccurrenceException['exception_type'] | null;
  exceptionChangesSchedule: boolean;
};

export type RecurringReminderCandidate = {
  id: string;
  space_id: string;
  scope: 'personal' | 'shared';
  owner_user_id: string | null;
  title: string;
  starts_at: string;
  all_day: boolean;
  reminder_kind: ReminderKind;
  time_zone: string;
  reminder_schedule_changed_at: string;
  recurrence: RecurringReminderSnapshot;
};

type RecurringProjectionResult = {
  candidates: RecurringReminderCandidate[];
  errors: Array<{ source_event_id: string; error: string }>;
};

function localDateOrdinal(value: Pick<LocalDateTime, 'year' | 'month' | 'day'>) {
  return Date.UTC(value.year, value.month - 1, value.day);
}

function earlierLocalDate(left: LocalDateTime, right: LocalDateTime) {
  return localDateOrdinal(left) <= localDateOrdinal(right) ? left : right;
}

function laterLocalDate(left: LocalDateTime, right: LocalDateTime) {
  return localDateOrdinal(left) >= localDateOrdinal(right) ? left : right;
}

function localMidnight(value: Pick<LocalDateTime, 'year' | 'month' | 'day'>) {
  return { ...value, hour: 0, minute: 0, second: 0, millisecond: 0 };
}

export function recurringReminderOccurrenceRange(runNow: Date, timeZone: string) {
  const graceStart = new Date(runNow.getTime() - GRACE_WINDOW_MS);
  const graceLocal = localParts(graceStart, timeZone);
  const nowLocal = localParts(runNow, timeZone);
  const firstDate = earlierLocalDate(graceLocal, nowLocal);
  const lastDueDate = laterLocalDate(graceLocal, nowLocal);
  const afterLastOccurrenceDate = addLocalDays(lastDueDate, 2);
  const endExclusive = zonedDateTimeToInstant(localMidnight(afterLastOccurrenceDate), timeZone);

  return {
    start: zonedDateTimeToInstant(localMidnight(firstDate), timeZone),
    end: new Date(endExclusive.getTime() - 1),
  };
}

export function projectRecurringReminderCandidates(
  sources: RecurringReminderSource[],
  exceptions: EventOccurrenceException[],
  runNow: Date,
): RecurringProjectionResult {
  const candidates: RecurringReminderCandidate[] = [];
  const errors: RecurringProjectionResult['errors'] = [];
  const exceptionsByEvent = new Map<string, EventOccurrenceException[]>();

  for (const exception of exceptions) {
    const eventExceptions = exceptionsByEvent.get(exception.event_id) ?? [];
    eventExceptions.push(exception);
    exceptionsByEvent.set(exception.event_id, eventExceptions);
  }

  for (const source of sources) {
    const eventExceptions = exceptionsByEvent.get(source.id) ?? [];
    const exceptionByDate = new Map(eventExceptions.map((exception) => [exception.occurrence_date, exception]));
    // Reminder discovery depends on occurrence starts, not calendar duration overlap.
    const reminderProjectionSource = { ...source, ends_at: null };
    const expansion = expandEventOccurrences(
      reminderProjectionSource,
      recurringReminderOccurrenceRange(runNow, source.time_zone),
      eventExceptions,
    );

    if (expansion.error !== null) {
      errors.push({ source_event_id: source.id, error: expansion.error });
      continue;
    }

    for (const occurrence of expansion.occurrences) {
      const exception = exceptionByDate.get(occurrence.occurrence_date) ?? null;
      const scheduledStart = scheduledOccurrenceStart(source, occurrence.occurrence_date);
      if (scheduledStart === null) {
        errors.push({ source_event_id: source.id, error: '无法验证重复日程排期。' });
        continue;
      }

      const exceptionChangesSchedule = exception?.exception_type === 'override'
        && new Date(occurrence.occurrence_starts_at).getTime() !== scheduledStart.getTime();

      candidates.push({
        id: source.id,
        space_id: source.space_id,
        scope: source.scope,
        owner_user_id: source.owner_user_id,
        title: occurrence.title,
        starts_at: occurrence.occurrence_starts_at,
        all_day: occurrence.all_day,
        reminder_kind: source.reminder_kind,
        time_zone: source.time_zone,
        reminder_schedule_changed_at: source.reminder_schedule_changed_at,
        recurrence: {
          logicalSeriesId: source.series_id ?? source.id,
          occurrenceDate: occurrence.occurrence_date,
          sourceUpdatedAt: source.updated_at,
          sourceReminderScheduleChangedAt: source.reminder_schedule_changed_at,
          exceptionId: exception?.id ?? null,
          exceptionUpdatedAt: exception?.updated_at ?? null,
          exceptionType: exception?.exception_type ?? null,
          exceptionChangesSchedule,
        },
      });
    }
  }

  candidates.sort((left, right) => (
    left.starts_at.localeCompare(right.starts_at)
    || left.recurrence.logicalSeriesId.localeCompare(right.recurrence.logicalSeriesId)
    || left.recurrence.occurrenceDate.localeCompare(right.recurrence.occurrenceDate)
  ));

  return { candidates, errors };
}
