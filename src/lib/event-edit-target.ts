import type { CalendarEvent, CalendarOccurrence, EventEditTarget } from '../types';

export function eventEditTargetForEvent(event: CalendarEvent): EventEditTarget {
  return { kind: 'event', event };
}

export function eventEditTargetForOccurrence(occurrence: CalendarOccurrence): EventEditTarget {
  return {
    kind: 'occurrence',
    event: occurrence.source_event,
    occurrence: {
      occurrence_id: occurrence.occurrence_id,
      occurrence_date: occurrence.occurrence_date,
      title: occurrence.title,
      description: occurrence.description,
      occurrence_starts_at: occurrence.occurrence_starts_at,
      occurrence_ends_at: occurrence.occurrence_ends_at,
      all_day: occurrence.all_day,
    },
  };
}
