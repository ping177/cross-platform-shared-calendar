import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { assertImportantDate, importantDateLabel, importantDateLocalToday } from './important-dates';
import { nextImportantDateOccurrence, validateImportantDateFields, type CivilDate } from '../../supabase/functions/_shared/important-date.ts';
import { compareImportantDateCivilDates } from './important-date-projection';
import { selectReviewSpace } from './review-history';
import type { ModuleAvailability } from './module-availability';
import type { CurrentSpace } from '../types';

export type Metric<T> = { state: 'loading' | 'error' | 'unavailable' } | { state: 'ready'; value: T };
export type ReviewOverview = { date: string | null; spaceId: string; spaceName: string };
export type NextImportantDate = { name: string; date: string; spaceId: string };
export type ModuleOverview = {
  tasks: Metric<number>; review: Metric<ReviewOverview>; lists: Metric<number>; importantDates: Metric<NextImportantDate | null>;
};
export type OverviewScope = { userId: string; spaces: CurrentSpace[]; availability: ModuleAvailability; reviewSpaceId: string | null };
const modules = [
  { key: 'tasks', ids: 'tasksIds', error: 'tasksError' },
  { key: 'review', ids: 'reviewIds', error: 'reviewError' },
  { key: 'lists', ids: 'listsIds', error: 'listsError' },
  { key: 'important_dates', ids: 'importantDatesIds', error: 'importantDatesError' },
] as const;

export function pendingOverview(): ModuleOverview {
  return { tasks: { state: 'loading' }, review: { state: 'loading' }, lists: { state: 'loading' }, importantDates: { state: 'loading' } };
}
export function overviewScopeKey(scope: OverviewScope): string {
  return JSON.stringify([scope.userId, scope.spaces.map(s => [s.id, s.membershipRole, s.kind, s.name]).sort(),
    modules.map(m => [scope.availability[m.ids]?.slice().sort(), scope.availability[m.error]]), selectReviewSpace(scope.reviewSpaceId, scope.spaces.filter(s => scope.availability.reviewIds?.includes(s.id)))]);
}

function exactCount(result: { count: number | null; error: unknown }): number {
  if (result.error) throw result.error;
  if (!Number.isSafeInteger(result.count) || result.count === null || result.count < 0) throw new Error('概览读取不完整，请重试。');
  return result.count;
}
function candidates(result: { data: unknown[] | null; error: unknown }): unknown[] {
  if (result.error) throw result.error;
  if (!Array.isArray(result.data) || result.data.length > 1
    || result.data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('概览候选读取不完整，请重试。');
  return result.data;
}

// The existing Hub eligibility is a hint. Confirm the same membership roles and
// module scope before AND after source reads; RLS remains the server boundary.
async function confirmScope(scope: OverviewScope, client: SupabaseClient) {
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== scope.userId) throw new Error('登录状态已变化，请重试。');
  const ids = scope.spaces.map(s => s.id);
  if (new Set(ids).size !== ids.length || scope.spaces.some(s => !['owner', 'member'].includes(s.membershipRole))) throw new Error('空间资格无效。');
  if (!ids.length) {
    if (modules.some(m => (scope.availability[m.ids]?.length ?? 0) > 0)) throw new Error('成员资格已变化，请刷新。');
    return;
  }
  const [membership, flags] = await Promise.all([
    client.from('space_members').select('space_id,role', { count: 'exact' }).eq('user_id', scope.userId).in('space_id', ids).limit(ids.length),
    client.from('space_modules').select('space_id,module_key,enabled', { count: 'exact' }).in('space_id', ids).in('module_key', modules.map(m => m.key)).limit(ids.length * 4),
  ]);
  for (const page of [membership, flags]) {
    const count = exactCount(page);
    if (!Array.isArray(page.data) || page.data.length !== count) throw new Error('空间资格读取不完整，请重试。');
  }
  if (membership.data!.length !== ids.length || new Set(membership.data!.map(s => s.space_id)).size !== ids.length
    || scope.spaces.some(s => !membership.data!.some(m => m.space_id === s.id && m.role === s.membershipRole))) throw new Error('成员资格已变化，请刷新。');
  const keys = new Set<string>();
  for (const row of flags.data!) {
    const key = row.space_id + ':' + row.module_key;
    if (!ids.includes(row.space_id) || !modules.some(m => m.key === row.module_key) || typeof row.enabled !== 'boolean' || keys.has(key)) throw new Error('模块资格读取无效。');
    keys.add(key);
  }
  for (const module of modules) {
    if (scope.availability[module.error]) continue;
    const expected = scope.availability[module.ids];
    const actual = flags.data!.filter(row => row.module_key === module.key && row.enabled).map(row => row.space_id).sort();
    if (!expected || JSON.stringify([...new Set(expected)].sort()) !== JSON.stringify(actual)) throw new Error('模块资格已变化，请刷新。');
  }
}

async function nextDate(client: SupabaseClient, ids: string[], today: CivilDate): Promise<NextImportantDate | null> {
  const monthDay = 'month.gt.' + today.month + ',and(month.eq.' + today.month + ',day.gte.' + today.day + ')';
  const active = 'year.is.null,year.lte.' + today.year;
  // Four ordered buckets cover every next occurrence: future one-off,
  // active annual later this year, active annual wrap, and future annual anchor.
  // Each requests only its first ordered row, without a total count.
  const query = () => client.from('important_dates').select('*').in('space_id', ids);
  const orderedAnnual = (q: ReturnType<typeof query>) => q.order('month').order('day').order('id').limit(1);
  const results = await Promise.all([
    query().eq('repeat_kind', 'none').or('year.gt.' + today.year + ',and(year.eq.' + today.year + ',or(' + monthDay + '))')
      .order('year').order('month').order('day').order('id').limit(1),
    orderedAnnual(query().eq('repeat_kind', 'annual').or('and(or(' + active + '),or(' + monthDay + '))')),
    orderedAnnual(query().eq('repeat_kind', 'annual').or(active)),
    query().eq('repeat_kind', 'annual').gt('year', today.year).order('year').order('month').order('day').order('id').limit(1),
  ]);
  const rows = results.flatMap(result => candidates(result)).map(row => {
    const spaceId = (row as { space_id?: string }).space_id;
    if (!spaceId || !ids.includes(spaceId)) throw new Error('重要日空间身份无效。');
    const date = assertImportantDate(row, spaceId);
    const next = nextImportantDateOccurrence(date, today);
    if (!next || compareImportantDateCivilDates(next, today) < 0) throw new Error('重要日未来候选无效。');
    return { source: date, next };
  }).sort((a, b) => compareImportantDateCivilDates(a.next, b.next) || a.source.id.localeCompare(b.source.id));
  const first = rows[0];
  return first ? { name: first.source.name, date: importantDateLabel(first.next), spaceId: first.source.space_id } : null;
}

export async function loadModuleOverview(scope: OverviewScope, client: SupabaseClient = supabase, today = importantDateLocalToday()): Promise<ModuleOverview> {
  if (!validateImportantDateFields({ ...today, repeat_kind: 'none' }).ok) throw new Error('概览日期无效。');
  await confirmScope(scope, client);
  const ids = (index: number) => scope.availability[modules[index].ids] ?? [];
  async function read<T>(index: number, operation: (ids: string[]) => Promise<T>): Promise<Metric<T>> {
    if (scope.availability[modules[index].error] || scope.availability[modules[index].ids] === null) return { state: 'error' };
    if (!ids(index).length) return { state: 'unavailable' };
    try { return { state: 'ready', value: await operation(ids(index)) }; }
    catch { return { state: 'error' }; }
  }
  const [tasks, review, lists, importantDates] = await Promise.all([
    read(0, async ids => exactCount(await client.from('tasks').select('id', { count: 'exact', head: true }).in('space_id', ids).eq('status', 'open'))),
    read(1, async ids => {
      const spaces = scope.spaces.filter(s => ids.includes(s.id));
      const selected = selectReviewSpace(scope.reviewSpaceId, spaces)!;
      const rows = candidates(await client.from('review_rounds').select('id,space_id,review_date,round_no').eq('space_id', selected)
        .order('review_date', { ascending: false }).order('round_no', { ascending: false }).limit(1)) as { id: string; space_id: string; review_date: string; round_no: number }[];
      const row = rows[0];
      if (row) {
        const parts = typeof row.review_date === 'string' ? row.review_date.split('-').map(Number) : [];
        if (!row.id || row.space_id !== selected || !Number.isSafeInteger(row.round_no) || row.round_no < 1
          || !/^\d{4}-\d{2}-\d{2}$/.test(row.review_date) || !validateImportantDateFields({ repeat_kind: 'none', year: parts[0], month: parts[1], day: parts[2] }).ok) throw new Error('回顾记录无效。');
      }
      return { date: row?.review_date ?? null, spaceId: selected, spaceName: spaces.find(s => s.id === selected)!.name };
    }),
    read(2, async ids => exactCount(await client.from('lists').select('id', { count: 'exact', head: true }).in('space_id', ids))),
    read(3, ids => nextDate(client, ids, today)),
  ]);
  await confirmScope(scope, client);
  return { tasks, review, lists, importantDates };
}
