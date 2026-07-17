import type { CalendarEvent, CalendarOccurrence, CalendarOccurrenceRange, RecurrenceRule } from '../types';

export const MAX_OCCURRENCE_CANDIDATES = 500;

type LocalDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

export type RecurrenceRuleParseResult =
  | { ok: true; rule: RecurrenceRule }
  | { ok: false; error: string };

export type OccurrenceExpansionResult = {
  occurrences: CalendarOccurrence[];
  error: string | null;
};

export type RecurringEventsExpansionResult = {
  occurrences: CalendarOccurrence[];
  errors: Array<{ source_event_id: string; error: string }>;
};

export type RecurrenceDraft = {
  frequency: 'none' | RecurrenceRule['frequency'];
  interval: number;
  days_of_week: number[];
  day_of_month: number | 'last_day';
  month: number;
  day: number;
};

export type RecurrenceRuleDraftResult =
  | { ok: true; rule: RecurrenceRule | null }
  | { ok: false; error: string };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  return actualKeys.length === expectedKeys.length && actualKeys.every((key, index) => key === expectedKeys[index]);
}

function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isValidMonthDay(month: number, day: number) {
  if (month === 2) {
    return day <= 29;
  }

  return ![4, 6, 9, 11].includes(month) || day <= 30;
}

export function parseRecurrenceRule(value: unknown): RecurrenceRuleParseResult {
  if (!isRecord(value) || value.version !== 1 || !isIntegerInRange(value.interval, 1, 365) || !isValidTimeZone(value.time_zone)) {
    return { ok: false, error: '重复规则格式无效。' };
  }

  const timeZone = new Intl.DateTimeFormat('en-US', { timeZone: value.time_zone }).resolvedOptions().timeZone;

  if (value.frequency === 'daily' && hasExactKeys(value, ['version', 'frequency', 'interval', 'time_zone'])) {
    return { ok: true, rule: { version: 1, frequency: 'daily', interval: value.interval, time_zone: timeZone } };
  }

  if (value.frequency === 'weekly' && hasExactKeys(value, ['version', 'frequency', 'interval', 'days_of_week', 'time_zone'])) {
    if (!Array.isArray(value.days_of_week) || value.days_of_week.length === 0 || value.days_of_week.length > 7) {
      return { ok: false, error: '每周重复日无效。' };
    }

    const days = value.days_of_week;
    if (!days.every((day) => isIntegerInRange(day, 1, 7)) || days.some((day, index) => index > 0 && day <= days[index - 1])) {
      return { ok: false, error: '每周重复日必须按升序且不重复。' };
    }

    return { ok: true, rule: { version: 1, frequency: 'weekly', interval: value.interval, days_of_week: days, time_zone: timeZone } };
  }

  if (value.frequency === 'monthly' && hasExactKeys(value, ['version', 'frequency', 'interval', 'day_of_month', 'time_zone'])) {
    if (value.day_of_month !== 'last_day' && !isIntegerInRange(value.day_of_month, 1, 31)) {
      return { ok: false, error: '每月重复日无效。' };
    }

    return { ok: true, rule: { version: 1, frequency: 'monthly', interval: value.interval, day_of_month: value.day_of_month, time_zone: timeZone } };
  }

  if (value.frequency === 'yearly' && hasExactKeys(value, ['version', 'frequency', 'interval', 'month', 'day', 'time_zone'])) {
    if (!isIntegerInRange(value.month, 1, 12) || !isIntegerInRange(value.day, 1, 31) || !isValidMonthDay(value.month, value.day)) {
      return { ok: false, error: '每年重复日期无效。' };
    }

    return { ok: true, rule: { version: 1, frequency: 'yearly', interval: value.interval, month: value.month, day: value.day, time_zone: timeZone } };
  }

  return { ok: false, error: '重复规则不受支持。' };
}

function weekdayForDate(date: Date) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

export function defaultRecurrenceDraft(startsAt: string): RecurrenceDraft {
  const start = new Date(startsAt);
  const date = Number.isNaN(start.getTime()) ? new Date() : start;

  return {
    frequency: 'none',
    interval: 1,
    days_of_week: [weekdayForDate(date)],
    day_of_month: date.getDate(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function recurrenceDraftFromRule(rule: RecurrenceRule | null, startsAt: string): RecurrenceDraft {
  const draft = defaultRecurrenceDraft(startsAt);
  if (rule === null) {
    return draft;
  }

  const parsed = parseRecurrenceRule(rule);
  if (!parsed.ok) {
    return draft;
  }

  if (parsed.rule.frequency === 'daily') {
    return { ...draft, frequency: 'daily', interval: parsed.rule.interval };
  }

  if (parsed.rule.frequency === 'weekly') {
    return { ...draft, frequency: 'weekly', interval: parsed.rule.interval, days_of_week: parsed.rule.days_of_week };
  }

  if (parsed.rule.frequency === 'monthly') {
    return { ...draft, frequency: 'monthly', interval: parsed.rule.interval, day_of_month: parsed.rule.day_of_month };
  }

  return {
    ...draft,
    frequency: 'yearly',
    interval: parsed.rule.interval,
    month: parsed.rule.month,
    day: parsed.rule.day,
  };
}

export function recurrenceRuleFromDraft(draft: RecurrenceDraft, timeZone: string): RecurrenceRuleDraftResult {
  if (draft.frequency === 'none') {
    return { ok: true, rule: null };
  }

  const base = { version: 1, frequency: draft.frequency, interval: draft.interval, time_zone: timeZone };
  const candidate = draft.frequency === 'weekly'
    ? { ...base, days_of_week: draft.days_of_week }
    : draft.frequency === 'monthly'
      ? { ...base, day_of_month: draft.day_of_month }
      : draft.frequency === 'yearly'
        ? { ...base, month: draft.month, day: draft.day }
        : base;
  const parsed = parseRecurrenceRule(candidate);
  return parsed.ok ? { ok: true, rule: parsed.rule } : parsed;
}

export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function recurrenceSummary(rule: RecurrenceRule | null) {
  if (rule === null) {
    return '不重复';
  }

  if (rule.frequency === 'daily') {
    return `每 ${rule.interval} 天`;
  }

  if (rule.frequency === 'weekly') {
    const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    return `每 ${rule.interval} 周 · ${rule.days_of_week.map((day) => labels[day - 1]).join(' ')}`;
  }

  if (rule.frequency === 'monthly') {
    return rule.day_of_month === 'last_day'
      ? `每 ${rule.interval} 月 · 月末`
      : `每 ${rule.interval} 月 · ${rule.day_of_month} 日`;
  }

  return `每 ${rule.interval} 年 · ${rule.month} 月 ${rule.day} 日`;
}

function formatterFor(timeZone: string) {
  const cached = formatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function localParts(date: Date, timeZone: string): LocalDateTime {
  const values = Object.fromEntries(formatterFor(timeZone).formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]));

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
    millisecond: date.getMilliseconds(),
  };
}

function compareLocalDate(left: Pick<LocalDateTime, 'year' | 'month' | 'day'>, right: Pick<LocalDateTime, 'year' | 'month' | 'day'>) {
  return Date.UTC(left.year, left.month - 1, left.day) - Date.UTC(right.year, right.month - 1, right.day);
}

function compareLocalDateTime(left: LocalDateTime, right: LocalDateTime) {
  const leftValue = Date.UTC(left.year, left.month - 1, left.day, left.hour, left.minute, left.second, left.millisecond);
  const rightValue = Date.UTC(right.year, right.month - 1, right.day, right.hour, right.minute, right.second, right.millisecond);
  return leftValue - rightValue;
}

function addDays(date: Pick<LocalDateTime, 'year' | 'month' | 'day'>, days: number) {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function daysBetween(from: Pick<LocalDateTime, 'year' | 'month' | 'day'>, to: Pick<LocalDateTime, 'year' | 'month' | 'day'>) {
  return Math.floor(compareLocalDate(to, from) / 86_400_000);
}

function startOfWeek(date: Pick<LocalDateTime, 'year' | 'month' | 'day'>) {
  const utcDay = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return addDays(date, utcDay === 0 ? -6 : 1 - utcDay);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function timeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const local = localParts(date, timeZone);
  return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - Math.floor(date.getTime() / 1000) * 1000;
}

function zonedDateTimeToInstant(local: LocalDateTime, timeZone: string) {
  const naive = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second, local.millisecond);
  let timestamp = naive;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    timestamp = naive - timeZoneOffsetMilliseconds(new Date(timestamp), timeZone);
  }

  const candidate = new Date(timestamp);
  if (compareLocalDateTime(localParts(candidate, timeZone), local) === 0) {
    return candidate;
  }

  const scanStart = naive - 18 * 60 * 60 * 1000;
  const scanEnd = naive + 18 * 60 * 60 * 1000;
  let firstAfterGap: Date | null = null;

  for (let current = scanStart; current <= scanEnd; current += 60_000) {
    const scanned = new Date(current + local.millisecond);
    const scannedParts = localParts(scanned, timeZone);
    const comparison = compareLocalDateTime(scannedParts, local);
    if (comparison === 0) {
      return scanned;
    }
    if (comparison > 0 && firstAfterGap === null) {
      firstAfterGap = scanned;
    }
  }

  return firstAfterGap ?? candidate;
}

function occurrenceFor(event: CalendarEvent, start: Date, duration: number | null): CalendarOccurrence {
  const occurrenceStart = start.toISOString();
  return {
    occurrence_id: `${event.id}:${occurrenceStart}`,
    source_event_id: event.id,
    occurrence_starts_at: occurrenceStart,
    occurrence_ends_at: duration === null ? null : new Date(start.getTime() + duration).toISOString(),
    source_event: event,
  };
}

function intersectsRange(start: Date, duration: number | null, range: CalendarOccurrenceRange) {
  const end = duration === null ? start : new Date(start.getTime() + duration);
  return start <= range.end && end >= range.start;
}

function ceilToInterval(value: number, interval: number) {
  return Math.max(0, Math.ceil(value / interval));
}

export function expandEventOccurrences(event: CalendarEvent, range: CalendarOccurrenceRange): OccurrenceExpansionResult {
  const sourceStart = new Date(event.starts_at);
  const sourceEnd = event.ends_at ? new Date(event.ends_at) : null;
  if (Number.isNaN(sourceStart.getTime()) || Number.isNaN(range.start.getTime()) || Number.isNaN(range.end.getTime()) || range.start > range.end) {
    return { occurrences: [], error: '日程范围无效。' };
  }

  const duration = sourceEnd ? sourceEnd.getTime() - sourceStart.getTime() : null;
  if (duration !== null && (Number.isNaN(sourceEnd?.getTime()) || duration < 0)) {
    return { occurrences: [], error: '日程结束时间无效。' };
  }

  if (event.recurrence_rule === null) {
    return intersectsRange(sourceStart, duration, range)
      ? { occurrences: [occurrenceFor(event, sourceStart, duration)], error: null }
      : { occurrences: [], error: null };
  }

  const parsed = parseRecurrenceRule(event.recurrence_rule);
  if (!parsed.ok) {
    return { occurrences: [], error: parsed.error };
  }

  const rule = parsed.rule;
  const anchor = localParts(sourceStart, rule.time_zone);
  const threshold = localParts(new Date(range.start.getTime() - (duration ?? 0)), rule.time_zone);
  const rangeEnd = localParts(range.end, rule.time_zone);
  const candidates = new Map<string, Date>();
  let limitReached = false;

  function addCandidate(local: LocalDateTime) {
    if (limitReached) {
      return;
    }

    const instant = zonedDateTimeToInstant(local, rule.time_zone);
    const key = instant.toISOString();
    if (candidates.has(key)) {
      return;
    }

    if (candidates.size >= MAX_OCCURRENCE_CANDIDATES) {
      limitReached = true;
      return;
    }

    candidates.set(key, instant);
  }

  addCandidate(anchor);

  if (rule.frequency === 'daily') {
    const firstIndex = ceilToInterval(daysBetween(anchor, threshold), rule.interval);
    for (let index = firstIndex; ; index += 1) {
      const date = addDays(anchor, index * rule.interval);
      if (compareLocalDate(date, rangeEnd) > 0 || limitReached) {
        break;
      }
      addCandidate({ ...date, hour: anchor.hour, minute: anchor.minute, second: anchor.second, millisecond: anchor.millisecond });
    }
  }

  if (rule.frequency === 'weekly') {
    const anchorWeek = startOfWeek(anchor);
    const thresholdWeek = startOfWeek(threshold);
    const firstIndex = ceilToInterval(Math.floor(daysBetween(anchorWeek, thresholdWeek) / 7), rule.interval);
    for (let index = firstIndex; !limitReached; index += 1) {
      const week = addDays(anchorWeek, index * rule.interval * 7);
      if (compareLocalDate(week, rangeEnd) > 0) {
        break;
      }
      for (const weekday of rule.days_of_week) {
        const date = addDays(week, weekday - 1);
        if (compareLocalDate(date, anchor) < 0 || compareLocalDate(date, rangeEnd) > 0) {
          continue;
        }
        addCandidate({ ...date, hour: anchor.hour, minute: anchor.minute, second: anchor.second, millisecond: anchor.millisecond });
      }
    }
  }

  if (rule.frequency === 'monthly') {
    const thresholdMonths = (threshold.year - anchor.year) * 12 + threshold.month - anchor.month;
    const firstIndex = ceilToInterval(thresholdMonths, rule.interval);
    for (let index = firstIndex; !limitReached; index += 1) {
      const monthIndex = anchor.month - 1 + index * rule.interval;
      const year = anchor.year + Math.floor(monthIndex / 12);
      const month = (monthIndex % 12) + 1;
      if (compareLocalDate({ year, month, day: 1 }, rangeEnd) > 0) {
        break;
      }
      const day = rule.day_of_month === 'last_day' ? daysInMonth(year, month) : rule.day_of_month;
      if (day > daysInMonth(year, month)) {
        continue;
      }
      const date = { year, month, day };
      if (compareLocalDate(date, anchor) < 0) {
        continue;
      }
      addCandidate({ ...date, hour: anchor.hour, minute: anchor.minute, second: anchor.second, millisecond: anchor.millisecond });
    }
  }

  if (rule.frequency === 'yearly') {
    const firstIndex = ceilToInterval(threshold.year - anchor.year, rule.interval);
    for (let index = firstIndex; !limitReached; index += 1) {
      const year = anchor.year + index * rule.interval;
      if (year > rangeEnd.year) {
        break;
      }
      if (rule.month === 2 && rule.day === 29 && daysInMonth(year, 2) !== 29) {
        continue;
      }
      const date = { year, month: rule.month, day: rule.day };
      if (compareLocalDate(date, anchor) < 0 || compareLocalDate(date, rangeEnd) > 0) {
        continue;
      }
      addCandidate({ ...date, hour: anchor.hour, minute: anchor.minute, second: anchor.second, millisecond: anchor.millisecond });
    }
  }

  if (limitReached) {
    return { occurrences: [], error: `重复日程在当前范围内超过 ${MAX_OCCURRENCE_CANDIDATES} 个候选。` };
  }

  return {
    occurrences: [...candidates.values()]
      .filter((candidate) => intersectsRange(candidate, duration, range))
      .sort((left, right) => left.getTime() - right.getTime())
      .map((candidate) => occurrenceFor(event, candidate, duration)),
    error: null,
  };
}

export function expandRecurringEvents(events: CalendarEvent[], range: CalendarOccurrenceRange): RecurringEventsExpansionResult {
  const occurrences: CalendarOccurrence[] = [];
  const errors: RecurringEventsExpansionResult['errors'] = [];

  for (const event of events) {
    const result = expandEventOccurrences(event, range);
    if (result.error) {
      errors.push({ source_event_id: event.id, error: result.error });
      continue;
    }
    occurrences.push(...result.occurrences);
  }

  occurrences.sort((left, right) => (
    new Date(left.occurrence_starts_at).getTime() - new Date(right.occurrence_starts_at).getTime()
    || left.source_event_id.localeCompare(right.source_event_id)
  ));

  return { occurrences, errors };
}
