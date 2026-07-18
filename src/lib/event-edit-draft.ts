import type { RecurrenceDraft } from './recurrence';
import type { EventAudience, EventEditTarget } from '../types';

export type EventDraft = {
  title: string;
  description: string;
  audience: EventAudience;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  recurrence: RecurrenceDraft;
};

export function draftFromEditTarget(target: EventEditTarget, draft: EventDraft, toDateInputValue: (date: Date) => string): EventDraft {
  if (target.kind === 'event') {
    return draft;
  }

  return {
    ...draft,
    title: target.occurrence.title,
    description: target.occurrence.description ?? '',
    startsAt: toDateInputValue(new Date(target.occurrence.occurrence_starts_at)),
    endsAt: target.occurrence.occurrence_ends_at ? toDateInputValue(new Date(target.occurrence.occurrence_ends_at)) : '',
    allDay: target.occurrence.all_day,
  };
}
