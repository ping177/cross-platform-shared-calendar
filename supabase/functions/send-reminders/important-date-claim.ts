import type { AllDayReminderKind } from '../_shared/reminder-due.ts';
import type { ImportantDateReminderSource } from './important-dates.ts';
import { validateImportantDateFields } from '../_shared/important-date.ts';

export type ImportantDateRpc = (name: 'list_important_date_reminder_candidates' | 'claim_important_date_reminder_delivery' | 'check_important_date_reminder_delivery',
  parameters: Record<string, string | number | null>) => Promise<{ data: unknown; error: unknown }>;

export async function fetchImportantDateReminderCandidatePage(rpc: ImportantDateRpc,
  request: { afterId: string | null; limit: number }): Promise<ImportantDateReminderSource[]> {
  try {
    const result = await rpc('list_important_date_reminder_candidates', { p_after_id: request.afterId, p_limit: request.limit });
    if (result.error !== null || !Array.isArray(result.data) || !result.data.every((row): row is ImportantDateReminderSource =>
      row !== null && typeof row === 'object' && validateImportantDateFields(row).ok
      && typeof row.id === 'string' && row.id.length > 0 && typeof row.space_id === 'string' && typeof row.name === 'string'
      && typeof row.time_zone === 'string' && (row.reminder_kind === 'all_day_same_day_08' || row.reminder_kind === 'all_day_previous_day_20')
      && typeof row.reminder_schedule_changed_at === 'string')) throw new Error();
    return result.data;
  } catch {
    throw new Error('Important Date candidate scan failed.');
  }
}

export type ImportantDateClaimInput = {
  importantDateId: string;
  occurrenceDate: string;
  recipientUserId: string;
  subscriptionId: string;
  dueAt: string;
  expectedReminderKind: AllDayReminderKind;
  expectedReminderScheduleChangedAt: string;
};

// Source-specific RPC boundary. Markers round-trip as raw PG strings.
export async function claimImportantDateReminder(rpc: ImportantDateRpc, input: ImportantDateClaimInput): Promise<string | null> {
  try {
    const result = await rpc('claim_important_date_reminder_delivery', {
      p_important_date_id: input.importantDateId, p_occurrence_date: input.occurrenceDate,
      p_recipient_user_id: input.recipientUserId, p_subscription_id: input.subscriptionId, p_due_at: input.dueAt,
      p_expected_reminder_kind: input.expectedReminderKind,
      p_expected_reminder_schedule_changed_at: input.expectedReminderScheduleChangedAt,
    });
    if (result.error !== null || (result.data !== null && (typeof result.data !== 'string'
      || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(result.data)))) throw new Error();
    return result.data;
  } catch {
    throw new Error('Important Date claim failed.');
  }
}

// Call inside the existing send/finalize try block. Failure throws before provider
// dispatch, preserving failed/unexpected_task_error finalization; no lease/retry.
export async function assertImportantDateReminderSendable(rpc: ImportantDateRpc, deliveryId: string,
  expectedReminderKind: AllDayReminderKind, rawScheduleMarker: string): Promise<void> {
  try {
    const result = await rpc('check_important_date_reminder_delivery', {
      p_delivery_id: deliveryId, p_expected_reminder_kind: expectedReminderKind,
      p_expected_reminder_schedule_changed_at: rawScheduleMarker,
    });
    if (result.error !== null || result.data !== true) throw new Error();
  } catch {
    throw new Error('Important Date pre-send check failed.');
  }
}
