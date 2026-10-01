import {
  resolveImportantDateOccurrence,
  validateImportantDateFields,
  type CivilDate,
  type ImportantDateFields,
} from '../_shared/important-date.ts';
import { calculateAllDayReminderDue, type AllDayReminderKind } from '../_shared/reminder-due.ts';
import { addLocalDays, canonicalTimeZone, localParts } from '../_shared/time-zone.ts';

const GRACE_WINDOW_MS = 10 * 60_000;

export type ImportantDateReminderSource = ImportantDateFields & {
  id: string;
  space_id: string;
  name: string;
  reminder_kind: AllDayReminderKind | null;
  time_zone: string;
  reminder_schedule_changed_at: string;
};

export type ImportantDateReminderCandidate = {
  source: ImportantDateReminderSource;
  occurrenceDate: string;
  dueAt: Date;
};

function compareDates(left: CivilDate, right: CivilDate) {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

// Pure projection only: source/module/member/subscription/marker eligibility is
// checked later by discovery, classification and the source-specific backend.
export function projectImportantDateReminderCandidates(sources: ImportantDateReminderSource[], runNow: Date) {
  if (!Number.isFinite(runNow.getTime())) throw new RangeError('Invalid Reminder run time');
  const graceStart = new Date(runNow.getTime() - GRACE_WINDOW_MS);
  const candidates: ImportantDateReminderCandidate[] = [];
  const errors: Array<{ important_date_id: string; error: string }> = [];

  for (const source of sources) {
    if (source.reminder_kind === null) continue;
    const timeZone = canonicalTimeZone(source.time_zone);
    if (timeZone === null || /^[+-]\d{2}:\d{2}$/.test(timeZone)) {
      errors.push({ important_date_id: source.id, error: 'invalid_time_zone' });
      continue;
    }
    if (!validateImportantDateFields(source).ok) {
      errors.push({ important_date_id: source.id, error: 'invalid_fields' });
      continue;
    }
    const graceLocal = localParts(graceStart, timeZone);
    const nowLocal = localParts(runNow, timeZone);
    const forward = compareDates(graceLocal, nowLocal) <= 0;
    // Include the prior civil date for a skipped-day gap shifted to midnight,
    // and the following date for previous-day 20:00. UTC filtering is final.
    const first = addLocalDays(forward ? graceLocal : nowLocal, -1);
    const last = addLocalDays(forward ? nowLocal : graceLocal, 1);
    for (const year of new Set([first.year, last.year])) {
      const occurrence = resolveImportantDateOccurrence(source, year);
      if (occurrence === null || compareDates(occurrence, first) < 0 || compareDates(occurrence, last) > 0) continue;
      const due = calculateAllDayReminderDue({ date: occurrence, reminderKind: source.reminder_kind, timeZone });
      if (due.status !== 'scheduled') {
        errors.push({ important_date_id: source.id, error: due.status === 'invalid' ? due.reason : 'disabled' });
        continue;
      }
      if (due.dueAt.getTime() < graceStart.getTime() || due.dueAt.getTime() > runNow.getTime()) continue;
      candidates.push({ source,
        occurrenceDate: `${String(occurrence.year).padStart(4, '0')}-${String(occurrence.month).padStart(2, '0')}-${String(occurrence.day).padStart(2, '0')}`,
        dueAt: due.dueAt });
    }
  }

  candidates.sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime()
    || left.source.id.localeCompare(right.source.id) || left.occurrenceDate.localeCompare(right.occurrenceDate));
  return { candidates, errors };
}
