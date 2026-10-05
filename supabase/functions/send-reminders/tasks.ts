import { calculateAllDayReminderDue, type AllDayReminderKind } from '../_shared/reminder-due.ts';

export type TaskReminderSource = {
  id: string;
  space_id: string;
  space_kind: 'personal' | 'shared';
  personal_owner_id: string;
  title: string;
  assigned_to_user_id: string | null;
  due_on: string | null;
  status: 'open' | 'completed';
  reminder_kind: AllDayReminderKind | null;
  time_zone: string;
  reminder_schedule_changed_at: string;
};
export type TaskReminderCandidate = { source: TaskReminderSource; occurrenceDate: string; dueAt: Date };

// No Task occurrence projection or timestamp midnight surrogate: due_on is civil.
export function projectTaskReminderCandidates(sources: TaskReminderSource[], runNow: Date) {
  if (!Number.isFinite(runNow.getTime())) throw new RangeError('Invalid Reminder run time');
  const candidates: TaskReminderCandidate[] = [];
  const errors: Array<{ task_id: string; error: string }> = [];
  for (const source of sources) {
    if (source.status !== 'open' || source.due_on === null || source.reminder_kind === null) continue;
    const match = /^(\d{4,6})-(\d{2})-(\d{2})$/.exec(source.due_on);
    if (match === null || Number(match[1]) < 1) { errors.push({ task_id: source.id, error: 'invalid_due_on' }); continue; }
    const due = calculateAllDayReminderDue({ date: { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) },
      reminderKind: source.reminder_kind, timeZone: source.time_zone });
    if (due.status !== 'scheduled') { errors.push({ task_id: source.id, error: due.status === 'invalid' ? due.reason : 'disabled' }); continue; }
    if (due.dueAt.getTime() > runNow.getTime() || due.dueAt.getTime() < runNow.getTime() - 10 * 60_000) continue;
    candidates.push({ source, occurrenceDate: source.due_on, dueAt: due.dueAt });
  }
  return { candidates, errors };
}
