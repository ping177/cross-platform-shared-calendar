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
  const columns = exportColumns[table];
  const names = new Set(columns.map((column) => column.name));
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [columns.map((column) => quote(column.name)).join(',')];
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
