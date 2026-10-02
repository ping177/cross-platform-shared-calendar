import { deriveImportantDateDisplay, validateImportantDateFields, type CivilDate, type ImportantDateFields } from '../../supabase/functions/_shared/important-date.ts';
import { canonicalTimeZone } from '../../supabase/functions/_shared/time-zone.ts';
import { allDayReminderOptions } from './reminder';
import { homeCreateTarget } from './global-create';
import type { CurrentSpace, ImportantDate } from '../types';

export type ImportantDateFilter = 'all' | { spaceId: string };
export type ImportantDateDraft = ImportantDateFields & { name: string; emoji: string | null; reminder_kind?: ImportantDate['reminder_kind'] };

export function normalizeImportantDateFilter(filter: ImportantDateFilter, eligible: CurrentSpace[]): ImportantDateFilter {
  return filter === 'all' || eligible.some((space) => space.id === filter.spaceId) ? filter : 'all';
}

export function defaultImportantDateTarget(filter: ImportantDateFilter, members: CurrentSpace[], eligible: CurrentSpace[], userId: string): string | null {
  if (filter !== 'all') return canSaveImportantDateTarget(filter.spaceId, eligible) ? filter.spaceId : null;
  return homeCreateTarget(members, userId);
}

export function canSaveImportantDateTarget(spaceId: string, eligible: CurrentSpace[]): boolean {
  return eligible.some((space) => space.id === spaceId && ['owner', 'member'].includes(space.membershipRole));
}

function singleLine(value: string, limit: number, label: string): string {
  const text = value.trim();
  if (!text || Array.from(text).length > limit || /[\p{Cc}\u2028\u2029]/u.test(text)) throw new Error(`${label}须为 1–${limit} 个字符的单行文字。`);
  return text;
}

export function normalizeImportantDateDraft(draft: ImportantDateDraft): ImportantDateDraft {
  const validation = validateImportantDateFields(draft);
  if (!validation.ok) throw new Error('请输入有效日期；不重复须填写年份，开始年份须对应真实日期。');
  const hasReminder = 'reminder_kind' in draft;
  if (hasReminder && !allDayReminderOptions.some((option) => (option.value || null) === draft.reminder_kind)) {
    throw new Error('请选择有效的提醒选项。');
  }
  return { ...validation.value, ...(hasReminder ? { reminder_kind: draft.reminder_kind } : {}), name: singleLine(draft.name, 200, '名称'),
    emoji: draft.emoji?.trim() ? singleLine(draft.emoji, 32, 'Emoji') : null };
}

export function assertImportantDate(row: unknown, spaceId: string, id?: string): ImportantDate {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('无法确认重要日的服务端记录，请重试。');
  const date = row as ImportantDate;
  const normalized = normalizeImportantDateDraft(date);
  if (typeof date.id !== 'string' || !date.id || date.space_id !== spaceId || (id !== undefined && date.id !== id)
    || normalized.name !== date.name || normalized.emoji !== date.emoji
    || typeof date.created_by !== 'string' || !date.created_by
    || ![date.created_at, date.updated_at, date.reminder_schedule_changed_at].every((value) => typeof value === 'string' && Number.isFinite(Date.parse(value)))
    || canonicalTimeZone(date.time_zone) === null || /^[+-]/.test(date.time_zone)
    || ![null, 'all_day_same_day_08', 'all_day_previous_day_20'].includes(date.reminder_kind)) {
    throw new Error('重要日数据身份校验失败，请重试。');
  }
  return date;
}

export function importantDateLocalToday(now = new Date()): CivilDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function importantDateLabel(date: CivilDate): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function importantDatePresentation(date: ImportantDateFields, today: CivilDate) {
  const display = deriveImportantDateDisplay(date, today);
  const dateLabel = importantDateLabel(display.kind === 'past' ? display.originalDate : display.nextOccurrence);
  switch (display.kind) {
    case 'countdown': return { display, dateLabel, primary: `还有 ${display.daysUntil} 天`, secondary: '' };
    case 'today': return { display, dateLabel, primary: '就是今天', secondary: '' };
    case 'day-count': return { display, dateLabel, primary: `第 ${display.dayCount} 天`, secondary: `距 ${display.nextAnniversary.years} 周年还有 ${display.nextAnniversary.daysUntil} 天` };
    case 'anniversary': return { display, dateLabel, primary: `${display.anniversary} 周年`, secondary: `第 ${display.dayCount} 天` };
    case 'past': return { display, dateLabel, primary: `已过去 ${display.elapsedDays} 天`, secondary: '' };
  }
}

export function groupImportantDates(dates: ImportantDate[], today: CivilDate, filter: ImportantDateFilter) {
  const rows = dates.filter((date) => filter === 'all' || date.space_id === filter.spaceId)
    .map((date) => ({ date, ...importantDatePresentation(date, today) }));
  const identity = (a: typeof rows[number], b: typeof rows[number]) => a.date.id < b.date.id ? -1 : a.date.id > b.date.id ? 1 : 0;
  return {
    current: rows.filter((row) => row.display.kind !== 'past').sort((a, b) => {
      const left = a.display.nextOccurrence!;
      const right = b.display.nextOccurrence!;
      return left.year - right.year || left.month - right.month || left.day - right.day || identity(a, b);
    }),
    past: rows.filter((row) => row.display.kind === 'past').sort((a, b) => b.date.year! - a.date.year! || b.date.month - a.date.month || b.date.day - a.date.day || identity(a, b)),
  };
}
