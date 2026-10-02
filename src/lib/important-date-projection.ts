import { resolveImportantDateOccurrence, validateImportantDateFields, type CivilDate } from '../../supabase/functions/_shared/important-date.ts';
import { groupImportantDates } from './important-dates';
import type { ImportantDate } from '../types';

export type ImportantDateRange = { start: CivilDate; end: CivilDate };
export type ImportantDateOccurrence = {
  importantDateId: string;
  spaceId: string;
  occurrenceDate: CivilDate;
  name: string;
  emoji: string | null;
};
export type HomeImportantDate = ImportantDateOccurrence & { primary: string; secondary: string };

export function compareImportantDateCivilDates(left: CivilDate, right: CivilDate): number {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

export function assertImportantDateRange(range: ImportantDateRange): void {
  for (const date of [range.start, range.end]) {
    if (!validateImportantDateFields({ ...date, repeat_kind: 'none' }).ok) throw new RangeError('重要日日期范围无效。');
  }
  if (compareImportantDateCivilDates(range.start, range.end) > 0) throw new RangeError('重要日日期范围顺序无效。');
}

function assertSources(dates: ImportantDate[]) {
  const seen = new Set<string>();
  for (const date of dates) {
    const identity = JSON.stringify([date.space_id, date.id]);
    if (!date.id || !date.space_id || seen.has(identity) || !validateImportantDateFields(date).ok) {
      throw new Error('重要日来源身份或日期无效，请重试。');
    }
    seen.add(identity);
  }
}

function occurrence(date: ImportantDate, resolved: CivilDate): ImportantDateOccurrence {
  // Display projection only. Stable IDs, rather than a copied object, are the
  // future handoff back to the module's canonical read/edit path.
  return { importantDateId: date.id, spaceId: date.space_id, occurrenceDate: { ...resolved }, name: date.name, emoji: date.emoji };
}

export function homeImportantDates(dates: ImportantDate[], today: CivilDate): HomeImportantDate[] {
  assertImportantDateRange({ start: today, end: today });
  assertSources(dates);
  return groupImportantDates(dates, today, 'all').current.slice(0, 3).map((row) => ({
    ...occurrence(row.date, row.display.nextOccurrence!), primary: row.primary, secondary: row.secondary,
  }));
}

export function projectImportantDates(dates: ImportantDate[], range: ImportantDateRange): ImportantDateOccurrence[] {
  assertImportantDateRange(range);
  assertSources(dates);
  const result: ImportantDateOccurrence[] = [];
  for (const date of dates) {
    // Iterate only the supplied visible years, never a source's historical life.
    const firstYear = date.repeat_kind === 'none' ? date.year! : Math.max(range.start.year, date.year ?? range.start.year);
    const lastYear = date.repeat_kind === 'none' ? date.year! : range.end.year;
    if (firstYear < range.start.year || firstYear > range.end.year) continue;
    for (let year = firstYear; year <= lastYear; year += 1) {
      const resolved = resolveImportantDateOccurrence(date, year);
      if (resolved && compareImportantDateCivilDates(resolved, range.start) >= 0 && compareImportantDateCivilDates(resolved, range.end) <= 0) {
        result.push(occurrence(date, resolved));
      }
    }
  }
  const textOrder = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
  return result.sort((left, right) => compareImportantDateCivilDates(left.occurrenceDate, right.occurrenceDate)
    || textOrder(left.spaceId, right.spaceId) || textOrder(left.importantDateId, right.importantDateId));
}
