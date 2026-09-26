import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { CurrentSpace, List } from '../src/types.ts';

const space = { id: 'space-a', kind: 'personal', created_by: 'me', membershipRole: 'owner' } as CurrentSpace;
const row = { id: 'list-a', space_id: space.id, name: '采购', created_by: 'me', created_at: '2026-09-27', updated_at: '2026-09-27' } as List;

test('List mutations send only granted fields and use the delete RPC', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { createList, renameList, deleteList } = await vite.ssrLoadModule('/src/lib/lists-data.ts');
    const actions: unknown[] = [];
    const query = {
      insert(payload: unknown) { actions.push(['insert', payload]); return this; },
      update(payload: unknown) { actions.push(['update', payload]); return this; },
      eq(key: string, value: unknown) { actions.push(['eq', key, value]); return this; },
      select() { return this; },
      async single() { return { data: row, error: null }; },
      async maybeSingle() { return { data: { ...row, name: '新名' }, error: null }; },
    };
    const client = {
      from(table: string) { actions.push(['from', table]); return query; },
      async rpc(name: string, args: unknown) { actions.push(['rpc', name, args]); return { error: null }; },
    };
    await createList(client, space.id, '  采购  ');
    await renameList(client, row, ' 新名 ');
    await deleteList(client, row.id);
    assert.deepEqual(actions.filter((action) => Array.isArray(action) && ['insert', 'update', 'rpc'].includes(action[0])), [
      ['insert', { space_id: space.id, name: '采购' }],
      ['update', { name: '新名' }],
      ['rpc', 'delete_list', { p_list_id: row.id }],
    ]);
  } finally { await vite.close(); }
});

test('Lists eligibility read error is distinct from confirmed zero eligible Spaces', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { readListEligibility } = await vite.ssrLoadModule('/src/lib/lists.ts');
    assert.deepEqual(await readListEligibility([space], async () => ({ data: [], count: 0, error: null })), []);
    await assert.rejects(readListEligibility([space], async () => ({ data: null, count: null, error: new Error('offline') })), /offline/);
  } finally { await vite.close(); }
});

test('canonical overview reread resolves eligibility before Lists and Items', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { loadListsOverview } = await vite.ssrLoadModule('/src/lib/lists-data.ts');
    const visited: string[] = [];
    const rows = {
      space_modules: [{ space_id: space.id, enabled: true }],
      lists: [row],
      list_items: [],
    };
    const client = {
      auth: { async getUser() { visited.push('auth'); return { data: { user: { id: 'me' } }, error: null }; } },
      from(table: keyof typeof rows) {
        return {
          select() { return this; }, eq() { return this; }, order() { return this; },
          async range(start: number, end: number) {
            visited.push(table);
            return { data: rows[table].slice(start, end + 1), count: rows[table].length, error: null };
          },
        };
      },
    };
    const result = await loadListsOverview('me', client, async () => { visited.push('spaces'); return [space]; });
    assert.deepEqual(result.grouped.active.map((entry: { list: List }) => entry.list.id), [row.id]);
    assert.deepEqual(visited, ['auth', 'spaces', 'space_modules', 'auth', 'lists', 'list_items', 'auth']);
  } finally { await vite.close(); }
});
