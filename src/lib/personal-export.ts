import type { SupabaseClient } from '@supabase/supabase-js';
import { completeRows } from './aggregate-calendar.ts';
import { exportColumns, exportTables, assertExportUuid, type ExportRow, type ExportTable } from './data-export-format.ts';
import type { ExportInput } from './data-export-archive.ts';

export class PersonalExportAccessError extends Error {}
const stop = (signal: AbortSignal) => { if (signal.aborted) throw new PersonalExportAccessError('导出已取消。'); };
async function actor(client: SupabaseClient, userId: string, signal: AbortSignal) {
  stop(signal);
  const { data, error } = await client.auth.getUser();
  stop(signal);
  if (error || data.user?.id !== userId) throw new PersonalExportAccessError('登录状态已变化，请重新打开导出。');
}
const columns = (table: ExportTable) => exportColumns[table].map((field) => field.name + (field.type === 'json' || field.type === 'bigint' ? '::text' : '')).join(',');

async function rows(client: SupabaseClient, userId: string, signal: AbortSignal, query: (start: number, end: number) => PromiseLike<{ data: unknown; count: number | null; error: unknown }>, identity: (row: ExportRow) => string, belongs?: (row: ExportRow) => boolean) {
  return completeRows<ExportRow>(async (start, end) => {
    await actor(client, userId, signal);
    const page = await query(start, end);
    await actor(client, userId, signal);
    if (page.error) throw new Error('导出查询失败，请重试。');
    if (!Array.isArray(page.data)) throw new Error('导出分页响应不完整。');
    return { data: page.data as ExportRow[], count: page.count, error: null };
  }, identity, belongs, '导出');
}

// No caller-supplied Space selector: derive solely from the authenticated membership.
export async function verifyPersonalExportAccess(client: SupabaseClient, userId: string, signal: AbortSignal, expectedSpaceId?: string) {
  assertExportUuid(userId);
  const memberships = await rows(client, userId, signal, (start, end) => client.from('space_members').select(columns('members'), { count: 'exact' })
    .eq('user_id', userId).order('space_id').abortSignal(signal).range(start, end), row => String(row.space_id), row => row.user_id === userId);
  const spaces: ExportRow[] = [];
  for (let index = 0; index < memberships.length; index += 100) {
    const ids = memberships.slice(index, index + 100).map(row => String(row.space_id));
    spaces.push(...await rows(client, userId, signal, (start, end) => client.from('spaces').select(columns('space'), { count: 'exact' })
      .eq('kind', 'personal').in('id', ids).order('id').abortSignal(signal).range(start, end), row => String(row.id), row => row.kind === 'personal' && ids.includes(String(row.id))));
  }
  if (spaces.length !== 1 || (expectedSpaceId && spaces[0].id !== expectedSpaceId)) throw new PersonalExportAccessError('无法确认当前账号的个人空间访问权限。');
  const space = spaces[0];
  assertExportUuid(space.id);
  const members = await rows(client, userId, signal, (start, end) => client.from('space_members').select(columns('members'), { count: 'exact' })
    .eq('space_id', space.id).order('user_id').abortSignal(signal).range(start, end), row => String(row.user_id), row => row.space_id === space.id && row.user_id === userId);
  if (members.length !== 1 || !['owner', 'member'].includes(String(members[0].role))) throw new PersonalExportAccessError('个人空间成员关系已变化。');
  return { space, members };
}

export async function readPersonalCalendarExport(client: SupabaseClient, userId: string, signal: AbortSignal): Promise<ExportInput> {
  const startedAt = new Date().toISOString();
  const access = await verifyPersonalExportAccess(client, userId, signal);
  const spaceId = access.space.id as string;
  const events = await rows(client, userId, signal, (start, end) => client.from('events').select(columns('events'), { count: 'exact' })
    .eq('space_id', spaceId).order('id').abortSignal(signal).range(start, end), row => String(row.id), row => row.space_id === spaceId);
  const exceptions: ExportRow[] = [];
  const batches: string[][] = [];
  for (let index = 0; index < events.length; index += 100) {
    const ids = events.slice(index, index + 100).map(row => String(row.id)); batches.push(ids);
    exceptions.push(...await rows(client, userId, signal, (start, end) => client.from('event_occurrence_exceptions').select(columns('event_occurrence_exceptions'), { count: 'exact' })
      .in('event_id', ids).order('id').abortSignal(signal).range(start, end), row => String(row.id), row => ids.includes(String(row.event_id))));
  }
  await verifyPersonalExportAccess(client, userId, signal, spaceId);
  const eventCount = await client.from('events').select('id', { count: 'exact', head: true }).eq('space_id', spaceId).abortSignal(signal);
  if (eventCount.error || eventCount.count !== events.length) throw new Error('日程数量已变化，请重新生成。');
  for (const ids of batches) {
    const count = await client.from('event_occurrence_exceptions').select('id', { count: 'exact', head: true }).in('event_id', ids).abortSignal(signal);
    if (count.error || count.count !== exceptions.filter(row => ids.includes(String(row.event_id))).length) throw new Error('重复例外数量已变化，请重新生成。');
  }
  await actor(client, userId, signal);
  const tables = Object.fromEntries(exportTables.map(table => [table, [] as ExportRow[]])) as Record<ExportTable, ExportRow[]>;
  tables.space = [access.space]; tables.members = access.members; tables.events = events; tables.event_occurrence_exceptions = exceptions;
  return { actorId: userId, startedAt, finishedAt: new Date().toISOString(), synthetic: false, scope: 'personal-calendar', spaces: [{ tables,
    expectedRows: Object.fromEntries(exportTables.map(table => [table, tables[table].length])) as Record<ExportTable, number> }] };
}
