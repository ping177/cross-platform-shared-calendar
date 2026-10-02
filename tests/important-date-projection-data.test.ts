import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'vite';
import type { CurrentSpace, ImportantDate } from '../src/types.ts';

const civil = (year: number, month: number, day: number) => ({ year, month, day });
const personal = { id: 'personal', name: '我的空间', kind: 'personal', membershipRole: 'owner' } as CurrentSpace;
const shared = { ...personal, id: 'shared', kind: 'shared', membershipRole: 'member' } as CurrentSpace;
const row = (id: string, patch: Partial<ImportantDate> = {}): ImportantDate => ({
  id, space_id: shared.id, name: '生日', emoji: null, repeat_kind: 'annual', month: 2, day: 29, year: null,
  time_zone: 'Asia/Shanghai', reminder_kind: null, created_by: 'me', created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', reminder_schedule_changed_at: '2026-01-01T00:00:00Z', ...patch,
});
const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' } as any);
test.after(() => vite.close());
const adapter = await vite.ssrLoadModule('/src/lib/important-dates-data.ts');
const projection = await vite.ssrLoadModule('/src/lib/important-date-projection.ts');

// Evaluate actual PostgREST URL predicates emitted by the installed client.
// This fake is only transport/storage; it never chooses candidates for the reader.
function terms(value: string): string[] {
  const result: string[] = []; let depth = 0; let start = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '(') depth++;
    if (value[index] === ')') depth--;
    if (value[index] === ',' && depth === 0) { result.push(value.slice(start, index)); start = index + 1; }
  }
  result.push(value.slice(start)); return result;
}
function matches(record: any, expression: string): boolean {
  const group = /^(and|or)\((.*)\)$/.exec(expression);
  if (group) return group[1] === 'and' ? terms(group[2]).every((term) => matches(record, term)) : terms(group[2]).some((term) => matches(record, term));
  const [key, op, raw] = expression.split('.');
  const value = raw === 'null' ? null : raw === 'true' ? true : raw === 'false' ? false : /^\d+$/.test(raw) ? Number(raw) : raw;
  if (op === 'is' || op === 'eq') return record[key] === value;
  if (record[key] === null) return false;
  if (op === 'gt') return record[key] > value;
  if (op === 'gte') return record[key] >= value;
  if (op === 'lt') return record[key] < value;
  if (op === 'lte') return record[key] <= value;
  throw new Error(`unsupported test predicate ${expression}`);
}
function fixture() {
  const state = { user: 'me', rows: [] as ImportantDate[], spaces: [personal, shared],
    modules: [{ space_id: personal.id, enabled: true, module_key: 'important_dates' }, { space_id: shared.id, enabled: true, module_key: 'important_dates' }],
    calls: [] as URL[], alter: null as null | ((table: string, url: URL, response: { data: any[] | null; count: number | null }) => void), failure: '' };
  const client = createClient('https://example.supabase.co', 'test-anon', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (input, init) => {
    assert.equal(init?.method, 'GET'); // Projection must never write or call RPCs.
    const url = new URL(String(input)); state.calls.push(url);
    const table = url.pathname.split('/').at(-1)!;
    assert.ok(['space_modules', 'important_dates'].includes(table));
    if (state.failure === table) return new Response(JSON.stringify({ message: 'offline', code: 'test_failure' }), { status: 500 });
    let data: any[] = table === 'space_modules' ? state.modules.filter((module) => state.spaces.some((space) => space.id === module.space_id)) : state.rows;
    for (const [key, value] of url.searchParams) {
      if (key === 'or') data = data.filter((record) => matches(record, `or${value}`));
      else if (!['select', 'order', 'limit', 'offset'].includes(key)) data = data.filter((record) => matches(record, `${key}.${value}`));
    }
    const order = url.searchParams.get('order')?.split(',').map((value) => value.split('.')[0]) ?? [];
    data = [...data].sort((a, b) => {
      for (const key of order) if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
      return 0;
    });
    const count = data.length;
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? count);
    const response = { data: data.slice(offset, offset + limit) as any[] | null, count: count as number | null };
    state.alter?.(table, url, response);
    return new Response(JSON.stringify(response.data), { status: 200, headers: { 'Content-Type': 'application/json',
      'Content-Range': `0-${Math.max(0, (response.data?.length ?? 0) - 1)}/${response.count ?? '*'}` } });
  } } });
  client.auth.getUser = async () => ({ data: { user: { id: state.user } }, error: null }) as any;
  return { state, client, readSpaces: async () => state.spaces };
}
const objectCalls = (state: ReturnType<typeof fixture>['state']) => state.calls.filter((url) => url.pathname.endsWith('/important_dates'));

test('Home real query bounds future non-repeat to three per Space and pages every annual source', async () => {
  const { state, client, readSpaces } = fixture();
  state.rows = [
    ...Array.from({ length: 501 }, (_, index) => row(`a${String(index).padStart(4, '0')}`)),
    ...Array.from({ length: 8 }, (_, index) => row(`n${index}`, { repeat_kind: 'none', year: 2027, month: 3, day: index + 1 })),
    row('today', { repeat_kind: 'none', year: 2027, month: 2, day: 27 }),
    row('yesterday', { repeat_kind: 'none', year: 2027, month: 2, day: 26 }),
    row('past', { repeat_kind: 'none', year: 2026, month: 12, day: 31 }),
    row('other-space', { space_id: personal.id, repeat_kind: 'none', year: 2030, month: 1, day: 1 }),
  ];
  const result = await adapter.loadHomeImportantDates('me', civil(2027, 2, 27), client, readSpaces);
  assert.equal(result.dates.filter((date: ImportantDate) => date.repeat_kind === 'annual').length, 501);
  assert.deepEqual(result.dates.filter((date: ImportantDate) => date.space_id === shared.id && date.repeat_kind === 'none').map((date: ImportantDate) => date.id), ['today', 'n0', 'n1']);
  const queries = objectCalls(state);
  assert.equal(queries.length, 5); // Shared annual 2 pages + Personal annual 1 + two top-three reads.
  for (const query of queries.filter((url) => url.searchParams.get('repeat_kind') === 'eq.none')) {
    assert.equal(query.searchParams.get('limit'), '3');
    assert.equal(query.searchParams.get('order'), 'year.asc,month.asc,day.asc,id.asc');
    assert.ok(query.searchParams.has('or'));
  }
  assert.deepEqual(projection.homeImportantDates(result.dates, civil(2027, 2, 27)), projection.homeImportantDates(state.rows, civil(2027, 2, 27)));
});

test('Home confirmed 0/1/3/>3 and stable ties are distinct from an incomplete top-three response', async () => {
  for (const size of [0, 1, 3, 7]) {
    const { state, client, readSpaces } = fixture();
    state.rows = Array.from({ length: size }, (_, index) => row(String(index), { repeat_kind: 'none', year: 2030, month: 1, day: 1 }));
    const data = await adapter.loadHomeImportantDates('me', civil(2027, 1, 1), client, readSpaces);
    assert.deepEqual(data.dates.map((date: ImportantDate) => date.id), state.rows.slice(0, 3).map((date) => date.id));
  }
  const { state, client, readSpaces } = fixture();
  state.rows = Array.from({ length: 4 }, (_, index) => row(String(index), { repeat_kind: 'none', year: 2030 }));
  state.alter = (table, url, response) => { if (table === 'important_dates' && url.searchParams.get('repeat_kind') === 'eq.none') response.data = response.data!.slice(0, 2); };
  await assert.rejects(adapter.loadHomeImportantDates('me', civil(2027, 1, 1), client, readSpaces), /不完整/);
});

test('Calendar actual predicates narrow civil ranges, cross years, historical dates, future anchors and leap fallback', async () => {
  const sources = [row('yearless'), row('anchored', { year: 2028 }), row('future', { year: 2030, month: 9, day: 30 }),
    row('dec', { month: 12, day: 31 }), row('jan', { month: 1, day: 1 }), row('outside', { month: 7, day: 1 }),
    row('historic', { repeat_kind: 'none', year: 2000, month: 2, day: 29 }),
    row('once', { repeat_kind: 'none', year: 2027, month: 2, day: 28 }), row('later', { repeat_kind: 'none', year: 2030, month: 9, day: 30 }),
    row('filtered', { space_id: personal.id })];
  for (const range of [
    { start: civil(2027, 2, 28), end: civil(2027, 2, 28) },
    { start: civil(2028, 2, 28), end: civil(2028, 2, 28) },
    { start: civil(2028, 2, 28), end: civil(2028, 2, 29) },
    { start: civil(1900, 2, 28), end: civil(1900, 2, 28) },
    { start: civil(2000, 2, 28), end: civil(2000, 2, 28) },
    { start: civil(2100, 2, 28), end: civil(2100, 2, 28) },
    { start: civil(2026, 12, 28), end: civil(2027, 1, 3) },
    { start: civil(2000, 2, 1), end: civil(2000, 3, 13) },
    { start: civil(2030, 9, 30), end: civil(2030, 9, 30) },
    { start: civil(2027, 12, 31), end: civil(2030, 1, 1) },
  ]) {
    const { state, client, readSpaces } = fixture(); state.rows = sources;
    const result = await adapter.loadCalendarImportantDates('me', [shared.id], range, client, readSpaces);
    const expected = sources.filter((date) => date.space_id === shared.id && projection.projectImportantDates([date], range).length);
    assert.deepEqual(result.dates.map((date: ImportantDate) => date.id).sort(), expected.map((date) => date.id).sort());
    assert.equal(objectCalls(state).length, 1);
    assert.equal(objectCalls(state)[0].searchParams.get('limit'), '500');
    assert.deepEqual(projection.projectImportantDates(result.dates, range), projection.projectImportantDates(expected, range));
  }
});

test('reader snapshots today/range/display IDs before awaiting eligibility', async () => {
  const home = fixture();
  const today = civil(2027, 3, 1);
  home.state.rows = [row('today', { repeat_kind: 'none', year: 2027, month: 3, day: 1 })];
  const homeData = await adapter.loadHomeImportantDates('me', today, home.client, async () => {
    today.day = 2;
    return home.state.spaces;
  });
  assert.deepEqual(homeData.dates.map((date: ImportantDate) => date.id), ['today']);

  const calendar = fixture();
  calendar.state.rows = [row('shared-date'), row('personal-date', { space_id: personal.id })];
  const range = { start: civil(2027, 2, 28), end: civil(2027, 2, 28) };
  const ids = [shared.id];
  const calendarData = await adapter.loadCalendarImportantDates('me', ids, range, calendar.client, async () => {
    ids[0] = personal.id;
    range.start.month = 3; range.start.day = 1;
    range.end.month = 3; range.end.day = 1;
    return calendar.state.spaces;
  });
  assert.deepEqual(calendarData.dates.map((date: ImportantDate) => date.id), ['shared-date']);
});

test('disabled/missing modules, removed membership and empty display scope never query objects or fallback', async () => {
  for (const mode of ['disabled', 'missing', 'removed', 'empty-filter']) {
    const { state, client, readSpaces } = fixture(); state.rows = [row('kept')];
    if (mode === 'disabled') state.modules = state.modules.map((module) => ({ ...module, enabled: false }));
    if (mode === 'missing') state.modules = [];
    if (mode === 'removed') state.spaces = [];
    const result = await adapter.loadCalendarImportantDates('me', mode === 'empty-filter' ? [] : [shared.id], { start: civil(2027, 2, 28), end: civil(2027, 2, 28) }, client, readSpaces);
    assert.deepEqual(result.dates, []); assert.equal(objectCalls(state).length, 0); assert.equal(state.rows.length, 1);
    if (mode !== 'empty-filter') {
      assert.deepEqual((await adapter.loadHomeImportantDates('me', civil(2027, 2, 28), client, readSpaces)).dates, []);
      assert.equal(objectCalls(state).length, 0);
    }
  }
});

test('failed/null/drifting/duplicate/wrong-Space annual pages and eligibility failures reject rather than publish partial data', async () => {
  for (const mode of ['query', 'null', 'unknown-count', 'count-drift', 'duplicate', 'wrong-space', 'module-query']) {
    const { state, client, readSpaces } = fixture();
    state.rows = Array.from({ length: 501 }, (_, index) => row(String(index).padStart(4, '0')));
    if (mode === 'query') state.failure = 'important_dates';
    if (mode === 'module-query') state.failure = 'space_modules';
    state.alter = (table, url, response) => {
      if (table !== 'important_dates' || url.searchParams.get('repeat_kind') !== 'eq.annual' || url.searchParams.get('space_id') !== 'eq.shared') return;
      if (mode === 'null') response.data = null;
      if (mode === 'unknown-count') response.count = null;
      if (url.searchParams.get('offset') === '500') {
        if (mode === 'count-drift') response.count = 502;
        if (mode === 'duplicate') response.data = [state.rows[0]];
        if (mode === 'wrong-space') response.data = [row('other', { space_id: personal.id })];
      }
    };
    await assert.rejects(adapter.loadHomeImportantDates('me', civil(2027, 2, 28), client, readSpaces));
  }
});

test('Calendar complete pages reject truncation instead of claiming complete projection', async () => {
  const { state, client, readSpaces } = fixture();
  state.rows = Array.from({ length: 501 }, (_, index) => row(String(index).padStart(4, '0')));
  const range = { start: civil(2027, 2, 28), end: civil(2027, 2, 28) };
  assert.equal((await adapter.loadCalendarImportantDates('me', [shared.id], range, client, readSpaces)).dates.length, 501);
  state.alter = (table, url, response) => { if (table === 'important_dates' && url.searchParams.get('offset') === '500') response.data = []; };
  await assert.rejects(adapter.loadCalendarImportantDates('me', [shared.id], range, client, readSpaces), /不完整/);
});

test('source-time module/membership loss or auth change fails closed and publishes confirmed eligibility loss', async () => {
  for (const mode of ['module', 'membership', 'auth']) {
    const { state, client, readSpaces } = fixture(); state.rows = [row('date')];
    const scopes: any[] = [];
    state.alter = (table) => { if (table === 'important_dates') {
      if (mode === 'module') state.modules = [];
      if (mode === 'membership') state.spaces = [];
      if (mode === 'auth') state.user = 'other';
    } };
    await assert.rejects(adapter.loadHomeImportantDates('me', civil(2027, 2, 28), client, readSpaces, (scope: any) => scopes.push(scope)));
    if (mode !== 'auth') assert.equal(scopes.at(-1).eligibleSpaces.length, 0);
  }
});
