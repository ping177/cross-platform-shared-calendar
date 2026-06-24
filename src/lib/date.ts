import type { CalendarEvent } from '../types';

const dayFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'short',
  day: 'numeric',
  weekday: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
});

const monthFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
});

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + offset);
  return next;
}

export function endOfWeek(date: Date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  return endOfDay(next);
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

export function toDateInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function fromDateInputValue(value: string) {
  return new Date(value).toISOString();
}

export function formatDay(date: Date) {
  return dayFormatter.format(date);
}

export function formatTime(value: string | null, allDay: boolean) {
  if (allDay || !value) {
    return '全天';
  }

  return timeFormatter.format(new Date(value));
}

export function formatMonth(date: Date) {
  return monthFormatter.format(date);
}

export function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export function eventFallsOnDay(event: CalendarEvent, date: Date) {
  const eventStart = new Date(event.starts_at);
  const eventEnd = event.ends_at ? new Date(event.ends_at) : eventStart;
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  return eventStart <= dayEnd && eventEnd >= dayStart;
}

export function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime());
}
