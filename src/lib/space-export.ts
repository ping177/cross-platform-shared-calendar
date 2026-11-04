import type { SupabaseClient } from '@supabase/supabase-js';
import { readExportRows, assertExportActor, exportSelectColumns } from './personal-export.ts';
import { assertExportUuid, exportColumns, exportCsv, exportTables, type ExportRow, type ExportTable } from './data-export-format.ts';
import { ExportCapacityError, validateExportRelations, type ExportInput, type ExportSpace } from './data-export-archive.ts';
export const exportReadByteLimit = 8 * 1024 * 1024;

export async function listExportSpaces(client: SupabaseClient, userId: string, signal: AbortSignal): Promise<ExportRow[]> {
  assertExportUuid(userId);
  const memberships = await readExportRows(client, userId, signal, (start, end) => client.from('space_members').select('space_id,user_id', { count: 'exact' })
    .eq('user_id', userId).order('space_id').abortSignal(signal).range(start, end), row => String(row.space_id), row => row.user_id === userId);
  const spaces: ExportRow[] = [];
  for (const ids of batches(memberships.map(row => String(row.space_id)))) {
    ids.forEach(assertExportUuid);
    spaces.push(...await readExportRows(client, userId, signal, (start, end) => client.from('spaces').select(exportSelectColumns('space'), { count: 'exact' })
      .in('id', ids).order('id').abortSignal(signal).range(start, end), row => String(row.id), row => ids.includes(String(row.id)) && ['personal', 'shared'].includes(String(row.kind))));
  }
  if (spaces.length !== memberships.length || new Set(spaces.map(row => row.id)).size !== spaces.length) throw new Error('空间列表不完整，请刷新重试。');
  for (const space of spaces) { assertExportUuid(space.id); exportCsv('space', [space]); }
  return spaces.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export async function verifyExportAccess(client: SupabaseClient, userId: string, selectedIds: string[], signal: AbortSignal) {
  if (!selectedIds.length || new Set(selectedIds).size !== selectedIds.length) throw new Error('请选择有效且不重复的空间。');
  selectedIds.forEach(assertExportUuid);
  const spaces = await listExportSpaces(client, userId, signal);
  if (selectedIds.some(id => !spaces.some(space => space.id === id))) throw new Error('所选空间权限已变化，请刷新重试。');
  return spaces;
}

function batches(ids: string[]) {
  if (!ids.length) return [[]];
  const result: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) result.push(ids.slice(i, i + 100));
  return result;
}

// Count serialized CSV bytes as pages arrive, before accumulating a large export.
function readBudget() {
  let bytes = 0;
  const encoder = new TextEncoder();
  return (table: ExportTable, rows: ExportRow[], header = false) => {
    const minimumBytes = rows.reduce((total, row) => total + Object.values(row).reduce<number>((sum, value) => sum + (typeof value === 'string' ? value.length : 0), 0), 0);
    if (bytes + minimumBytes > exportReadByteLimit) throw new ExportCapacityError();
    const headerBytes = encoder.encode(exportCsv(table, [])).byteLength;
    bytes += header ? headerBytes : encoder.encode(exportCsv(table, rows)).byteLength - headerBytes;
    if (bytes > exportReadByteLimit) throw new ExportCapacityError();
  };
}

export async function readSpaceExport(client: SupabaseClient, userId: string, selectedIds: string[], signal: AbortSignal): Promise<ExportInput> {
  const ids = [...selectedIds], startedAt = new Date().toISOString();
  const available = await verifyExportAccess(client, userId, ids, signal);
  const addBudget = readBudget(), spaces: ExportSpace[] = [];
  const postflight: Array<() => Promise<void>> = [];
  for (const space of available.filter(row => ids.includes(String(row.id)))) {
    const spaceId = String(space.id);
    const tables = Object.fromEntries(exportTables.map(table => [table, [] as ExportRow[]])) as Record<ExportTable, ExportRow[]>;
    tables.space = [space]; addBudget('space', [], true); addBudget('space', [space]);
    const checks: { table: ExportTable; parents?: string[]; count: number }[] = [];
    const query = (table: ExportTable, parents?: string[], head = false) => {
      const source = table === 'members' ? 'space_members' : table === 'modules' ? 'space_modules' : table;
      let q = client.from(source).select(head ? exportColumns[table][0].name : exportSelectColumns(table), { count: 'exact', head });
      if (table === 'event_occurrence_exceptions') q = q.in('event_id', parents ?? []);
      else if (table === 'review_entries') q = q.in('review_id', parents ?? []);
      else if (table === 'list_sections') q = q.in('list_id', parents ?? []);
      else { q = q.eq('space_id', spaceId); if (parents) q = q.in('list_id', parents); }
      if (table === 'members') q = q.order('user_id');
      else if (table === 'modules') q = q.order('module_key');
      else if (table === 'review_entries') q = q.order('review_id').order('user_id');
      else q = q.order('id');
      return q.abortSignal(signal);
    };
    const read = async (table: ExportTable, parents?: string[]) => {
      const identity = (row: ExportRow) => table === 'review_entries' ? JSON.stringify([row.review_id, row.user_id]) : table === 'members' ? String(row.user_id) : table === 'modules' ? String(row.module_key) : String(row.id);
      return readExportRows(client, userId, signal, (start, end) => query(table, parents).range(start, end), identity,
        row => table === 'review_entries' ? !!parents?.includes(String(row.review_id)) : table === 'list_sections' ? !!parents?.includes(String(row.list_id)) : table === 'event_occurrence_exceptions' ? !!parents?.includes(String(row.event_id)) : row.space_id === spaceId && (!parents || parents.includes(String(row.list_id))),
        page => addBudget(table, page));
    };
    for (const table of ['members', 'modules', 'events', 'tasks', 'lists', 'important_dates', 'review_rounds'] as ExportTable[]) {
      addBudget(table, [], true); tables[table] = await read(table); checks.push({ table, count: tables[table].length });
    }
    for (const table of ['event_occurrence_exceptions', 'list_sections', 'list_items', 'review_entries'] as ExportTable[]) {
      addBudget(table, [], true);
      const parentIds = tables[table === 'event_occurrence_exceptions' ? 'events' : table === 'review_entries' ? 'review_rounds' : 'lists'].map(row => String(row.id));
      for (const parents of batches(parentIds)) {
        const page = await read(table, parents); tables[table].push(...page); checks.push({ table, parents, count: page.length });
      }
    }
    // Review children are counted ONLY within RLS-visible parent IDs, never all Space entries.
    // Independent total catches new/orphan List Items not covered by parent-ID batches.
    checks.push({ table: 'list_items', count: tables.list_items.length });
    for (const check of checks) {
      postflight.push(async () => {
        await assertExportActor(client, userId, signal);
        const count = await query(check.table, check.parents, true);
        if (count.error || count.count !== check.count) throw new Error('导出数量已变化或无法确认，请重新生成。');
      });
    }
    const order = (a: ExportRow, b: ExportRow) => String(a.list_id).localeCompare(String(b.list_id)) || String(a.section_id ?? '').localeCompare(String(b.section_id ?? ''))
      || (BigInt(String(a.sort_order)) < BigInt(String(b.sort_order)) ? -1 : BigInt(String(a.sort_order)) > BigInt(String(b.sort_order)) ? 1 : 0);
    tables.list_sections.sort(order); tables.list_items.sort(order);
    const result = { tables, expectedRows: Object.fromEntries(exportTables.map(table => [table, tables[table].length])) as Record<ExportTable, number> };
    validateExportRelations(result, userId); spaces.push(result);
  }
  for (const check of postflight) await check();
  const final = await verifyExportAccess(client, userId, ids, signal);
  if (final.map(row => row.id).join() !== available.map(row => row.id).join()) throw new Error('空间列表已变化，请重新选择。');
  return { actorId: userId, startedAt, finishedAt: new Date().toISOString(), synthetic: false, scope: 'authorized-spaces', spaces };
}
