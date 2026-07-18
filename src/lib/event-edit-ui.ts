import type { EventEditTarget } from '../types';

export function eventEditUiState(target: EventEditTarget | null) {
  const isRecurringOccurrenceEdit = target?.kind === 'occurrence' && target.event.recurrence_rule !== null;

  return {
    isRecurringOccurrenceEdit,
    canEditRecurrence: !isRecurringOccurrenceEdit,
    canEditAllDay: !isRecurringOccurrenceEdit,
  };
}
