import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { ListItem } from '../src/types.ts';

const listId = 'list-a';
const spaceId = 'space-a';
const row = (id: string, section_id: string | null, completed: boolean, sort_order: number): ListItem =>
  ({ id, list_id: listId, space_id: spaceId, section_id, completed, sort_order, content: id });

test('all four Item groups submit only their complete ordered IDs', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { planListItemReorder } = await vite.ssrLoadModule('/src/lib/lists-detail.ts');
    for (const [sectionId, completed] of [[null, false], [null, true], ['section-a', false], ['section-a', true]] as const) {
      const group = [row('A', sectionId, completed, 1), row('B', sectionId, completed, 3), row('C', sectionId, completed, 5)];
      assert.deepEqual(planListItemReorder(group, sectionId, completed, 2, 0, 'C'),
        { sectionId, completed, orderedIds: ['C', 'A', 'B'] });
      assert.equal(planListItemReorder(group, sectionId, completed, 0, 0, 'A'), null);
      assert.equal(planListItemReorder(group, sectionId, completed, 0, 2, 'missing'), null);
      assert.equal(planListItemReorder(group, 'another-section', completed, 2, 0, 'C'), null);
      assert.equal(planListItemReorder(group, sectionId, !completed, 2, 0, 'C'), null);
      assert.equal(planListItemReorder([...group.slice(0, 2), { ...group[2], list_id: 'other-list' }], sectionId, completed, 2, 0, 'C'), null);
      assert.equal(planListItemReorder([...group.slice(0, 2), { ...group[2], space_id: 'other-space' }], sectionId, completed, 2, 0, 'C'), null);
    }
  } finally { await vite.close(); }
});

test('confirmed reorder projects display only, preserves hidden slots, then canonical reread wins', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { applyConfirmedDetailChange, commitConfirmedDetailMutation, deriveListDetail } = await vite.ssrLoadModule('/src/lib/lists-detail.ts');
    const items = [row('A', null, false, 1), row('X', null, true, 2), row('B', null, false, 3), row('Y', null, true, 4), row('C', null, false, 5)];
    const original = { list: { id: listId, space_id: spaceId, name: '采购' }, sections: [], items };
    let detail = original;
    let releaseRead!: (value: typeof original) => void;
    const pendingRead = new Promise<typeof original>((resolve) => { releaseRead = resolve; });
    const reread = async () => { detail = await pendingRead; };
    await commitConfirmedDetailMutation(async () => undefined, () => {
      detail = applyConfirmedDetailChange(detail, { kind: 'item-reorder', sectionId: null, completed: false, orderedIds: ['C', 'A', 'B'] });
    }, reread);
    assert.deepEqual(deriveListDetail(listId, spaceId, detail.sections, detail.items, undefined, detail.projectedItemOrders)
      .ungrouped.active.map((item: ListItem) => item.id), ['C', 'A', 'B']);
    assert.deepEqual(detail.items.map((item: ListItem) => item.sort_order), [1, 2, 3, 4, 5]);
    assert.deepEqual(deriveListDetail(listId, spaceId, detail.sections, detail.items, undefined, detail.projectedItemOrders)
      .ungrouped.completed.map((item: ListItem) => item.id), ['X', 'Y']);
    releaseRead({ ...original, items: [row('C', null, false, 1), row('X', null, true, 2), row('A', null, false, 3), row('Y', null, true, 4), row('B', null, false, 5)] });
    await pendingRead;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(detail.projectedItemOrders, undefined);
    assert.deepEqual(deriveListDetail(listId, spaceId, detail.sections, detail.items).ungrouped.active.map((item: ListItem) => item.id), ['C', 'A', 'B']);
    const reopened = detail.items.map((item: ListItem) => item.id === 'X' ? { ...item, completed: false } : item);
    assert.deepEqual(deriveListDetail(listId, spaceId, [], reopened).ungrouped.active.map((item: ListItem) => item.id), ['C', 'X', 'A', 'B']);
  } finally { await vite.close(); }
});

test('failed reorder never projects success and drag gate defers ready renders', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { applyConfirmedDetailChange, commitConfirmedItemReorder, createDetailDragGate } = await vite.ssrLoadModule('/src/lib/lists-detail.ts');
    let committed = false;
    let rereads = 0;
    let actions = 0;
    await assert.rejects(commitConfirmedItemReorder(async () => { actions++; throw new Error('Stale List Item order; reload'); },
      () => { committed = true; }, () => { rereads++; }), /Stale List Item order/);
    assert.equal(committed, false);
    assert.equal(actions, 1);
    assert.equal(rereads, 1);
    const items = [row('A', null, false, 1), row('B', null, false, 2)];
    const detail = { list: { id: listId, space_id: spaceId, name: '采购' }, sections: [], items };
    assert.equal(applyConfirmedDetailChange(detail, { kind: 'item-reorder', sectionId: null, completed: false, orderedIds: ['A', 'missing'] }), detail);
    await commitConfirmedItemReorder(async () => { actions++; }, () => { committed = true; }, () => { rereads++; });
    assert.equal(committed, true);
    assert.equal(actions, 2);
    assert.equal(rereads, 2);
    const gate = createDetailDragGate();
    assert.equal(gate.defer(), false);
    gate.start();
    assert.equal(gate.finish(), true);
    gate.start();
    assert.equal(gate.defer(), true);
    assert.equal(gate.finish(), true);
    assert.equal(gate.defer(), false);
    assert.equal(gate.finish(), false);
  } finally { await vite.close(); }
});
