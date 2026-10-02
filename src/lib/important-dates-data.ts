import type { SupabaseClient } from '@supabase/supabase-js';
import { completeRows } from './aggregate-calendar';
import { listCurrentSpaces } from './current-spaces';
import { assertImportantDate, canSaveImportantDateTarget, normalizeImportantDateDraft, type ImportantDateDraft } from './important-dates';
import { canonicalTimeZone } from '../../supabase/functions/_shared/time-zone.ts';
import { resolveImportantDateOccurrence, type CivilDate } from '../../supabase/functions/_shared/important-date.ts';
import { assertImportantDateRange, compareImportantDateCivilDates, type ImportantDateRange } from './important-date-projection';
import { sameModuleScope } from './module-availability';
import { supabase } from './supabase';
import type { ImportantDate } from '../types';

const columns = 'id,space_id,name,emoji,repeat_kind,month,day,year,reminder_kind,time_zone,reminder_schedule_changed_at,created_by,created_at,updated_at';
type ReadSpaces = typeof listCurrentSpaces;
export class ImportantDatesAuthError extends Error {}

async function assertUser(client: SupabaseClient, userId: string) {
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== userId) throw new ImportantDatesAuthError('登录状态已变化，请重试。');
}

export async function loadImportantDatesEligibility(userId: string, client: SupabaseClient = supabase, readSpaces: ReadSpaces = listCurrentSpaces) {
  await assertUser(client, userId);
  const memberSpaces = await readSpaces(userId);
  const memberIds = new Set(memberSpaces.map((space) => space.id));
  const modules = memberSpaces.length ? await completeRows(async (start, end) => {
    const page = await client.from('space_modules').select('space_id,enabled', { count: 'exact' })
      .eq('module_key', 'important_dates').order('space_id').range(start, end);
    if (!page.error && page.data === null) throw new Error('重要日空间资格读取不完整，请重试。');
    return { data: page.data as { space_id: string; enabled: boolean }[] | null, count: page.count, error: page.error };
  }, (row) => row.space_id, (row) => memberIds.has(row.space_id) && typeof row.enabled === 'boolean', '重要日模块') : [];
  await assertUser(client, userId);
  const enabled = new Set(modules.filter((row) => row.enabled).map((row) => row.space_id));
  const eligibleSpaces = memberSpaces.filter((space) => enabled.has(space.id) && ['owner', 'member'].includes(space.membershipRole));
  return { memberSpaces, eligibleSpaces };
}

export type ImportantDatesEligibility = Awaited<ReturnType<typeof loadImportantDatesEligibility>>;
export type ImportantDatesData = ImportantDatesEligibility & { dates: ImportantDate[] };

export async function loadImportantDates(userId: string, client: SupabaseClient = supabase, readSpaces: ReadSpaces = listCurrentSpaces, onEligibility?: (eligibility: ImportantDatesEligibility) => void, entry?: ImportantDatesEligibility): Promise<ImportantDatesData> {
  // Session entry is a read hint only. Mutations always revalidate independently.
  if (entry) await assertUser(client, userId);
  const eligibility = entry ?? await loadImportantDatesEligibility(userId, client, readSpaces);
  onEligibility?.(eligibility);
  const groups = await Promise.all(eligibility.eligibleSpaces.map((space) => completeRows(async (start, end) => {
    const page = await client.from('important_dates').select(columns, { count: 'exact' }).eq('space_id', space.id).order('id').range(start, end);
    if (!page.error && page.data === null) throw new Error('重要日读取不完整，请重试。');
    return { data: page.data as ImportantDate[] | null, count: page.count, error: page.error };
  }, (row) => assertImportantDate(row, space.id).id, undefined, '重要日')));
  const dates = groups.flat();
  if (new Set(dates.map((date) => date.id)).size !== dates.length) throw new Error('重要日来源身份重复，请重试。');
  await assertUser(client, userId);
  return { ...eligibility, dates };
}

// Numeric civil fields only; never parse date-only strings as UTC instants.
function monthDayBound(date: CivilDate, lower: boolean): string {
  return `or(month.${lower ? 'gt' : 'lt'}.${date.month},and(month.eq.${date.month},day.${lower ? 'gte' : 'lte'}.${date.day}))`;
}

function civilBound(date: CivilDate, lower: boolean): string {
  return `or(year.${lower ? 'gt' : 'lt'}.${date.year},and(year.eq.${date.year},${monthDayBound(date, lower)}))`;
}

function annualSegment(year: number, start: CivilDate, end: CivilDate): string {
  const interval = `and(${monthDayBound(start, true)},${monthDayBound(end, false)})`;
  // Let the canonical resolver decide whether Feb29 needs the Feb28 branch.
  const leapDay = resolveImportantDateOccurrence({ repeat_kind: 'annual', year: null, month: 2, day: 29 }, year)!;
  const fallback = leapDay.day === 28 && compareImportantDateCivilDates(leapDay, start) >= 0 && compareImportantDateCivilDates(leapDay, end) <= 0;
  return `and(repeat_kind.eq.annual,or(year.is.null,year.lte.${year}),${fallback ? `or(${interval},and(month.eq.2,day.eq.29))` : interval})`;
}

function calendarCandidatePredicate(range: ImportantDateRange): string {
  const { start, end } = range;
  const branches = [`and(repeat_kind.eq.none,${civilBound(start, true)},${civilBound(end, false)})`];
  if (start.year === end.year) branches.push(annualSegment(start.year, start, end));
  else {
    branches.push(annualSegment(start.year, start, { year: start.year, month: 12, day: 31 }));
    if (end.year - start.year > 1) {
      // A full interior year accepts every month/day; no per-day/year query fanout.
      branches.push(`and(repeat_kind.eq.annual,or(year.is.null,year.lte.${end.year - 1}))`);
    }
    branches.push(annualSegment(end.year, { year: end.year, month: 1, day: 1 }, end));
  }
  return branches.join(',');
}

async function confirmProjectionRead(userId: string, eligibility: ImportantDatesEligibility, dates: ImportantDate[], client: SupabaseClient, readSpaces: ReadSpaces, onEligibility?: (eligibility: ImportantDatesEligibility) => void): Promise<ImportantDatesData> {
  if (new Set(dates.map((date) => date.id)).size !== dates.length) throw new Error('重要日来源身份重复，请重试。');
  // A scope loss during source pagination must not publish an obsolete success.
  const confirmed = await loadImportantDatesEligibility(userId, client, readSpaces);
  onEligibility?.(confirmed);
  if (!sameModuleScope(confirmed, eligibility.memberSpaces, eligibility.eligibleSpaces)) throw new Error('重要日空间资格在读取期间发生变化，请重试。');
  return { ...confirmed, dates };
}

export async function loadHomeImportantDates(userId: string, today: CivilDate, client: SupabaseClient = supabase, readSpaces: ReadSpaces = listCurrentSpaces, onEligibility?: (eligibility: ImportantDatesEligibility) => void): Promise<ImportantDatesData> {
  today = { ...today };
  assertImportantDateRange({ start: today, end: today });
  const eligibility = await loadImportantDatesEligibility(userId, client, readSpaces);
  onEligibility?.(eligibility);
  const groups = await Promise.all(eligibility.eligibleSpaces.map(async (space) => {
    const annual = await completeRows(async (start, end) => {
      const page = await client.from('important_dates').select(columns, { count: 'exact' }).eq('space_id', space.id)
        .eq('repeat_kind', 'annual').order('id').range(start, end);
      if (!page.error && page.data === null) throw new Error('重要日读取不完整，请重试。');
      return { data: page.data as ImportantDate[] | null, count: page.count, error: page.error };
    }, (row) => assertImportantDate(row, space.id).id, (row) => row.repeat_kind === 'annual', '重要日');
    const page = await client.from('important_dates').select(columns, { count: 'exact' }).eq('space_id', space.id)
      .eq('repeat_kind', 'none').or(civilBound(today, true))
      .order('year').order('month').order('day').order('id').limit(3);
    if (page.error) throw page.error;
    if (!Array.isArray(page.data) || page.count === null || !Number.isSafeInteger(page.count) || page.count < 0 || page.data.length !== Math.min(3, page.count)) {
      throw new Error('重要日未来候选读取不完整，请重试。');
    }
    const once = page.data.map((row) => assertImportantDate(row, space.id));
    for (let index = 0; index < once.length; index++) {
      const date = once[index];
      const previous = once[index - 1];
      const order = previous ? compareImportantDateCivilDates({ ...previous, year: previous.year! }, { ...date, year: date.year! }) : -1;
      if (date.repeat_kind !== 'none' || compareImportantDateCivilDates({ ...date, year: date.year! }, today) < 0
        || (previous && (order > 0 || (order === 0 && previous.id >= date.id)))) throw new Error('重要日未来候选身份或排序无效，请重试。');
    }
    return [...annual, ...once];
  }));
  return confirmProjectionRead(userId, eligibility, groups.flat(), client, readSpaces, onEligibility);
}

export async function loadCalendarImportantDates(userId: string, displaySpaceIds: string[], range: ImportantDateRange, client: SupabaseClient = supabase, readSpaces: ReadSpaces = listCurrentSpaces, onEligibility?: (eligibility: ImportantDatesEligibility) => void): Promise<ImportantDatesData> {
  range = { start: { ...range.start }, end: { ...range.end } };
  const visibleIds = new Set(displaySpaceIds);
  assertImportantDateRange(range);
  const eligibility = await loadImportantDatesEligibility(userId, client, readSpaces);
  onEligibility?.(eligibility);
  const predicate = calendarCandidatePredicate(range);
  const groups = await Promise.all(eligibility.eligibleSpaces.filter((space) => visibleIds.has(space.id)).map((space) => completeRows(async (start, end) => {
    const page = await client.from('important_dates').select(columns, { count: 'exact' }).eq('space_id', space.id)
      .or(predicate).order('id').range(start, end);
    if (!page.error && page.data === null) throw new Error('重要日读取不完整，请重试。');
    return { data: page.data as ImportantDate[] | null, count: page.count, error: page.error };
  }, (row) => assertImportantDate(row, space.id).id, undefined, '重要日')));
  return confirmProjectionRead(userId, eligibility, groups.flat(), client, readSpaces, onEligibility);
}

function contentArgs(draft: ImportantDateDraft) {
  const value = normalizeImportantDateDraft(draft);
  return { p_name: value.name, p_emoji: value.emoji, p_repeat_kind: value.repeat_kind, p_month: value.month, p_day: value.day, p_year: value.year,
    ...(value.reminder_kind === undefined ? {} : { p_reminder_kind: value.reminder_kind }) };
}

function assertContent(date: ImportantDate, args: ReturnType<typeof contentArgs>) {
  if (date.name !== args.p_name || date.emoji !== args.p_emoji || date.repeat_kind !== args.p_repeat_kind
    || date.month !== args.p_month || date.day !== args.p_day || date.year !== args.p_year
    || (args.p_reminder_kind !== undefined && date.reminder_kind !== args.p_reminder_kind)) throw new Error('重要日服务端内容校验失败，请刷新后重试。');
}

function assertImmutable(date: ImportantDate, original: ImportantDate, reminderKind = original.reminder_kind) {
  if (date.id !== original.id || date.space_id !== original.space_id || date.created_by !== original.created_by
    || date.created_at !== original.created_at || date.time_zone !== original.time_zone || date.reminder_kind !== reminderKind) {
    throw new Error('重要日服务端身份已变化，请刷新后重试。');
  }
}

async function assertTarget(client: SupabaseClient, userId: string, spaceId: string, readSpaces: ReadSpaces) {
  const eligibility = await loadImportantDatesEligibility(userId, client, readSpaces);
  if (!canSaveImportantDateTarget(spaceId, eligibility.eligibleSpaces)) throw new Error('目标空间已不可用或未启用重要日，请主动选择有效空间。');
}

async function readObject(client: SupabaseClient, userId: string, original: ImportantDate) {
  const { data, error } = await client.from('important_dates').select(columns).eq('id', original.id).eq('space_id', original.space_id).maybeSingle();
  if (error) throw error;
  await assertUser(client, userId);
  if (!data) return null;
  const date = assertImportantDate(data, original.space_id, original.id);
  assertImmutable(date, original);
  if (date.reminder_schedule_changed_at !== original.reminder_schedule_changed_at) throw new Error('重要日提醒信息已变化，请刷新后重试。');
  return date;
}

export async function createImportantDate(client: SupabaseClient, userId: string, spaceId: string, draft: ImportantDateDraft, timeZone: string, readSpaces: ReadSpaces = listCurrentSpaces): Promise<ImportantDate> {
  const args = contentArgs(draft);
  if (canonicalTimeZone(timeZone) !== timeZone || /^[+-]/.test(timeZone)) throw new Error('设备时区无效，请检查系统设置后重试。');
  await assertTarget(client, userId, spaceId, readSpaces);
  const { data, error } = await client.rpc('create_important_date', { p_space_id: spaceId, ...args, p_time_zone: timeZone });
  if (error) throw error;
  await assertUser(client, userId);
  const date = assertImportantDate(data, spaceId);
  assertContent(date, args);
  if (date.created_by !== userId || date.time_zone !== timeZone || date.reminder_kind !== (args.p_reminder_kind ?? null)) throw new Error('新建重要日服务端身份校验失败，请刷新后重试。');
  return date;
}

export async function updateImportantDate(client: SupabaseClient, userId: string, original: ImportantDate, draft: ImportantDateDraft, readSpaces: ReadSpaces = listCurrentSpaces): Promise<ImportantDate> {
  const args = contentArgs(draft);
  assertImportantDate(original, original.space_id, original.id);
  await assertTarget(client, userId, original.space_id, readSpaces);
  const current = await readObject(client, userId, original);
  if (!current) throw new Error('此重要日已删除或当前不可访问，请刷新后重试。');
  const { data, error } = await client.rpc('update_important_date', { p_important_date_id: original.id, ...args });
  if (error) throw error;
  await assertUser(client, userId);
  const date = assertImportantDate(data, original.space_id, original.id);
  assertContent(date, args);
  const reminderKind = args.p_reminder_kind === undefined ? original.reminder_kind : args.p_reminder_kind;
  assertImmutable(date, original, reminderKind);
  // Cosmetic edits must preserve the server's raw PostgreSQL schedule marker.
  if (date.repeat_kind === current.repeat_kind && date.month === current.month && date.day === current.day
    && date.year === current.year && date.reminder_kind === current.reminder_kind
    && date.reminder_schedule_changed_at !== current.reminder_schedule_changed_at) {
    throw new Error('重要日提醒信息校验失败，请刷新后重试。');
  }
  return date;
}

export async function deleteImportantDate(client: SupabaseClient, userId: string, original: ImportantDate, readSpaces: ReadSpaces = listCurrentSpaces): Promise<void> {
  assertImportantDate(original, original.space_id, original.id);
  await assertTarget(client, userId, original.space_id, readSpaces);
  const current = await readObject(client, userId, original);
  if (!current) throw new Error('此重要日已删除或当前不可访问，请刷新后重试。');
  // A changed visible target requires a new confirmation instead of deleting unseen content.
  if (current.updated_at !== original.updated_at || current.name !== original.name) throw new Error('重要日信息已变化，请刷新后重新确认删除。');
  const { data, error } = await client.rpc('delete_important_date', { p_important_date_id: original.id });
  if (error) throw error;
  await assertUser(client, userId);
  if (data !== null && data !== undefined) throw new Error('无法确认重要日删除响应，请刷新后重试。');
  if (await readObject(client, userId, original)) throw new Error('无法确认重要日已删除，请刷新后重试。');
}
