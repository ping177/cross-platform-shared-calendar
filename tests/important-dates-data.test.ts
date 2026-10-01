import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { CurrentSpace, ImportantDate } from '../src/types.ts';
const space = { id: 'shared', kind: 'shared', created_by: 'other', membershipRole: 'member' } as CurrentSpace;
const row = { id: 'date-a', space_id: space.id, name: '生日', emoji: null, repeat_kind: 'annual', month: 2, day: 29, year: null,
  time_zone: 'Asia/Shanghai', reminder_kind: null, created_by: 'other', created_at: '2026-09-30T00:00:00Z', updated_at: '2026-09-30T00:00:00Z', reminder_schedule_changed_at: '2026-09-30T00:00:00Z' } as ImportantDate;
function fake() {
  const state = { user: 'me', rows: [row], modules: [{ space_id: space.id, enabled: true }], spaces: [space], calls: [] as unknown[], result: null as any, fail: false };
  const client = {
    auth: { async getUser() { return { data: { user: { id: state.user } }, error: null }; } },
    from(table: string) {
      const filters: Record<string, unknown> = {};
      return { select(columns: string, opts?: unknown) { state.calls.push(['select', table, columns, opts]); return this; },
        eq(key: string, value: unknown) { filters[key] = value; return this; }, order(key: string) { state.calls.push(['order', table, key]); return this; },
        async range(start: number, end: number) {
          state.calls.push(['range', table, start, end]);
          if (state.fail) return { data: null, count: null, error: new Error('offline') };
          const rows = table === 'space_modules' ? state.modules : state.rows.filter((date) => date.space_id === filters.space_id);
          return { data: rows.slice(start, end + 1), count: rows.length, error: null };
        },
        async maybeSingle() { return { data: state.rows.find((date) => date.id === filters.id && date.space_id === filters.space_id) ?? null, error: null }; },
      };
    },
    async rpc(name: string, args: Record<string, unknown>) {
      state.calls.push([name, args]);
      if (state.result) return state.result;
      if (name === 'delete_important_date') { state.rows = []; return { data: null, error: null }; }
      const changed = { ...row, name: args.p_name, emoji: args.p_emoji, repeat_kind: args.p_repeat_kind, month: args.p_month, day: args.p_day, year: args.p_year,
        ...(name === 'create_important_date' ? { created_by: state.user, time_zone: args.p_time_zone, space_id: args.p_space_id } : {}) };
      state.rows = [changed as ImportantDate];
      return { data: changed, error: null };
    },
  };
  return { state, client, readSpaces: async () => state.spaces };
}
async function adapter(run: (m: Record<string, any>) => Promise<void>) {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try { await run(await vite.ssrLoadModule('/src/lib/important-dates-data.ts')); } finally { await vite.close(); }
}
test('validated session entry rereads complete canonical Dates without rediscovering Spaces/modules; wrong user fails closed', () => adapter(async (m) => {
  const { state, client } = fake();
  const entry = { memberSpaces: [space], eligibleSpaces: [space] };
  let discoveries = 0;
  const discover = async () => { discoveries++; return [space]; };
  const data = await m.loadImportantDates('me', client, discover, undefined, entry);
  assert.deepEqual(data.dates, [row]);
  assert.equal(discoveries, 0);
  assert.equal(state.calls.some((call: any) => call[1] === 'space_modules'), false);
  state.user = 'other';
  await assert.rejects(m.loadImportantDates('me', client, discover, undefined, entry), /登录状态/);
  state.user = 'me';
  state.modules = [];
  const revalidated = await m.loadImportantDates('me', client, discover);
  assert.equal(discoveries, 1);
  assert.deepEqual(revalidated.eligibleSpaces, []);
  assert.deepEqual(revalidated.dates, []);
}));
test('Important Date RPC payloads are frozen; Shared non-creator can update and hard delete', () => adapter(async (m) => {
  const { state, client, readSpaces } = fake();
  const created = await m.createImportantDate(client, 'me', space.id, row, 'Asia/Shanghai', readSpaces);
  assert.equal(created.created_by, 'me');
  state.rows = [row];
  await m.updateImportantDate(client, 'me', row, { ...row, name: '新名' }, readSpaces);
  await m.deleteImportantDate(client, 'me', state.rows[0], readSpaces);
  const rpc = state.calls.filter((call: any) => /^(create|update|delete)_important_date$/.test(call[0]));
  assert.deepEqual(rpc, [
    ['create_important_date', { p_space_id: space.id, p_name: '生日', p_emoji: null, p_repeat_kind: 'annual', p_month: 2, p_day: 29, p_year: null, p_time_zone: 'Asia/Shanghai' }],
    ['update_important_date', { p_important_date_id: row.id, p_name: '新名', p_emoji: null, p_repeat_kind: 'annual', p_month: 2, p_day: 29, p_year: null }],
    ['delete_important_date', { p_important_date_id: row.id }],
  ]);
}));
test('Important Dates adapter reads all pages in stable order and excludes disabled Spaces', () => adapter(async (m) => {
  const { state, client, readSpaces } = fake();
  state.rows = Array.from({ length: 1001 }, (_, i) => ({ ...row, id: `date-${i}` }));
  const result = await m.loadImportantDates('me', client, readSpaces);
  assert.equal(result.dates.length, 1001);
  assert.deepEqual(state.calls.filter((c: any) => c[0] === 'range' && c[1] === 'important_dates').map((c: any) => c.slice(2)), [[0, 499], [500, 999], [1000, 1499]]);
  state.modules[0].enabled = false;
  assert.deepEqual((await m.loadImportantDates('me', client, readSpaces)).dates, []);
  state.fail = true;
  await assert.rejects(m.loadImportantDates('me', client, readSpaces), /offline/);
}));
test('Important Dates RPC rejects wrong canonical content, object, Space, creator and immutable metadata', () => adapter(async (m) => {
  for (const bad of [{ id: 'wrong' }, { space_id: 'wrong' }, { name: 'wrong' }, { emoji: 'wrong' }, { day: 28 }, { year: 2028 }, { time_zone: 'UTC' }, { created_by: 'me' }, { created_at: '2026-10-01' }, { reminder_kind: 'all_day_same_day_08' }]) {
    const { state, client, readSpaces } = fake();
    state.result = { data: { ...row, ...bad }, error: null };
    await assert.rejects(m.updateImportantDate(client, 'me', row, row, readSpaces));
  }
  const { state, client, readSpaces } = fake();
  state.result = { data: row, error: null };
  await assert.rejects(m.createImportantDate(client, 'me', space.id, row, 'Asia/Shanghai', readSpaces));
  state.result = { data: [], error: null };
  await assert.rejects(m.updateImportantDate(client, 'me', row, row, readSpaces));
}));
test('Important Date mutation refuses stale/disabled/removed target and wrong user before RPC', () => adapter(async (m) => {
  for (const scenario of ['disabled', 'removed', 'user', 'deleted']) {
    const { state, client, readSpaces } = fake();
    if (scenario === 'disabled') state.modules[0].enabled = false;
    if (scenario === 'removed') state.spaces = [];
    if (scenario === 'user') state.user = 'other';
    if (scenario === 'deleted') state.rows = [];
    await assert.rejects(m.updateImportantDate(client, 'me', row, row, readSpaces));
    assert.equal(state.calls.some((call: any) => call[0] === 'update_important_date'), false);
  }
}));
test('Important Date mutation rejects auth switch after RPC and refuses false delete success', () => adapter(async (m) => {
  const { client, state, readSpaces } = fake();
  client.rpc = async () => { state.user = 'other'; return { data: row, error: null }; };
  await assert.rejects(m.updateImportantDate(client, 'me', row, row, readSpaces), /登录/);
  state.user = 'me';
  client.rpc = async () => ({ data: null, error: null });
  await assert.rejects(m.deleteImportantDate(client, 'me', row, readSpaces), /删除/);
}));

test('Important Date pages fail explicitly for null/unknown/drifting counts, duplicates and wrong Space', () => adapter(async (m) => {
  for (const scenario of ['null-data', 'null-count', 'duplicate', 'wrong-space', 'drift', 'empty-page', 'invalid-date']) {
    const { client, readSpaces } = fake();
    const originalFrom = client.from;
    client.from = (table: string) => {
      const query = originalFrom(table);
      if (table === 'important_dates') query.range = async (start: number, _end: number) => {
        if (scenario === 'null-data') return { data: null, count: 0, error: null } as any;
        if (scenario === 'null-count') return { data: [row], count: null, error: null } as any;
        if (scenario === 'duplicate') return { data: [row, row], count: 2, error: null };
        if (scenario === 'wrong-space') return { data: [{ ...row, space_id: 'foreign' }], count: 1, error: null };
        if (scenario === 'invalid-date') return { data: [{ ...row, month: 2, day: 30 }], count: 1, error: null };
        if (scenario === 'empty-page') return { data: [], count: 1, error: null };
        return { data: [{ ...row, id: `date-${start}` }], count: start ? 3 : 2, error: null };
      };
      return query;
    };
    await assert.rejects(m.loadImportantDates('me', client, readSpaces), undefined, scenario);
  }
}));

test('Important Date mutation validation blocks invalid timezone and propagates RPC rejection without retry', () => adapter(async (m) => {
  const { state, client, readSpaces } = fake();
  for (const zone of ['', 'invalid', '+08:00']) await assert.rejects(m.createImportantDate(client, 'me', space.id, row, zone, readSpaces), /时区/);
  assert.equal(state.calls.length, 0);
  state.result = { data: null, error: new Error('rpc denied') };
  await assert.rejects(m.updateImportantDate(client, 'me', row, row, readSpaces), /rpc denied/);
  assert.equal(state.calls.filter((call: any) => call[0] === 'update_important_date').length, 1);
}));
