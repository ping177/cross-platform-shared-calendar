import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { CurrentSpace, List, ListItemOverview } from '../src/types.ts';

const personal = { id: 'personal', name: '我的空间', kind: 'personal', created_by: 'me', membershipRole: 'owner' } as CurrentSpace;
const shared = { id: 'shared', name: '共同空间', kind: 'shared', created_by: 'other', membershipRole: 'member' } as CurrentSpace;
const list = (id: string, spaceId: string, createdAt = '2026-09-27T00:00:00Z') => ({
  id, space_id: spaceId, name: id, created_by: 'me', created_at: createdAt, updated_at: createdAt,
}) as List;
const item = (id: string, listId: string, spaceId: string, completed: boolean) => ({
  id, list_id: listId, space_id: spaceId, completed,
}) as ListItemOverview;

test('Lists eligibility, independent filter, and Personal creation target', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { eligibleListSpaces, normalizeListFilter, defaultListCreateTarget, canSaveListInSpace } = await vite.ssrLoadModule('/src/lib/lists.ts');
    const eligible = eligibleListSpaces([personal, shared], [{ space_id: shared.id, enabled: true }]);
    assert.deepEqual(eligible.map((space: CurrentSpace) => space.id), [shared.id]);
    assert.equal(normalizeListFilter({ spaceId: personal.id }, eligible), 'all');
    assert.equal(defaultListCreateTarget([personal, shared], 'me'), personal.id);
    assert.equal(canSaveListInSpace(personal.id, eligible), false);
    assert.equal(canSaveListInSpace(shared.id, eligible), true);
    assert.equal(defaultListCreateTarget([shared], 'me'), null);
  } finally { await vite.close(); }
});

test('Lists progress and stable grouping derive only from real Items', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { groupOverviewLists } = await vite.ssrLoadModule('/src/lib/lists.ts');
    const lists = [list('a', personal.id), list('c', shared.id), list('b', personal.id, '2026-09-26T00:00:00Z')];
    const grouped = groupOverviewLists(lists, [item('i1', 'a', personal.id, true), item('i2', 'c', shared.id, true), item('i3', 'c', shared.id, false)]);
    assert.deepEqual(grouped.active.map((row: { list: List }) => row.list.id), ['c', 'b']);
    assert.deepEqual(grouped.completed.map((row: { list: List }) => row.list.id), ['a']);
    assert.deepEqual(grouped.active.map((row: { completedCount: number; totalItems: number }) => [row.completedCount, row.totalItems]), [[1, 2], [0, 0]]);
    assert.throws(() => groupOverviewLists(lists, [item('orphan', 'missing', shared.id, false)]));
  } finally { await vite.close(); }
});

test('Lists overview reads every page and rejects incomplete Item results', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { readListOverview } = await vite.ssrLoadModule('/src/lib/lists.ts');
    const allLists = Array.from({ length: 501 }, (_, index) => list(`list-${String(index).padStart(3, '0')}`, personal.id));
    const allItems = [item('one', allLists[0].id, personal.id, true)];
    const result = await readListOverview([personal], {
      listPage: async (_spaceId: string, start: number, end: number) => ({ data: allLists.slice(start, end + 1), count: allLists.length, error: null }),
      itemPage: async (_spaceId: string, start: number, end: number) => ({ data: allItems.slice(start, end + 1), count: allItems.length, error: null }),
    });
    assert.equal(result.completed.length, 1);
    assert.equal(result.active.length, 500);
    await assert.rejects(readListOverview([personal], {
      listPage: async (_spaceId: string, start: number, end: number) => ({ data: allLists.slice(start, end + 1), count: allLists.length, error: null }),
      itemPage: async () => ({ data: [], count: 1, error: null }),
    }), /读取不完整/);
    await assert.rejects(readListOverview([personal], {
      listPage: async () => ({ data: null, count: 0, error: null }),
      itemPage: async () => ({ data: [], count: 0, error: null }),
    }), /读取不完整/);
  } finally { await vite.close(); }
});

test('overview Realtime signals coalesce bursts and clean old Space channels', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { createListsRefreshSignal, subscribeListsRealtimeScope } = await vite.ssrLoadModule('/src/lib/lists.ts');
    let reads = 0;
    const signal = createListsRefreshSignal(() => { reads += 1; }, 5);
    signal.signal(); signal.signal(); signal.signal();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(reads, 1);
    signal.signal(); signal.stop();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(reads, 1);
    const removed: string[] = [];
    const cleanup = subscribeListsRealtimeScope(['a', 'b'], (id: string) => id, (id: string) => removed.push(id));
    cleanup();
    assert.deepEqual(removed, ['a', 'b']);
  } finally { await vite.close(); }
});
