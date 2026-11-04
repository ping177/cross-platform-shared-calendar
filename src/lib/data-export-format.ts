export type ExportColumn = { name: string; type: 'uuid' | 'text' | 'date' | 'timestamp' | 'integer' | 'bigint' | 'boolean' | 'json'; nullable: boolean };
export type ExportRow = Record<string, unknown>;
const field = (name: string, type: ExportColumn['type'], nullable = false): ExportColumn => ({ name, type, nullable });
const id = (name = 'id', nullable = false) => field(name, 'uuid', nullable);
const text = (name: string, nullable = false) => field(name, 'text', nullable);
const time = (name: string, nullable = false) => field(name, 'timestamp', nullable);
const audit = () => [id('created_by'), time('created_at'), time('updated_at')];

// Source of truth for CSV order and manifest definitions. Never select '*'.
export const exportColumns = {
  space: [id(), text('name'), text('kind'), id('created_by'), time('created_at')],
  members: [id('space_id'), id('user_id'), text('role'), time('joined_at')],
  modules: [id('space_id'), text('module_key'), field('enabled', 'boolean')],
  events: [id(), id('space_id'), id('created_by'), text('scope'), id('owner_user_id', true), text('title'), text('description', true),
    time('starts_at'), time('ends_at', true), field('all_day', 'boolean'), text('reminder_kind', true), text('time_zone', true),
    time('reminder_schedule_changed_at'), field('recurrence_rule', 'json', true), id('series_id', true), id('parent_event_id', true),
    time('recurrence_until', true), time('created_at'), time('updated_at')],
  event_occurrence_exceptions: [id(), id('event_id'), field('occurrence_date', 'date'), text('exception_type'), field('override_data', 'json', true), time('created_at'), time('updated_at')],
  tasks: [id(), id('space_id'), id('created_by'), id('assigned_to_user_id', true), text('title'), text('status'), field('due_on', 'date', true),
    time('created_at'), time('updated_at'), text('reminder_kind', true), text('time_zone', true), time('reminder_schedule_changed_at')],
  lists: [id(), id('space_id'), text('name'), ...audit()],
  list_sections: [id(), id('list_id'), text('name'), field('sort_order', 'bigint'), ...audit()],
  list_items: [id(), id('list_id'), id('space_id'), id('section_id', true), text('content'), field('completed', 'boolean'), field('sort_order', 'bigint'), ...audit()],
  important_dates: [id(), id('space_id'), text('name'), text('emoji', true), text('repeat_kind'), field('month', 'integer'), field('day', 'integer'),
    field('year', 'bigint', true), text('reminder_kind', true), text('time_zone'), time('reminder_schedule_changed_at'), ...audit()],
  review_rounds: [id(), id('space_id'), field('round_no', 'integer'), field('review_date', 'date'), id('created_by'), time('created_at')],
  review_entries: [id('review_id'), id('user_id'), text('focus', true), text('progress', true), text('problems', true), text('next_plan', true),
    field('content_revision', 'bigint'), field('filled_revision', 'bigint', true), time('updated_at')],
} satisfies Record<string, ExportColumn[]>;

export type ExportTable = keyof typeof exportColumns;
export const exportTables = Object.keys(exportColumns) as ExportTable[];
// Format 2 presentation only. Source whitelist/query order above stays unchanged.
export const exportPresentation = {
  space: { filename: '空间信息.csv', fields: [['name','空间名称'],['kind','空间类型'],['created_at','创建时间'],['id','空间ID'],['created_by','创建者ID']] },
  members: { filename: '空间成员.csv', fields: [['role','成员角色'],['joined_at','加入时间'],['user_id','成员ID'],['space_id','空间ID']] },
  modules: { filename: '功能设置.csv', fields: [['module_key','功能标识'],['enabled','是否启用'],['space_id','空间ID']] },
  events: { filename: '日程.csv', fields: [['title','日程标题'],['description','日程说明'],['starts_at','开始时间'],['ends_at','结束时间'],['all_day','是否全天'],['time_zone','时区'],['scope','可见范围'],['reminder_kind','提醒方式'],['recurrence_rule','重复规则'],['recurrence_until','重复截止时间（不含）'],['created_at','创建时间'],['updated_at','修改时间'],['id','日程ID'],['space_id','空间ID'],['created_by','创建者ID'],['owner_user_id','个人日程所属成员ID'],['series_id','重复系列ID'],['parent_event_id','上一日程段ID'],['reminder_schedule_changed_at','提醒计划变更时间']] },
  event_occurrence_exceptions: { filename: '重复日程调整.csv', fields: [['occurrence_date','原定发生日期'],['exception_type','调整类型'],['override_data','调整内容'],['created_at','创建时间'],['updated_at','修改时间'],['id','调整记录ID'],['event_id','日程ID']] },
  tasks: { filename: '任务.csv', fields: [['title','任务标题'],['status','任务状态'],['due_on','截止日期'],['reminder_kind','提醒方式'],['time_zone','时区'],['created_at','创建时间'],['updated_at','修改时间'],['id','任务ID'],['space_id','空间ID'],['assigned_to_user_id','指派成员ID'],['created_by','创建者ID'],['reminder_schedule_changed_at','提醒计划变更时间']] },
  lists: { filename: '清单.csv', fields: [['name','清单名称'],['created_at','创建时间'],['updated_at','修改时间'],['id','清单ID'],['space_id','空间ID'],['created_by','创建者ID']] },
  list_sections: { filename: '清单分组.csv', fields: [['name','分组名称'],['sort_order','排列顺序'],['created_at','创建时间'],['updated_at','修改时间'],['id','分组ID'],['list_id','清单ID'],['created_by','创建者ID']] },
  list_items: { filename: '清单事项.csv', fields: [['content','事项内容'],['completed','是否完成'],['sort_order','排列顺序'],['created_at','创建时间'],['updated_at','修改时间'],['id','事项ID'],['list_id','清单ID'],['section_id','分组ID'],['space_id','空间ID'],['created_by','创建者ID']] },
  important_dates: { filename: '重要日.csv', fields: [['name','重要日名称'],['emoji','表情符号'],['repeat_kind','重复方式'],['month','月份'],['day','日期（日）'],['year','年份'],['reminder_kind','提醒方式'],['time_zone','时区'],['created_at','创建时间'],['updated_at','修改时间'],['id','重要日ID'],['space_id','空间ID'],['created_by','创建者ID'],['reminder_schedule_changed_at','提醒计划变更时间']] },
  review_rounds: { filename: '回顾记录.csv', fields: [['review_date','回顾日期'],['round_no','回顾轮次'],['created_at','创建时间'],['id','回顾记录ID'],['space_id','空间ID'],['created_by','创建者ID']] },
  review_entries: { filename: '回顾内容.csv', fields: [['focus','近期专注事项'],['progress','近期进展'],['problems','面临问题'],['next_plan','下一步计划'],['updated_at','修改时间'],['review_id','回顾记录ID'],['user_id','参与者ID'],['content_revision','内容版本号'],['filled_revision','已确认填写版本号']] },
} as const;
export const exportCsvColumns = Object.fromEntries(exportTables.map(table => {
  const columns = exportPresentation[table].fields.map(([name, label]) => {
    const source = exportColumns[table].find(column => column.name === name);
    if (!source) throw new Error('导出列映射不完整。');
    return { ...source, label };
  });
  if (columns.length !== exportColumns[table].length || new Set(columns.map(c => c.name)).size !== columns.length
    || new Set(columns.map(c => c.label)).size !== columns.length) throw new Error('导出列映射重复或缺失。');
  return [table, columns];
})) as Record<ExportTable, (ExportColumn & { label: string })[]>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function assertExportUuid(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !uuid.test(value)) throw new Error('导出 ID 无效。');
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

export function encodeExportCell(column: ExportColumn, value: unknown): string {
  const fail = () => { throw new Error(`导出字段 ${column.name} 的类型或编码无效。`); };
  if (value === null) return column.nullable ? '\\N' : fail();
  switch (column.type) {
    case 'uuid': assertExportUuid(value); return value;
    case 'boolean': return typeof value === 'boolean' ? String(value) : fail();
    case 'integer': return typeof value === 'number' && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647 ? String(value) : fail();
    case 'bigint': {
      if (typeof value !== 'string' && typeof value !== 'bigint') return fail();
      const raw = String(value);
      if (raw.length > 20 || !/^(?:0|-?[1-9]\d*)$/.test(raw)) return fail();
      const exact = BigInt(raw);
      return exact >= -9223372036854775808n && exact <= 9223372036854775807n ? `int:${raw}` : fail();
    }
    default: {
      if (typeof value !== 'string' || value.includes('\0') || hasUnpairedSurrogate(value)) return fail();
      if (column.type === 'json') {
        try { JSON.parse(value); } catch { return fail(); }
        return `json:${value}`;
      }
      // Literal prefixes survive CSV parsing; no Excel-specific quote/tab behavior.
      const prefix = column.type === 'timestamp' ? 'time' : column.type;
      return `${prefix}:${value}`;
    }
  }
}

export function exportCsv(table: ExportTable, rows: ExportRow[]): string {
  const columns = exportCsvColumns[table];
  const names = new Set(columns.map((column) => column.name));
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [columns.map((column) => quote(column.label)).join(',')];
  for (const row of rows) {
    if (!row || Object.keys(row).length !== names.size || Object.keys(row).some((key) => !names.has(key)) || columns.some((column) => !Object.prototype.hasOwnProperty.call(row, column.name))) {
      throw new Error(`导出 ${table} 字段不完整或包含未批准字段。`);
    }
    lines.push(columns.map((column) => quote(encodeExportCell(column, row[column.name]))).join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

export function spaceDirectory(name: string, spaceId: string): string {
  assertExportUuid(spaceId);
  const safe = Array.from(name.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, '_').replace(/\.+/g, '_').trim()).slice(0, 40).join('').replace(/[. ]+$/g, '');
  // Fixed prefix also avoids Windows device names (CON, NUL, COM1, etc.).
  return `space_${safe || '未命名'}__${spaceId}`;
}
