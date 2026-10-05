import { useRef, useState } from 'react';
import { calendarVisibleRange, type CalendarDisplayView } from '../lib/calendar-display';
import type { ImportantDateOccurrence, ImportantDateRange } from '../lib/important-date-projection';
import type { ModuleEntry } from '../lib/module-availability';
import type { CurrentSpace } from '../types';
import type { ImportantDateTargetRequest } from './useImportantDateTarget';
import { useImportantDateEditor } from './useImportantDateEditor';
import { calendarImportantDateTimeZone, useImportantDateProjection, type CalendarImportantDatesRetention } from './useImportantDateProjection';

export function calendarImportantDateRange(view: CalendarDisplayView, selectedDate: Date): ImportantDateRange {
  const range = calendarVisibleRange(view, selectedDate);
  const civil = (date: Date) => ({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() });
  return { start: civil(range.start), end: civil(range.end) };
}

// Calendar owns only a bounded display projection and a transient IDs-only
// interaction. The shared exact target/editor supplies all editing authority.
export function useCalendarImportantDates(userId: string, spaces: CurrentSpace[], displaySpaces: CurrentSpace[], view: CalendarDisplayView,
  selectedDate: Date, entry: ModuleEntry | null, filterKey: string, retention: Pick<CalendarImportantDatesRetention, 'initialData' | 'onValidated' | 'onInvalidate'> = {}) {
  const projection = useImportantDateProjection(userId, {
    kind: 'calendar', spaceIds: displaySpaces.map((space) => space.id), range: calendarImportantDateRange(view, selectedDate),
  }, entry, undefined, { ...retention, memberSpaces: spaces, filterKey, view, timeZone: calendarImportantDateTimeZone() });
  const [identity, setIdentity] = useState<ImportantDateTargetRequest | null>(null);
  const serial = useRef(0);
  const editor = useImportantDateEditor(userId, identity, {
    spaces, entry: projection.state.scope ?? entry,
    onClose: () => setIdentity(null), onReconcile: () => { void projection.refresh(); },
  });
  const items = projection.state.view?.kind === 'calendar' ? projection.state.view.items : [];
  function open(item: ImportantDateOccurrence) {
    setIdentity({ spaceId: item.spaceId, importantDateId: item.importantDateId, requestId: ++serial.current });
  }
  return { ...projection, items, editor, open };
}

export type CalendarImportantDatesInteraction = ReturnType<typeof useCalendarImportantDates>;
