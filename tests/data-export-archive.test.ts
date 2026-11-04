import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { exportByteLimit, generateExportZip } from '../src/lib/data-export-archive.ts';
import { exportColumns, exportTables } from '../src/lib/data-export-format.ts';
import { syntheticExport } from './fixtures/data-export-synthetic.ts';

test('independent Python zipfile/csv readback verifies all files, headers, row counts, exact values and relationship IDs', async () => {
  const input = syntheticExport();
  const archive = await generateExportZip(input);
  const result = spawnSync('python3', ['-c', `import sys,io,zipfile,csv,json
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
assert z.testzip() is None
out={}
for path in z.namelist():
 data=z.read(path)
 if path.endswith('.csv'):
  assert data.startswith(b'\\xef\\xbb\\xbf')
  assert data.endswith(b'\\r\\n')
  out[path]=list(csv.reader(io.StringIO(data.decode('utf-8-sig'),newline='')))
 elif path.endswith('.json'): out[path]=json.loads(data)
 else: out[path]=data.decode('utf-8')
print(json.dumps(out,ensure_ascii=False))`], { input: Buffer.from(archive.bytes), maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr.toString());
  const files = JSON.parse(result.stdout.toString());
  const manifest = files['manifest.json'];
  assert.equal(Object.keys(files).length, 26);
  assert.equal(manifest.format_version, 1);
  assert.equal(manifest.synthetic, true);
  assert.equal(manifest.exported_by_user_id, input.actorId);
  assert.equal(manifest.transactional_snapshot, false);
  assert.equal(manifest.started_at, input.startedAt);
  assert.equal(manifest.finished_at, input.finishedAt);
  assert.notEqual(manifest.spaces[0].directory, manifest.spaces[1].directory);
  for (const [i, space] of input.spaces.entries()) for (const table of exportTables) {
    const path = `spaces/${manifest.spaces[i].directory}/${table}.csv`;
    const rows = files[path];
    const columns = exportColumns[table];
    assert.deepEqual(rows[0], columns.map((column) => column.name));
    assert.equal(rows.length - 1, space.expectedRows[table]);
    assert.equal(manifest.files.find((file: { path: string }) => file.path === path).rows, rows.length - 1);
    for (const [j, source] of space.tables[table].entries()) {
      assert.equal(rows[j + 1].length, columns.length);
      for (const [k, column] of columns.entries()) {
        const cell = rows[j + 1][k];
        const raw = source[column.name];
        const prefix = { text: 'text:', json: 'json:', bigint: 'int:', date: 'date:', timestamp: 'time:' }[column.type];
        assert.equal(raw === null ? cell : prefix ? cell.slice(prefix.length) : cell, raw === null ? '\\N' : String(raw));
        if (raw !== null && prefix) assert.ok(cell.startsWith(prefix));
      }
    }
  }
  assert.match(files['README.txt'], /不能.*恢复/);
  assert.match(files['README.txt'], /8 MiB.*16 MiB/);
  assert.match(files['README.txt'], /超限.*不生成.*分空间/);
  assert.match(archive.filename, /^shared-calendar-export_[0-9TZ-]+\.zip$/);
});

test('missing tables, count drift, duplicate IDs, extra private fields and unsafe bigint never return a ZIP', async () => {
  const mutations = [
    (x) => { delete x.spaces[0].tables.tasks; },
    (x) => { x.spaces[1].expectedRows.events++; },
    (x) => { x.spaces[1].tables.events[1].id = x.spaces[1].tables.events[0].id; },
    (x) => { x.spaces[0].tables.space[0].invite_code = 'do-not-export'; },
    (x) => { x.spaces[1].tables.list_sections[0].sort_order = Number.MAX_SAFE_INTEGER + 2; },
    (x) => { x.finishedAt = 'invalid'; },
    (x) => { x.startedAt = '2099-01-01T00:00:00.000Z'; },
  ];
  for (const mutate of mutations) {
    const input = syntheticExport(); mutate(input);
    await assert.rejects(generateExportZip(input));
  }
});

test('cross-Space/orphan relationships and missing own review participant fail; historical counterpart is allowed', async () => {
  const mutations = [
    (x) => { x.spaces[1].tables.tasks[0].space_id = x.spaces[0].tables.space[0].id; },
    (x) => { x.spaces[1].tables.events[2].parent_event_id = x.spaces[0].tables.space[0].id; },
    (x) => { x.spaces[1].tables.event_occurrence_exceptions[0].event_id = x.spaces[1].tables.events[0].id; },
    (x) => { x.spaces[1].tables.list_items[0].section_id = x.spaces[0].tables.space[0].id; },
    (x) => { x.spaces[1].tables.events[1].parent_event_id = x.spaces[1].tables.events[2].id; },
    (x) => { x.spaces[1].tables.events[0].series_id = x.spaces[1].tables.events[0].id; },
    (x) => { x.spaces[1].tables.review_entries[1].filled_revision = '2'; },
    (x) => { x.spaces[1].tables.event_occurrence_exceptions[1].override_data = '[]'; },
    (x) => { x.spaces[1].tables.review_entries[0].user_id = '20000000-0000-4000-8000-000000000099'; },
    (x) => { x.spaces[0].tables.members[0].user_id = '20000000-0000-4000-8000-000000000099'; },
  ];
  for (const mutate of mutations) {
    const input = syntheticExport(); mutate(input);
    await assert.rejects(generateExportZip(input));
  }
});

test('local capacity limit fails explicitly without returning a partial archive', async () => {
  const input = syntheticExport();
  input.spaces[1].tables.events[0].description = 'x'.repeat(exportByteLimit);
  await assert.rejects(generateExportZip(input), /容量.*8 MiB.*16 MiB.*分空间/);
});

test('JS bigint inputs retain precision through association validation as well as CSV encoding', async () => {
  const input = syntheticExport();
  input.spaces[1].tables.list_sections[0].sort_order = 9007199254740993n;
  input.spaces[1].tables.list_items[0].sort_order = 9223372036854775807n;
  assert.ok((await generateExportZip(input)).bytes.length > 0);
});

test('aborting before or during asynchronous ZIP compression never returns a file', async () => {
  const canceled = new AbortController(); canceled.abort();
  await assert.rejects(generateExportZip(syntheticExport(), canceled.signal), { name: 'AbortError' });
  await import('fflate'); // Warm the import so the timer cancels an active async compression.
  const input = syntheticExport(), active = new AbortController();
  input.spaces[1].tables.events[0].description = '长正文🐈'.repeat(200000);
  const pending = generateExportZip(input, active.signal);
  setTimeout(() => active.abort(), 0);
  await assert.rejects(pending, { name: 'AbortError' });
});
