import assert from 'node:assert/strict';
import test from 'node:test';
import { readSpaceExport } from '../src/lib/space-export.ts';
import { generateExportZip, prepareExport } from '../src/lib/data-export-archive.ts';
import { syntheticActor as A } from './fixtures/data-export-synthetic.ts';
import { spaceExportClient } from './fixtures/space-export-client.ts';
const B = '20000000-0000-4000-8000-000000000003', C = '20000000-0000-4000-8000-000000000002';
const spaceId = '10000000-0000-4000-8000-000000000002';
const read = (f, actor = A) => readSpaceExport(f.client, actor, [spaceId], new AbortController().signal);
const uid = i => `50000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;

// A/B old round, B left, C joined (current member). Both original entries remain.
test('participant snapshot model: new member/Owner cannot export old rounds; A keeps departed B content; rejoin restores only B rounds', async () => {
  const f = spaceExportClient(1), old = f.rows.review_rounds[0], entries = f.rows.review_entries;
  const newer = { ...old, id: uid(2), round_no: 2, review_date: '2026-11-05' };
  f.rows.review_rounds.push(newer);
  f.rows.review_entries.push(...[A, C].map(user_id => ({ ...entries[0], review_id: newer.id, user_id })));
  let input = await read(f);
  assert.equal(input.spaces[0].tables.review_rounds.length, 2);
  assert.ok(input.spaces[0].tables.review_entries.some(e => e.user_id === B));
  assert.ok(input.spaces[0].tables.modules.some(m => m.module_key === 'review' && !m.enabled));
  for (const role of ['member', 'owner']) {
    f.state.user = C; f.rows.space_members.find(m => m.space_id === spaceId && m.user_id === C).role = role;
    input = await read(f, C);
    assert.deepEqual(input.spaces[0].tables.review_rounds.map(r => r.id), [newer.id]);
    const result = prepareExport(input), text = new TextDecoder().decode(result.files['manifest.json']);
    assert.ok(!text.includes(old.id)); assert.ok(!JSON.stringify(input).includes('历史参与者'));
  }
  f.state.user = B; await assert.rejects(read(f, B));
  f.rows.space_members = f.rows.space_members.filter(m => !(m.space_id === spaceId && m.user_id === C));
  f.rows.space_members.push({ ...f.rows.space_members.find(m => m.space_id === spaceId), user_id: B, role: 'member' });
  input = await read(f, B);
  assert.deepEqual(input.spaces[0].tables.review_rounds.map(r => r.id), [old.id]);
  assert.deepEqual(new Set(input.spaces[0].tables.review_entries.map(e => e.user_id)), new Set([A, B]));
});

test('0/500/501/1000/1001 authorized rounds and composite entries paginate at low server cap', async () => {
  for (const total of [0, 500, 501, 1000, 1001]) {
    const f = spaceExportClient(total === 1001 ? 7 : 500), round = f.rows.review_rounds[0], entries = f.rows.review_entries;
    f.rows.review_rounds = Array.from({ length: total }, (_, i) => ({ ...round, id: uid(i), round_no: i + 1, review_date: new Date(Date.UTC(2020, 0, i + 1)).toISOString().slice(0, 10) }));
    f.rows.review_entries = f.rows.review_rounds.flatMap(r => entries.map(e => ({ ...e, review_id: r.id })));
    const input = await read(f);
    assert.equal(input.spaces[0].tables.review_rounds.length, total);
    assert.equal(input.spaces[0].tables.review_entries.length, total * 2);
    assert.ok(f.state.calls.filter(c => c.table === 'review_entries').every(c => c.filters.some(([key]) => key === 'review_id') && c.orders.join() === 'review_id,user_id'));
    assert.ok(f.state.calls.some(c => c.columns.includes('content_revision::text,filled_revision::text')));
    assert.equal(prepareExport(input).manifest.table_coverage.review_entries, 'exported');
  }
});

test('authorized missing/duplicate/orphan entries, revision errors, read failure and late permission/count change fail closed', async () => {
  for (const mutate of [
    f => { f.rows.review_entries.pop(); },
    f => { f.rows.review_entries.push({ ...f.rows.review_entries[0] }); },
    f => { f.rows.review_entries[0].filled_revision = '9223372036854775807'; },
    f => { f.rows.review_entries[0].content_revision = 9007199254740993; },
    f => { f.state.fail = 'review_entries'; },
    f => { f.state.beforeRead = (table, head) => { if (head && table === 'review_rounds') f.rows.review_entries = f.rows.review_entries.filter(e => e.user_id !== A); }; },
    f => { f.state.beforeRead = (table, head) => { if (head && table === 'review_entries') f.rows.space_members = []; }; },
  ]) { const f = spaceExportClient(1); mutate(f); await assert.rejects(read(f)); }
  const f = spaceExportClient(); f.rows.review_entries[0].focus = '长篇中文🐈\r\n"引号",=SUM(A1)'.repeat(2000);
  const input = await read(f); assert.equal((await generateExportZip(input)).manifest.files.length, 12);
});

test('long multi-year mixed history: aggregate budget fails explicitly; split Spaces retain all rows; longer single Space fails', async () => {
  const { longHistoryClient } = await import('./fixtures/export-long-history.ts');
  const { exportReadByteLimit } = await import('../src/lib/space-export.ts');
  const f = longHistoryClient(), ids = f.rows.spaces.map(s => s.id);
  await assert.rejects(readSpaceExport(f.client, A, ids, new AbortController().signal), /容量.*分空间/);
  for (const id of ids) {
    const input = await readSpaceExport(f.client, A, [id], new AbortController().signal);
    const prepared = prepareExport(input);
    const csvBytes = Object.entries(prepared.files).filter(([p]) => p.endsWith('.csv')).reduce((sum, [, data]) => sum + data.length, 0);
    assert.ok(csvBytes < exportReadByteLimit);
    assert.equal(input.spaces[0].tables[id === ids[0] ? 'events' : 'review_rounds'].length, id === ids[0] ? 3650 : 520);
    assert.ok((await generateExportZip(input)).bytes.length > 0);
  }
  await assert.rejects(read(longHistoryClient(1000)), /容量.*分空间/);
});

test('hidden-only history is a legitimate authorized empty export, without hidden IDs, counts or errors', async () => {
  const f = spaceExportClient(); f.state.user = C;
  const input = await read(f, C), prepared = prepareExport(input);
  assert.equal(input.spaces[0].tables.review_rounds.length, 0);
  assert.equal(input.spaces[0].tables.review_entries.length, 0);
  assert.equal(prepared.manifest.files.find(f => f.path.endsWith('/review_entries.csv')).rows, 0);
  assert.ok(!JSON.stringify(prepared.manifest).includes(f.rows.review_rounds[0].id));
});

test('independent Python reopens every CSV and compares all fields and rows with authorized reader output', async () => {
  const { spawnSync } = await import('node:child_process');
  const f = spaceExportClient(1);
  f.rows.review_entries[0].focus = '=SUM(A1),中文🐈\r\n"引号"'.repeat(500);
  const input = await readSpaceExport(f.client, A, f.rows.spaces.map(s => s.id), new AbortController().signal);
  const zip = await generateExportZip(input);
  const result = spawnSync('python3', ['-c', `import zipfile,csv,io,json,sys
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None and len(z.namelist())==26 and not z.comment
m=json.loads(z.read('manifest.json')); expected=json.loads(sys.argv[1]); assert set(m['table_coverage'].values())=={'exported'}
prefix={'text':'text:','json':'json:','bigint':'int:','date':'date:','timestamp':'time:'}
for space,original in zip(m['spaces'],expected):
 for table,rows in original['tables'].items():
  path='spaces/'+space['directory']+'/'+table+'.csv'; b=z.read(path); assert b.startswith(b'\\xef\\xbb\\xbf') and b.endswith(b'\\r\\n')
  actual=list(csv.reader(io.StringIO(b.decode('utf-8-sig'),newline=''))); fields=m['fields'][table]
  assert actual[0]==[f['name'] for f in fields] and len(actual)-1==len(rows)
  for values,row in zip(actual[1:],rows):
   want=[]
   for f in fields:
    v=row[f['name']]
    want.append('\\\\N' if v is None else prefix.get(f['type'],'')+(str(v).lower() if isinstance(v,bool) else str(v)))
   assert values==want,(table,values,want)
assert '原参与者' in z.read('README.txt').decode('utf8')
print('PASS: 26 files, all 12 CSV types, every cell matched')`, JSON.stringify(input.spaces)], { input: Buffer.from(zip.bytes) });
  assert.equal(result.status, 0, result.stderr.toString());
});

test('CSV byte budget counts each row/header once, accepts exactly 8 MiB and rejects one more byte', async () => {
  const { exportReadByteLimit } = await import('../src/lib/space-export.ts');
  const { exportCsv, exportTables } = await import('../src/lib/data-export-format.ts');
  const f = spaceExportClient(), personal = f.rows.spaces[0].id;
  f.rows.events = [{ ...f.rows.events[0], space_id: personal, scope: 'personal', owner_user_id: A, description: '' }];
  f.rows.event_occurrence_exceptions = [];
  const run = () => readSpaceExport(f.client, A, [personal], new AbortController().signal);
  const initial = await run(), tableBytes = tables => exportTables.reduce((n, t) => n + Buffer.byteLength(exportCsv(t, tables[t])), 0);
  f.rows.events[0].description = 'x'.repeat(exportReadByteLimit - tableBytes(initial.spaces[0].tables));
  assert.equal(tableBytes((await run()).spaces[0].tables), exportReadByteLimit);
  f.rows.events[0].description += 'x'; await assert.rejects(run(), /容量/);
});

test('mixed personal/shared Review parents stay isolated and an out-of-batch child response fails', async () => {
  const f = spaceExportClient(1), personalId = f.rows.spaces[0].id;
  const round = { ...f.rows.review_rounds[0], id: uid(99), space_id: personalId };
  f.rows.review_rounds.push(round);
  f.rows.review_entries.push({ ...f.rows.review_entries[0], review_id: round.id });
  const input = await readSpaceExport(f.client, A, f.rows.spaces.map(s => s.id), new AbortController().signal);
  assert.deepEqual(input.spaces.map(s => s.tables.review_entries.length), [1, 2]);
  const from = f.client.from;
  f.client.from = table => {
    const query = from(table), range = query.range;
    query.range = async (start, end) => {
      const response = await range(start, end);
      if (table === 'review_entries' && response.data?.[0]?.review_id === round.id) return { ...response, data: [f.rows.review_entries[0]], count: 1 };
      return response;
    };
    return query;
  };
  await assert.rejects(readSpaceExport(f.client, A, [personalId], new AbortController().signal));
});
