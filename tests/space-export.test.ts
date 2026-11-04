import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { listExportSpaces, readSpaceExport, verifyExportAccess } from '../src/lib/space-export.ts';
import { generateExportZip } from '../src/lib/data-export-archive.ts';
import { syntheticActor } from './fixtures/data-export-synthetic.ts';
import { spaceExportClient } from './fixtures/space-export-client.ts';
const signal = () => new AbortController().signal;
const ids = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'];

test('one/multiple/all accessible Spaces include disabled module history with strict column casts and participant Reviews', async () => {
  const f = spaceExportClient(1);
  const spaces = await listExportSpaces(f.client, syntheticActor, signal());
  assert.deepEqual(spaces.map(s => s.id), ids);
  for (const selected of [[ids[0]], [ids[1]], ids]) {
    const result = await readSpaceExport(f.client, syntheticActor, selected, signal());
    assert.equal(result.scope, 'authorized-spaces'); assert.equal(result.spaces.length, selected.length);
    const shared = result.spaces.find(s => s.tables.space[0].kind === 'shared');
    if (shared) {
      assert.equal(shared.tables.tasks[0].assigned_to_user_id, null);
      assert.ok(shared.tables.list_items.some(row => row.section_id === null));
      assert.equal(shared.tables.list_sections[0].sort_order, '9007199254740993');
      assert.equal(shared.tables.important_dates.length, 1);
      assert.ok(shared.tables.modules.every(row => row.enabled === false));
    }
  }
  assert.ok(!f.state.calls.some(c => /profiles|push|reminder_deliveries/.test(c.table)));
  assert.ok(f.state.calls.some(c => c.columns.includes('sort_order::text')));
  assert.ok(f.state.calls.some(c => c.columns.includes('year::text')));
  assert.ok(!f.state.calls.some(c => c.columns.includes('*') || c.columns.includes('invite_code')));
});

test('each new source and child table reads 500/501/1000/1001 and low server caps; order values remain exact', async () => {
  for (const total of [500, 501, 1000, 1001]) {
    const f = spaceExportClient(total === 1001 ? 37 : 500), base = f.rows.list_items[0];
    f.rows.list_items = Array.from({ length: total }, (_, i) => ({ ...base, id: `60000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, sort_order: String(9007199254740993n + BigInt(i)) }));
    const result = await readSpaceExport(f.client, syntheticActor, ids, signal());
    assert.equal(result.spaces[1].tables.list_items.length, total);
    assert.equal(result.spaces[1].tables.list_items.at(-1).sort_order, String(9007199254740993n + BigInt(total - 1)));
  }
});

test('empty/unknown/duplicate IDs and removed membership fail before business reads', async () => {
  for (const selection of [[], ['10000000-0000-4000-8000-000000000099'], [ids[0], ids[0]]]) {
    const f = spaceExportClient(); await assert.rejects(readSpaceExport(f.client, syntheticActor, selection, signal()));
    assert.ok(!f.state.calls.some(c => c.table === 'events'));
  }
  const f = spaceExportClient(); f.rows.space_members = f.rows.space_members.filter(m => !(m.space_id === ids[1] && m.user_id === syntheticActor));
  await assert.rejects(verifyExportAccess(f.client, syntheticActor, ids, signal()));
});

test('all ID-based business sources and grouped children cross page boundaries independently', async () => {
  for (const table of ['tasks', 'lists', 'list_sections', 'important_dates', 'events']) for (const total of [501, 1001]) {
    const f = spaceExportClient(37), base = f.rows[table][0];
    f.rows[table] = Array.from({ length: total }, (_, i) => ({ ...base, id: i === 0 ? base.id : `70000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      ...(table === 'list_sections' ? { sort_order: String(9007199254740993n + BigInt(i)) } : {}) }));
    if (table === 'events') f.rows.event_occurrence_exceptions = [];
    const result = await readSpaceExport(f.client, syntheticActor, ids, signal());
    assert.equal(result.spaces[1].tables[table].length, total);
  }
});

test('query/NULL/relationship/precision anomalies reject the whole export; no fabricated empty modules', async () => {
  for (const mutate of [
    f => { f.state.fail = 'space_modules'; }, f => { f.state.nullData = true; },
    f => { f.rows.list_items[0].section_id = ids[0]; }, f => { f.rows.list_sections[0].list_id = ids[0]; },
    f => { f.rows.list_items[0].sort_order = 9007199254740993; },
    f => { f.rows.tasks[0].assigned_to_user_id = ids[0]; },
  ]) { const f = spaceExportClient(); mutate(f); await assert.rejects(readSpaceExport(f.client, syntheticActor, ids, signal())); }
});

test('ZIP independently reopens all twelve types per Space including authorized Reviews', async () => {
  const f = spaceExportClient(2), input = await readSpaceExport(f.client, syntheticActor, ids, signal());
  const zip = await generateExportZip(input);
  const r = spawnSync('python3', ['-c', `import zipfile,io,csv,json,sys
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None and len(z.namelist())==26
m=json.loads(z.read('manifest.json')); assert m['export_scope']=='authorized-spaces' and m['complete_backup'] is False
assert all(m['table_coverage'][t]=='exported' for t in ('review_rounds','review_entries'))
assert sum('/review_' in p for p in z.namelist())==4
for f in m['files']:
 rows=list(csv.reader(io.StringIO(z.read(f['path']).decode('utf-8-sig'),newline=''))); assert len(rows)-1==f['rows']
p=next(p for p in z.namelist() if p.endswith('/list_items.csv') and len(z.read(p))>250)
rows=list(csv.DictReader(io.StringIO(z.read(p).decode('utf-8-sig'),newline='')))
assert any(r['sort_order']=='int:9223372036854775807' for r in rows)
assert any(r['section_id']=='\\\\N' for r in rows)
assert '回顾' in z.read('README.txt').decode('utf8')
print('PASS')`], { input: Buffer.from(zip.bytes) });
  assert.equal(r.status, 0, r.stderr.toString());
});

test('source read budget rejects oversized inputs before ZIP, with a split-Space action message', async () => {
  const f = spaceExportClient(); f.rows.events[0].description = 'x'.repeat(16 * 1024 * 1024);
  await assert.rejects(readSpaceExport(f.client, syntheticActor, ids, signal()), /容量.*减少.*空间/);
});

test('late count changes in an earlier Space fail the whole multi-Space read', async () => {
  const f = spaceExportClient(), from = f.client.from; let changed = false;
  f.client.from = table => {
    const query = from(table), eq = query.eq;
    query.eq = (key, value) => {
      if (!changed && table === 'events' && key === 'space_id' && value === ids[1]) {
        changed = true; f.rows.tasks.push({ ...f.rows.tasks[0], id: '90000000-0000-4000-8000-000000000001', space_id: ids[0] });
      }
      return eq(key, value);
    };
    return query;
  };
  await assert.rejects(readSpaceExport(f.client, syntheticActor, ids, signal()), /数量/);
});
