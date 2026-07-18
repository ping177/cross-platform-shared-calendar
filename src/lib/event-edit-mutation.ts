import type { EventDraft } from './event-edit-draft';
import type { EventEditTarget } from '../types';

type OccurrenceEditTarget = Extract<EventEditTarget, { kind: 'occurrence' }>;

export function saveMutationRoute(target: EventEditTarget) {
  return target.kind === 'occurrence' ? 'occurrence-override' : 'event-update';
}

export function deleteMutationRoute(target: EventEditTarget) {
  return target.kind === 'occurrence' ? 'occurrence-delete' : 'event-delete';
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
