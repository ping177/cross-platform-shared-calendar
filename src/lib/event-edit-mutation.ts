import type { EventDraft } from './event-edit-draft';
import type { EventEditTarget } from '../types';

type OccurrenceEditTarget = Extract<EventEditTarget, { kind: 'occurrence' }>;
export type OccurrenceScope = 'only-this' | 'this-and-future';

export function saveMutationRoute(target: EventEditTarget, scope: OccurrenceScope = 'only-this') {
  if (target.kind !== 'occurrence') {
    return 'event-update';
  }

  return scope === 'this-and-future' ? 'recurring-split' : 'occurrence-override';
}

export function deleteMutationRoute(target: EventEditTarget, scope: OccurrenceScope = 'only-this') {
  if (target.kind !== 'occurrence') {
    return 'event-delete';
  }

  return scope === 'this-and-future' ? 'occurrence-future-delete' : 'occurrence-delete';
}

export function occurrenceOverrideRpcArgs(target: OccurrenceEditTarget, draft: EventDraft, fromDateInputValue: (value: string) => string) {
  return {
    p_event_id: target.event.id,
    p_occurrence_date: target.occurrence.occurrence_date,
    p_override_data: {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      starts_at: fromDateInputValue(draft.startsAt),
      ends_at: draft.endsAt ? fromDateInputValue(draft.endsAt) : null,
    },
    p_expected_updated_at: target.event.updated_at,
  };
}

export function splitRecurringEventRpcArgs(target: OccurrenceEditTarget, draft: EventDraft, fromDateInputValue: (value: string) => string) {
  return {
    p_source_event_id: target.event.id,
    p_split_occurrence_date: target.occurrence.occurrence_date,
    p_new_title: draft.title.trim(),
    p_new_description: draft.description.trim() || null,
    p_new_starts_at: fromDateInputValue(draft.startsAt),
    p_new_ends_at: draft.endsAt ? fromDateInputValue(draft.endsAt) : null,
    p_new_all_day: target.event.all_day,
    p_new_recurrence_rule: target.event.recurrence_rule,
    p_expected_updated_at: target.event.updated_at,
  };
}

export function occurrenceDeleteRpcArgs(target: OccurrenceEditTarget) {
  return {
    p_event_id: target.event.id,
    p_occurrence_date: target.occurrence.occurrence_date,
    p_expected_updated_at: target.event.updated_at,
  };
}

export function deleteOccurrenceAndFutureRpcArgs(target: OccurrenceEditTarget) {
  return occurrenceDeleteRpcArgs(target);
}
