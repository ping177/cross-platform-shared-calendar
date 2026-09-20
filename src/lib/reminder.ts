import type { ReminderKind } from '../../supabase/functions/_shared/reminder-due.ts';
import { canonicalTimeZone } from '../../supabase/functions/_shared/time-zone.ts';
import type { CalendarEvent } from '../types';

export const TIME_ZONE_DETECTION_ERROR = '无法获取有效的设备时区，请检查系统设置后重试。';

export type TimeZoneResolution =
  | { ok: true; timeZone: string | null }
  | { ok: false; error: string };

type DetectedTimeZoneResolution =
  | { ok: true; timeZone: string }
  | { ok: false; error: string };

export function defaultReminderKind(allDay: boolean): ReminderKind {
  return allDay ? 'all_day_same_day_08' : 'timed_10m_before';
}

export function mapReminderKindForAllDay(reminderKind: ReminderKind | null, allDay: boolean): ReminderKind | null {
  if (reminderKind === null) {
    return null;
  }

  return defaultReminderKind(allDay);
}

export function detectBrowserTimeZone(
  resolve: () => unknown = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
): DetectedTimeZoneResolution {
  try {
    const timeZone = canonicalTimeZone(resolve());
    if (timeZone === null || /^[+-]\d{2}:\d{2}$/.test(timeZone)) {
      return { ok: false, error: TIME_ZONE_DETECTION_ERROR };
    }

    return { ok: true, timeZone };
  } catch {
    return { ok: false, error: TIME_ZONE_DETECTION_ERROR };
  }
}

export function resolveEventTimeZone(
  event: CalendarEvent | null,
  captureRequired: boolean,
  resolve: () => unknown = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
): TimeZoneResolution {
  if (event?.recurrence_rule) {
    return { ok: true, timeZone: event.recurrence_rule.time_zone };
  }

  if (event?.time_zone) {
    return { ok: true, timeZone: event.time_zone };
  }

  if (!captureRequired) {
    return { ok: true, timeZone: null };
  }

  return detectBrowserTimeZone(resolve);
}

export function reminderKindLabel(reminderKind: ReminderKind | null) {
  const labels: Record<ReminderKind, string> = {
    timed_at_start: '开始时',
    timed_10m_before: '提前10分钟',
    timed_30m_before: '提前30分钟',
    timed_1h_before: '提前1小时',
    timed_previous_day_same_time: '提前1天',
    all_day_same_day_08: '当天08:00',
    all_day_previous_day_20: '前一天20:00',
  };

  return reminderKind === null ? '不提醒' : labels[reminderKind];
}

export const timedReminderOptions: Array<{ value: ReminderKind | ''; label: string }> = [
  { value: '', label: '不提醒' },
  { value: 'timed_at_start', label: '开始时' },
  { value: 'timed_10m_before', label: '提前10分钟' },
  { value: 'timed_30m_before', label: '提前30分钟' },
  { value: 'timed_1h_before', label: '提前1小时' },
  { value: 'timed_previous_day_same_time', label: '提前1天' },
];

export const allDayReminderOptions: Array<{ value: ReminderKind | ''; label: string }> = [
  { value: '', label: '不提醒' },
  { value: 'all_day_same_day_08', label: '当天08:00' },
  { value: 'all_day_previous_day_20', label: '前一天20:00' },
];
