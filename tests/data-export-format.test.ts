import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { exportColumns, encodeExportCell, exportCsv, spaceDirectory } from '../src/lib/data-export-format.ts';

// Independent RFC-style CSV reader used only to inspect generated artifacts.
export function readCsv(source: string): string[][] {
  assert.ok(source.startsWith('\uFEFF'));
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 1; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === ',') { row.push(cell); cell = ''; }
    else if (!quoted && source.slice(i, i + 2) === '\r\n') {
      row.push(cell); rows.push(row); row = []; cell = ''; i++;
    } else cell += char;
  }
  assert.equal(quoted, false);
  assert.deepEqual(row, []);
  assert.equal(cell, '');
  return rows;
}

test('text and NULL encoding is reversible, including original prefixes and dangerous spreadsheet inputs', () => {
  const column = { name: 'value', type: 'text', nullable: true } as const;
  assert.equal(encodeExportCell(column, null), '\\N');
  for (const raw of ['', '\\N', 'text:', "'already", '中文🐈', '=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '\t=1', '\r\n=1', ' ＝1', 'comma,"quote"\nnext\r\nline']) {
    const encoded = encodeExportCell(column, raw);
    assert.equal(encoded.slice(5), raw);
    assert.ok(encoded.startsWith('text:'));
    assert.ok(!/^[=+@\-\s＝＋－＠]/u.test(encoded));
    const csv = exportCsv('space', [{ id: '10000000-0000-4000-8000-000000000001', name: raw, kind: 'personal', created_by: '20000000-0000-4000-8000-000000000001', created_at: '2026-11-04T01:00:00Z' }]);
    assert.equal(readCsv(csv)[1][1], encoded);
  }
});

test('bigint accepts exact text/bigint only; JSON text preserves large numeric literals', () => {
  const bigint = { name: 'revision', type: 'bigint', nullable: false } as const;
  for (const value of ['0', '9007199254740993', '9223372036854775807', '-9223372036854775808']) {
    assert.equal(encodeExportCell(bigint, value), `int:${value}`);
    assert.equal(encodeExportCell(bigint, BigInt(value)), `int:${value}`);
  }
  for (const value of [1, 9007199254740993, '9223372036854775808', '1e3', '+1', '01', '-0']) assert.throws(() => encodeExportCell(bigint, value));
  const json = { name: 'rule', type: 'json', nullable: true } as const;
  const raw = '{"title":"=1+2","n":9007199254740993,"text":"中文🐈\\n"}';
  assert.equal(encodeExportCell(json, raw), `json:${raw}`);
  assert.throws(() => encodeExportCell(json, { n: 1 }));
  assert.throws(() => encodeExportCell(json, '{broken'));
});

test('all 12 tables use only actual schema columns and retain empty-table headers', () => {
  const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  const sourceNames = { space: 'spaces', members: 'space_members', modules: 'space_modules' };
  assert.equal(Object.keys(exportColumns).length, 12);
  for (const [table, columns] of Object.entries(exportColumns)) {
    const actual = sourceNames[table as keyof typeof sourceNames] ?? table;
    const body = schema.match(new RegExp(`create table (?:if not exists )?public\\.${actual} \\(([\\s\\S]*?)\\n\\);`))?.[1];
    assert.ok(body, actual);
    for (const column of columns) assert.match(body, new RegExp(`^  ${column.name} `, 'm'));
    const csv = exportCsv(table as keyof typeof exportColumns, []);
    assert.ok(csv.endsWith('\r\n'));
    assert.deepEqual(readCsv(csv), [columns.map((column) => column.name)]);
  }
  assert.ok(!exportColumns.space.some((column) => column.name === 'invite_code'));
  assert.deepEqual(exportColumns.list_sections.map((column) => column.name), ['id', 'list_id', 'name', 'sort_order', 'created_by', 'created_at', 'updated_at']);
});

test('missing/unapproved columns, invalid identifiers and lossy text fail closed', () => {
  assert.throws(() => exportCsv('members', [{ space_id: 'bad' }]));
  const row = { space_id: '10000000-0000-4000-8000-000000000001', module_key: 'tasks', enabled: true };
  assert.throws(() => exportCsv('modules', [{ ...row, secret: 'never-export' }]));
  assert.throws(() => exportCsv('modules', [{ ...row, enabled: null }]));
  for (const value of ['\uD800', '\uDC00', 'x\uD800y', '\uD800\uD800', '\0']) {
    assert.throws(() => encodeExportCell({ name: 'text', type: 'text', nullable: false }, value));
  }
});

test('Space paths are deterministic, flat, portable and unique for identical names', () => {
  const one = '10000000-0000-4000-8000-000000000001', two = '10000000-0000-4000-8000-000000000002';
  for (const name of ['../../CON', '家人🐈', 'CON', 'nul.txt', 'a\\b/c:*?"<>|\u0000', ' . ', 'a'.repeat(400)]) {
    const path = spaceDirectory(name, one);
    assert.ok(path.endsWith(`__${one}`));
    assert.ok(!/[\\/:*?"<>|\u0000-\u001f\u007f]/u.test(path));
    assert.ok(!path.includes('..'));
    assert.ok(path.length < 150);
    assert.equal(path, spaceDirectory(name, one));
    assert.notEqual(path, spaceDirectory(name, two));
  }
  assert.throws(() => spaceDirectory('ok', '../../escape'));
});
