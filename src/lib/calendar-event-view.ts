import { calendarVisibleRange, type CalendarDisplayView } from './calendar-display';
import type { CalendarFilter } from './aggregate-calendar';
import type { CalendarEvent, CalendarOccurrence, CurrentSpace, SpaceMember } from '../types';

// A display row deliberately cannot initialize an EventSheet or recurrence edit.
export type CalendarEventPresentation = Omit<CalendarOccurrence, 'source_event'> & {
  source_event: Pick<CalendarEvent, 'id' | 'space_id' | 'scope' | 'owner_user_id'>;
};
export type CalendarEventsSnapshot = {
  scopeKey: string;
  viewKey: string;
  items: CalendarEventPresentation[];
  membersBySpaceId: Record<string, SpaceMember[]>;
};

export const calendarEventTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export function calendarEventScopeKey(userId: string, memberSpaces: CurrentSpace[], spaces: CurrentSpace[], filter: CalendarFilter) {
  const members = (rows: CurrentSpace[]) => rows.map((space) => [space.id, space.membershipRole]).sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify([userId, members(memberSpaces), members(spaces), filter === 'all' ? 'all' : filter.spaceId]);
}
export function calendarEventViewKey(scopeKey: string, view: CalendarDisplayView, selectedDate: Date, timeZone = calendarEventTimeZone()) {
  const range = calendarVisibleRange(view, selectedDate);
  return JSON.stringify([scopeKey, view, range.start.toISOString(), range.end.toISOString(), timeZone]);
}
export function validCalendarEventsSnapshot(snapshot: CalendarEventsSnapshot | null | undefined, scopeKey: string, viewKey: string) {
  return snapshot?.scopeKey === scopeKey && snapshot.viewKey === viewKey ? snapshot : undefined;
}
export function calendarEventPresentation(occurrences: CalendarOccurrence[]): CalendarEventPresentation[] {
  return occurrences.map(({ source_event, ...display }) => ({ ...display, source_event: {
    id: source_event.id, space_id: source_event.space_id, scope: source_event.scope, owner_user_id: source_event.owner_user_id,
  } }));
}
export function sameCalendarEventOccurrence(row: CalendarEventPresentation, occurrence: CalendarOccurrence) {
  return row.source_event.space_id === occurrence.source_event.space_id && row.source_event_id === occurrence.source_event_id
    && row.occurrence_id === occurrence.occurrence_id && row.occurrence_date === occurrence.occurrence_date;
}
