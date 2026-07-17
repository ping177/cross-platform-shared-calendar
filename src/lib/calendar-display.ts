import type { CalendarOccurrenceRange } from '../types';

export type CalendarDisplayView = 'today' | 'week' | 'month';

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function calendarVisibleRange(view: CalendarDisplayView, selectedDate: Date): CalendarOccurrenceRange {
  if (view === 'today') {
    return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
  }

  if (view === 'week') {
    const start = startOfWeek(selectedDate);
    return { start, end: endOfDay(addDays(start, 6)) };
  }

  const gridStart = startOfWeek(startOfMonth(selectedDate));
  return { start: gridStart, end: endOfDay(addDays(gridStart, 41)) };
}
