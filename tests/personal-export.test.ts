import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readPersonalCalendarExport, verifyPersonalExportAccess } from '../src/lib/personal-export.ts';
import { generateExportZip } from '../src/lib/data-export-archive.ts';
import { syntheticActor } from './fixtures/data-export-synthetic.ts';
import { personalExportClient } from './fixtures/personal-export-client.ts';

test('member-derived personal export reads 0/500/501/1000/1001 and low server caps without default truncation', async () => {
  for (const [total, cap] of [[0, 500], [500, 500], [501, 500], [1000, 500], [1001, 500], [501, 37]]) {
    const { client, state } = personalExportClient(total, cap);
    const result = await readPersonalCalendarExport(client, syntheticActor, new AbortController().signal);
    assert.equal(result.spaces[0].tables.events.length, total);
    assert.equal(result.scope, 'personal-calendar');
    assert.equal(result.synthetic, false);
    assert.ok(state.calls.filter(call => call.table === 'events' && !call.head).every(call => call.columns.includes('recurrence_rule::text') && !call.columns.includes('*')));
    assert.ok(!state.calls.some(call => ['tasks', 'review_entries', 'important_dates'].includes(call.table)));
  }
});

test('exceptions are batched and paginated, then ZIP independently decodes source values with explicit partial coverage', async () => {
  const f = personalExportClient(101, 37);
  f.rows.events[0].description = '中文🐈,"引号"\n'.repeat(1024);
  f.rows.event_occurrence_exceptions = Array.from({ length: 501 }, (_, i) => ({ id: `50000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, event_id: f.rows.events[0].id, occurrence_date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), exception_type: 'override', override_data: '{"title":"=1+2🐈","n":9007199254740993}', created_at: '2026-11-04T00:00:00Z', updated_at: '2026-11-04T00:00:00Z' }));
  const input = await readPersonalCalendarExport(f.client, syntheticActor, new AbortController().signal);
  assert.equal(input.spaces[0].tables.event_occurrence_exceptions.length, 501);
  assert.equal(input.spaces[0].tables.events[0].description, f.rows.events[0].description);
  const zip = await generateExportZip(input);
  const output = spawnSync('python3', ['-c', `import sys,io,zipfile,json,csv
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None
m=json.loads(z.read('manifest.json')); assert m['complete_backup'] is False
assert m['table_coverage']['tasks']=='not_included'
assert m['table_coverage']['events']=='exported'
assert not any(p.endswith('/任务.csv') for p in z.namelist())
p=next(p for p in z.namelist() if p.endswith('/重复日程调整.csv'))
rows=list(csv.DictReader(io.StringIO(z.read(p).decode('utf-8-sig'),newline='')))
assert len(rows)==501
assert rows[0]['调整内容']=='json:{"title":"=1+2🐈","n":9007199254740993}'
p=next(p for p in z.namelist() if p.endswith('/日程.csv'))
events=list(csv.DictReader(io.StringIO(z.read(p).decode('utf-8-sig'),newline='')))
assert events[0]['日程说明']=='text:'+('中文🐈,"引号"\\n'*1024)
assert events[0]['结束时间']=='\\\\N'
assert '阶段性' in z.read('README.txt').decode('utf8')
print('PASS')`], { input: Buffer.from(zip.bytes) });
  assert.equal(output.status, 0, output.stderr.toString());
});

test('missing/ambiguous personal membership, count drift, duplicate pages, NULL payload and read errors fail closed', async () => {
  for (const mutate of [
    f => { f.rows.space_members = []; }, f => { f.rows.spaces[0].kind = 'shared'; },
    f => { f.rows.spaces.push({ ...f.rows.spaces[0], id: '10000000-0000-4000-8000-000000000099' }); f.rows.space_members.push({ ...f.rows.space_members[0], space_id: f.rows.spaces[1].id }); },
    f => { f.state.drift = true; }, f => { f.state.duplicate = true; }, f => { f.state.nullData = true; }, f => { f.state.fail = 'events'; },
    f => { f.state.user = ''; },
  ]) { const f = personalExportClient(501); mutate(f); await assert.rejects(readPersonalCalendarExport(f.client, syntheticActor, new AbortController().signal)); }
});

test('abort/account change after an in-flight page cannot publish a result; expected Space is checked against fresh membership', async () => {
  for (const mode of ['abort', 'account', 'logout']) {
    const f = personalExportClient(); f.state.blocked = true;
    const controller = new AbortController(); const result = readPersonalCalendarExport(f.client, syntheticActor, controller.signal);
    while (!f.state.release) await new Promise(resolve => setTimeout(resolve, 1));
    if (mode === 'abort') controller.abort(); else f.state.user = mode === 'logout' ? '' : '20000000-0000-4000-8000-000000000099';
    f.state.release(); await assert.rejects(result);
  }
  const f = personalExportClient();
  await assert.rejects(verifyPersonalExportAccess(f.client, syntheticActor, new AbortController().signal, '10000000-0000-4000-8000-000000000099'));
});
