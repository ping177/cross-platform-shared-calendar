import type { AllDayReminderKind } from '../_shared/reminder-due.ts';
import type { TaskReminderSource } from './tasks.ts';

export type TaskRpc = (name: 'list_task_reminder_candidates' | 'claim_task_reminder_delivery' | 'check_task_reminder_delivery',
  parameters: Record<string, string | number | null>) => Promise<{ data: unknown; error: unknown }>;

export async function fetchTaskReminderCandidatePage(rpc: TaskRpc, request: { afterId: string | null; limit: number }): Promise<TaskReminderSource[]> {
  try {
    const result = await rpc('list_task_reminder_candidates', { p_after_id: request.afterId, p_limit: request.limit });
    if (result.error !== null || !Array.isArray(result.data) || !result.data.every((row): row is TaskReminderSource =>
      row !== null && typeof row === 'object' && typeof row.id === 'string' && row.id.length > 0
      && typeof row.space_id === 'string' && typeof row.personal_owner_id === 'string' && typeof row.title === 'string'
      && (row.space_kind === 'personal' || row.space_kind === 'shared')
      && (row.assigned_to_user_id === null || typeof row.assigned_to_user_id === 'string')
      && typeof row.due_on === 'string' && row.status === 'open' && typeof row.time_zone === 'string'
      && (row.reminder_kind === 'all_day_same_day_08' || row.reminder_kind === 'all_day_previous_day_20')
      && typeof row.reminder_schedule_changed_at === 'string')) throw new Error();
    return result.data;
  } catch { throw new Error('Task candidate scan failed.'); }
}

export type TaskClaimInput = {
  taskId: string;
  occurrenceDate: string;
  recipientUserId: string;
  subscriptionId: string;
  dueAt: string;
  expectedReminderKind: AllDayReminderKind;
  expectedReminderScheduleChangedAt: string;
};
export async function claimTaskReminder(rpc: TaskRpc, input: TaskClaimInput): Promise<string | null> {
  try {
    const result = await rpc('claim_task_reminder_delivery', {
      p_task_id: input.taskId, p_occurrence_date: input.occurrenceDate, p_recipient_user_id: input.recipientUserId,
      p_subscription_id: input.subscriptionId, p_due_at: input.dueAt, p_expected_reminder_kind: input.expectedReminderKind,
      p_expected_reminder_schedule_changed_at: input.expectedReminderScheduleChangedAt,
    });
    if (result.error !== null || (result.data !== null && (typeof result.data !== 'string'
      || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(result.data)))) throw new Error();
    return result.data;
  } catch { throw new Error('Task claim failed.'); }
}
export async function assertTaskReminderSendable(rpc: TaskRpc, deliveryId: string, kind: AllDayReminderKind, rawMarker: string): Promise<void> {
  try {
    const result = await rpc('check_task_reminder_delivery', { p_delivery_id: deliveryId,
      p_expected_reminder_kind: kind, p_expected_reminder_schedule_changed_at: rawMarker });
    if (result.error !== null || result.data !== true) throw new Error();
  } catch { throw new Error('Task pre-send check failed.'); }
}
