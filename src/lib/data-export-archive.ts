import { assertExportUuid, exportColumns, exportCsv, exportTables, spaceDirectory, type ExportRow, type ExportTable } from './data-export-format.ts';

export type ExportSpace = { tables: Record<ExportTable, ExportRow[]>; expectedRows: Record<ExportTable, number> };
export type ExportInput = { actorId: string; startedAt: string; finishedAt: string; synthetic: boolean; spaces: ExportSpace[]; scope?: 'personal-calendar' | 'core-spaces' | 'authorized-spaces' };
export const personalCalendarTables: ExportTable[] = ['space', 'members', 'events', 'event_occurrence_exceptions'];
export const coreSpaceTables = exportTables.filter(table => table !== 'review_rounds' && table !== 'review_entries');
export const exportByteLimit = 16 * 1024 * 1024;
export class ExportCapacityError extends Error {
  constructor() { super('导出数据超过本地容量（CSV 读取预算 8 MiB／文件组装保护 16 MiB），请减少所选空间、尝试分空间导出；单个空间仍超限时，暂时无法导出。'); this.name = 'ExportCapacityError'; }
}

const readme = `共享日历数据导出（格式 1）
格式说明作者：Ping Weng

spaces 内按 Space 与数据类型组织 CSV，空表保留表头。ID 保持原值，通过 ID 关联，不按创建者判断归属。
CSV 为 UTF-8 BOM、逗号分隔、CRLF 记录结束、双引号引用；正文内部换行保持原样。
NULL 编码为反斜杠加 N（\\N）；空字符串编码为 text:。非空文本统一以 text: 开头，去掉一次前缀即可得到原文，包括原本就含前缀的内容。
JSON 以 json: 开头，去掉一次前缀后仍是原始 JSON 文本，勿先转为 JavaScript 浮点数。
bigint 以 int: 开头，后接精确十进制整数；日期以 date: 开头；时间戳以 time: 开头。布尔值为 true/false，小整数和 UUID 原样。
这些前缀是文件值的一部分，用来阻止公式解释和自动类型改写。请勿在表格中批量去除前缀后打开不可信内容。重新编码、编辑或使用忽略此合同的解析器后，不保证公式安全或精度。
日期不作 UTC 转换，时间戳保留返回值，time_zone 字段单独保留。重复日程导出源段、规则和例外，不展开无限未来；recurrence_until 为排他截止。
共享内容可能包含其他成员的记录。仅导出当前成员资格与 RLS 允许读取的数据；回顾仅包含本人作为原参与者且当前仍获授权的轮次，以及该轮所有原参与者的条目（包括已离开者）。新成员或新 Owner 不因此获得未参加的历史；不可见历史不在文件或计数范围内。关闭模块的可读历史仍包含，不能为补齐关系而越权读取。
manifest 记录数据准备起止时间（不包含随后 ZIP 压缩及用户保存耗时）、Space、CSV 行数与有序字段定义；这是非事务快照，不能保证所有记录来自同一数据库时点。
manifest 中 synthetic=true 表示合成样本数据。数据来源、授权与读取完整性由读取端核验，文件组装本身不证明数据库权限或线上兼容性。
当前读取器累计 CSV 预算为 8 MiB，最终文件组装保护为 16 MiB；它们不是 ZIP 压缩后大小或手机内存上限。超限整体失败、不生成部分文件，请尝试分空间导出；单个空间仍超限时暂时无法导出。
首版不能将此文件导入应用或恢复账号／已删除数据。本文件未加密，请自行妥善保存。
`;

function invalid(): never { throw new Error('导出数据计数、身份或关联异常，未生成 ZIP。'); }

export function validateExportRelations(space: ExportSpace, actorId: string) {
  const t = space.tables, meta = t.space[0], spaceId = meta.id;
  const byId = (rows: ExportRow[]) => new Map(rows.map((row) => [row.id, row]));
  const members = new Set(t.members.map((row) => row.user_id));
  if (!members.has(actorId) || !['personal', 'shared'].includes(String(meta.kind))) invalid();
  if (meta.kind === 'personal' && (members.size !== 1 || !members.has(actorId))) invalid();
  for (const table of exportTables) for (const row of t[table]) {
    if ('space_id' in row && row.space_id !== spaceId) invalid();
  }
  const events = byId(t.events), lists = byId(t.lists), sections = byId(t.list_sections), rounds = byId(t.review_rounds);
  const checkedParents = new Set<unknown>();
  for (const event of t.events) {
    if (event.recurrence_rule === null && (event.series_id !== null || event.parent_event_id !== null)) invalid();
    if (event.scope !== 'shared' && event.scope !== 'personal') invalid();
    if (event.scope === 'shared' ? event.owner_user_id !== null : !members.has(event.owner_user_id)) invalid();
    for (const key of ['series_id', 'parent_event_id']) if (event[key] !== null) {
      const parent = events.get(event[key]);
      if (!parent || parent.scope !== event.scope || parent.owner_user_id !== event.owner_user_id
        || (parent.series_id ?? parent.id) !== (event.series_id ?? event.id)) invalid();
    }
    const seen = new Set<unknown>([event.id]);
    let parent = event.parent_event_id;
    while (parent !== null && !checkedParents.has(parent)) {
      if (seen.has(parent)) invalid();
      const source = events.get(parent);
      if (!source) invalid();
      seen.add(parent); parent = source.parent_event_id;
    }
    seen.forEach((id) => checkedParents.add(id));
  }
  for (const exception of t.event_occurrence_exceptions) {
    if (!events.get(exception.event_id)?.recurrence_rule) invalid();
    if (exception.exception_type === 'deleted') {
      if (exception.override_data !== null) invalid();
    } else {
      if (exception.exception_type !== 'override' || !exception.override_data) invalid();
      const override = JSON.parse(String(exception.override_data));
      if (!override || typeof override !== 'object' || Array.isArray(override)) invalid();
    }
  }
  for (const task of t.tasks) if (task.assigned_to_user_id !== null && !members.has(task.assigned_to_user_id)) invalid();
  for (const section of t.list_sections) if (!lists.has(section.list_id)) invalid();
  for (const item of t.list_items) if (!lists.has(item.list_id) || (item.section_id !== null && sections.get(item.section_id)?.list_id !== item.list_id)) invalid();
  const entriesByRound = new Map<unknown, ExportRow[]>();
  for (const entry of t.review_entries) {
    if (!rounds.has(entry.review_id) || BigInt(String(entry.content_revision)) < 0n
      || (entry.filled_revision !== null && (BigInt(String(entry.filled_revision)) <= 0n || BigInt(String(entry.filled_revision)) > BigInt(String(entry.content_revision))))) invalid();
    const entries = entriesByRound.get(entry.review_id) ?? [];
    entries.push(entry); entriesByRound.set(entry.review_id, entries);
  }
  for (const round of t.review_rounds) {
    const entries = entriesByRound.get(round.id) ?? [];
    if (!entries.some((entry) => entry.user_id === actorId) || entries.length !== (meta.kind === 'personal' ? 1 : 2)) invalid();
  }
  const unique = (rows: ExportRow[], keys: string[]) => {
    if (new Set(rows.map((row) => JSON.stringify(keys.map((key) => typeof row[key] === 'bigint' ? String(row[key]) : row[key])))).size !== rows.length) invalid();
  };
  unique(t.event_occurrence_exceptions, ['event_id', 'occurrence_date']);
  unique(t.review_rounds, ['review_date']); unique(t.review_rounds, ['round_no']);
  unique(t.list_sections, ['list_id', 'sort_order']); unique(t.list_items, ['list_id', 'section_id', 'sort_order']);
}

export function prepareExport(input: ExportInput) {
  assertExportUuid(input.actorId);
  if (!Number.isFinite(Date.parse(input.startedAt)) || !Number.isFinite(Date.parse(input.finishedAt))
    || Date.parse(input.startedAt) > Date.parse(input.finishedAt) || !input.spaces.length || typeof input.synthetic !== 'boolean') invalid();
  const encoder = new TextEncoder(), files: Record<string, Uint8Array> = {};
  const included = input.scope === 'personal-calendar' ? personalCalendarTables : input.scope === 'core-spaces' ? coreSpaceTables : exportTables;
  if (input.scope !== undefined && input.scope !== 'personal-calendar' && input.scope !== 'core-spaces' && input.scope !== 'authorized-spaces') invalid();
  if (input.scope === 'personal-calendar' && (input.spaces.length !== 1 || input.spaces[0].tables.space[0]?.kind !== 'personal')) invalid();
  const manifest = {
    format_version: 1, synthetic: input.synthetic, exported_by_user_id: input.actorId, started_at: input.startedAt, finished_at: input.finishedAt,
    transactional_snapshot: false, includes_disabled_modules: true,
    export_scope: input.scope ?? 'all-modules', complete_backup: false,
    authorization_scope: '仅当前成员资格及RLS允许读取的记录；回顾限本人为原参与者的可见轮次及其全部原参与者条目，不统计不可见历史',
    table_coverage: Object.fromEntries(exportTables.map((table) => [table, included.includes(table) ? 'exported' : 'not_included'])),
    encoding: { charset: 'UTF-8-BOM', record_separator: 'CRLF', null: '\\N', text: 'text:', json: 'json:', bigint: 'int:', date: 'date:', timestamp: 'time:', integer: 'decimal-int32', boolean: 'true/false', uuid: 'canonical-lowercase' },
    fields: exportColumns,
    spaces: [] as { id: string; name: string; kind: string; directory: string }[],
    files: [] as { path: string; rows: number }[],
    limitations: ['非数据库单一时点快照', '起止时间为数据准备区间，不含 ZIP 压缩和保存', '计数与授权由调用读取器独立核验', '不支持导入或恢复'],
  };
  const seen = new Map<ExportTable, Set<string>>(exportTables.map((table) => [table, new Set()]));
  let bytes = 0;
  const addFile = (path: string, value: string) => {
    const encoded = encoder.encode(value); bytes += encoded.byteLength;
    if (bytes > exportByteLimit) throw new ExportCapacityError();
    if (files[path]) invalid();
    files[path] = encoded;
  };
  for (const space of input.spaces) {
    if (Object.keys(space.tables).length !== exportTables.length || Object.keys(space.expectedRows).length !== exportTables.length) invalid();
    if (space.tables.space?.length !== 1) invalid();
    const meta = space.tables.space[0];
    if (typeof meta.name !== 'string') invalid();
    const directory = spaceDirectory(meta.name, String(meta.id));
    for (const table of exportTables) {
      const rows = space.tables[table], count = space.expectedRows[table];
      if (!Array.isArray(rows) || !Number.isSafeInteger(count) || count !== rows.length) invalid();
      if (!included.includes(table)) { if (rows.length) invalid(); continue; }
      const csv = exportCsv(table, rows);
      for (const row of rows) {
        const keys = table === 'members' ? ['space_id', 'user_id'] : table === 'modules' ? ['space_id', 'module_key'] : table === 'review_entries' ? ['review_id', 'user_id'] : ['id'];
        const identity = JSON.stringify(keys.map((key) => row[key]));
        if (seen.get(table)!.has(identity)) invalid();
        seen.get(table)!.add(identity);
      }
      const path = `spaces/${directory}/${table}.csv`;
      addFile(path, csv); manifest.files.push({ path, rows: count });
    }
    validateExportRelations(space, input.actorId);
    manifest.spaces.push({ id: String(meta.id), name: meta.name, kind: String(meta.kind), directory });
  }
  const scopeNote = input.scope === 'personal-calendar' ? '阶段性导出：仅个人空间日程及重复例外，不是完整备份。\n包含space、members、events、event_occurrence_exceptions。\nmodules、任务、清单、重要日、回顾尚未纳入，标记not_included且不生成对应CSV；不能解释为已查询为空。\n\n' : input.scope === 'core-spaces' ? '阶段性导出：所选个人及共享空间的日程、任务、清单、重要日和空间设置。\n回顾review_rounds、review_entries尚未纳入，标记not_included且不生成CSV；这不是包含回顾的完整备份。\n关闭模块的可读历史仍包含；成员仅导出当前授权成员ID/角色/加入时间，不越权解析历史昵称。\n\n' : '';
  addFile('README.txt', (scopeNote + readme).replace(/\n/g, '\r\n'));
  addFile('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  const filename = `shared-calendar-export_${new Date(input.finishedAt).toISOString().replace(/[:.]/g, '-')}.zip`;
  return { files, manifest, filename };
}

export async function generateExportZip(input: ExportInput, signal?: AbortSignal) {
  // No result escapes until ALL tables and relations validate and compression succeeds.
  const assertActive = () => { if (signal?.aborted) throw new DOMException('导出已取消。', 'AbortError'); };
  assertActive();
  const prepared = prepareExport(input);
  const { zip } = await import('fflate');
  assertActive();
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    let terminate = () => {};
    const abort = () => { terminate(); reject(new DOMException('导出已取消。', 'AbortError')); };
    const cleanup = () => signal?.removeEventListener('abort', abort);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      terminate = zip(prepared.files, { level: 6 }, (error, data) => { cleanup(); error ? reject(error) : resolve(data); });
    } catch (error) { cleanup(); reject(error); }
  });
  assertActive();
  return { bytes, manifest: prepared.manifest, filename: prepared.filename };
}
