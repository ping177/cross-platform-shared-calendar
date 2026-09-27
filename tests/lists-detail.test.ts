import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { ListItem, ListSection } from '../src/types.ts';

const listId = 'list-a';
const spaceId = 'space-a';
const sections = [
  { id: 's2', list_id: listId, name: '衣物', sort_order: 2 },
  { id: 's1', list_id: listId, name: '食物', sort_order: 1 },
] as ListSection[];
const items = [
  { id: 'i4', list_id: listId, space_id: spaceId, section_id: 's2', content: '外套', completed: false, sort_order: 2 },
  { id: 'i3', list_id: listId, space_id: spaceId, section_id: 's2', content: '袜子', completed: true, sort_order: 1 },
  { id: 'i2', list_id: listId, space_id: spaceId, section_id: null, content: '牛奶', completed: true, sort_order: 2 },
  { id: 'i1', list_id: listId, space_id: spaceId, section_id: null, content: '面包', completed: false, sort_order: 1 },
  { id: 'i5', list_id: listId, space_id: spaceId, section_id: 's1', content: '苹果', completed: false, sort_order: 1 },
] as ListItem[];

test('detail derives canonical regions, folds and Section progress without moving completed Items', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { deriveListDetail } = await vite.ssrLoadModule('/src/lib/lists-detail.ts');
    const detail = deriveListDetail(listId, spaceId, sections, items);
    assert.deepEqual(detail.ungrouped.active.map((row: ListItem) => row.id), ['i1']);
    assert.deepEqual(detail.ungrouped.completed.map((row: ListItem) => row.id), ['i2']);
    assert.deepEqual(detail.sections.map((entry: { section: ListSection }) => entry.section.id), ['s1', 's2']);
    assert.deepEqual(detail.sections[1].region.active.map((row: ListItem) => row.id), ['i4']);
    assert.deepEqual(detail.sections[1].region.completed.map((row: ListItem) => row.id), ['i3']);
    assert.deepEqual([detail.sections[1].region.completedCount, detail.sections[1].region.total], [1, 2]);
    assert.deepEqual(deriveListDetail(listId, spaceId, [], []).ungrouped.total, 0);
    assert.throws(() => deriveListDetail(listId, spaceId, [], items), /不一致/);
  } finally { await vite.close(); }
});

test('ordinary canonical reread preserves local drafts and folds but recovers only invalid Section draft', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { initialListDetailUiState, reconcileListDetailUiState } = await vite.ssrLoadModule('/src/lib/lists-detail.ts');
    const state = {
      ...initialListDetailUiState(),
      quickDrafts: { ungrouped: '豆腐', s1: '香蕉', s2: '睡衣' },
      foldOpen: { ungrouped: true, s2: true }, collapsed: { s1: true },
      sectionCreateDraft: '另一组', editing: { kind: 'item', id: 'i4', draft: '外套 × 2' },
    };
    assert.deepEqual(reconcileListDetailUiState(state, sections, items), state);
    const removed = reconcileListDetailUiState(state, [sections[1]], items.filter((item) => item.section_id !== 's2'));
    assert.deepEqual(removed.quickDrafts, { ungrouped: '豆腐', s1: '香蕉' });
    assert.deepEqual(removed.recovered, ['睡衣']);
    assert.deepEqual(removed.foldOpen, { ungrouped: true });
    assert.deepEqual(removed.collapsed, { s1: true });
    assert.equal(removed.editing, null);
    assert.equal(removed.sectionCreateDraft, '另一组');
  } finally { await vite.close(); }
});

test('quick-add clears only a confirmed successful submission and preserves failure or newer text', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { initialListDetailUiState, settleQuickAddDraft } = await vite.ssrLoadModule('/src/lib/lists-detail.ts');
    const state = { ...initialListDetailUiState(), quickDrafts: { ungrouped: '牛奶', s1: '苹果' } };
    assert.equal(settleQuickAddDraft(state, 'ungrouped', '牛奶', false), state);
    assert.equal(settleQuickAddDraft(state, 'ungrouped', '旧值', true), state);
    assert.deepEqual(settleQuickAddDraft(state, 'ungrouped', '牛奶', true).quickDrafts, { ungrouped: '', s1: '苹果' });
  } finally { await vite.close(); }
});

test('confirmed rows appear before background reread settles, then canonical data converges', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { applyConfirmedDetailChange, commitConfirmedDetailMutation, deriveListDetail } = await vite.ssrLoadModule('/src/lib/lists-detail.ts');
    const list = { id: listId, space_id: spaceId, name: '采购' };
    let detail = { list, sections: [...sections], items: [...items] };
    const newSection = { id: 's3', list_id: listId, name: '家居', sort_order: 3 };
    const newItem = { id: 'i6', list_id: listId, space_id: spaceId, section_id: 's3', content: '毛巾', completed: false, sort_order: 1 };
    let finishRead!: (value: typeof detail) => void;
    const readPromise = new Promise<typeof detail>((resolve) => { finishRead = resolve; });
    let rereadFinished = false;
    const reread = async () => { detail = await readPromise; rereadFinished = true; };
    const commit = (change: unknown) => { detail = applyConfirmedDetailChange(detail, change); };

    await commitConfirmedDetailMutation(async () => newSection, (row: ListSection) => commit({ kind: 'section', row }), reread);
    await commitConfirmedDetailMutation(async () => newItem, (row: ListItem) => commit({ kind: 'item', row }), reread);
    assert.equal(rereadFinished, false);
    assert.deepEqual(deriveListDetail(listId, spaceId, detail.sections, detail.items).sections[2].region.active.map((row: ListItem) => row.id), ['i6']);

    await commitConfirmedDetailMutation(async () => ({ ...newSection, name: '浴室' }), (row: ListSection) => commit({ kind: 'section', row }), reread);
    await commitConfirmedDetailMutation(async () => ({ ...newItem, content: '浴巾' }), (row: ListItem) => commit({ kind: 'item', row }), reread);
    await commitConfirmedDetailMutation(async () => ({ ...newItem, content: '浴巾', completed: true }), (row: ListItem) => commit({ kind: 'item', row }), reread);
    assert.equal(rereadFinished, false);
    assert.equal(detail.sections[2].name, '浴室');
    assert.equal(detail.items.find((row: ListItem) => row.id === 'i6')?.content, '浴巾');
    assert.equal(deriveListDetail(listId, spaceId, detail.sections, detail.items).sections[2].region.completedCount, 1);

    finishRead({ list, sections: [...sections, { ...newSection, name: '浴室' }], items: [...items, { ...newItem, content: '浴巾', completed: true }] });
    await readPromise;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(rereadFinished, true);
    assert.equal(detail.items.find((row: ListItem) => row.id === 'i6')?.completed, true);
  } finally { await vite.close(); }
});

test('failed mutation never commits a row or starts success reread; confirmed Item delete removes only the target', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { applyConfirmedDetailChange, commitConfirmedDetailMutation } = await vite.ssrLoadModule('/src/lib/lists-detail.ts');
    let detail = { list: { id: listId, space_id: spaceId, name: '采购' }, sections, items };
    let rereads = 0;
    await assert.rejects(commitConfirmedDetailMutation(async () => { throw new Error('offline'); }, () => { throw new Error('must not commit'); }, async () => { rereads++; }), /offline/);
    assert.equal(detail.items, items);
    assert.equal(rereads, 0);
    detail = applyConfirmedDetailChange(detail, { kind: 'item-delete', id: 'i1' });
    assert.deepEqual(detail.items.map((row: ListItem) => row.id), ['i4', 'i3', 'i2', 'i5']);
    assert.equal(detail.sections, sections);
  } finally { await vite.close(); }
});

test('confirmed Section deletes render before reread, preserve stable ungrouped order, and converge', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { applyConfirmedDetailChange, commitConfirmedDetailMutation, deriveListDetail, initialListDetailUiState, reconcileListDetailUiState } = await vite.ssrLoadModule('/src/lib/lists-detail.ts');
    const list = { id: listId, space_id: spaceId, name: '采购' };
    const original = { list, sections: [...sections], items: [...items] };
    let detail = original;
    let ui = { ...initialListDetailUiState(), quickDrafts: { ungrouped: '保留', s1: '删除目标草稿', s2: '其他草稿' }, foldOpen: { ungrouped: true, s1: true, s2: true }, collapsed: { s1: true, s2: true }, editing: { kind: 'item', id: 'i3', draft: '袜子编辑中' } };
    let finishRead!: (value: typeof original) => void;
    const read = new Promise<typeof original>((resolve) => { finishRead = resolve; });
    let readFinished = false;
    const reread = async () => { detail = await read; readFinished = true; };

    await commitConfirmedDetailMutation(async () => undefined, () => {
      detail = applyConfirmedDetailChange(detail, { kind: 'section-delete', id: 's2', preserveItems: true });
      ui = reconcileListDetailUiState(ui, detail.sections, detail.items);
    }, reread);
    assert.equal(readFinished, false);
    assert.deepEqual(detail.sections.map((row: ListSection) => row.id), ['s1']);
    assert.deepEqual(detail.projectedUngroupedOrder, ['i1', 'i2', 'i3', 'i4']);
    assert.deepEqual(deriveListDetail(listId, spaceId, detail.sections, detail.items, detail.projectedUngroupedOrder).ungrouped.active.map((row: ListItem) => row.id), ['i1', 'i4']);
    assert.deepEqual(deriveListDetail(listId, spaceId, detail.sections, detail.items, detail.projectedUngroupedOrder).ungrouped.completed.map((row: ListItem) => row.id), ['i2', 'i3']);
    assert.equal(detail.items.find((row: ListItem) => row.id === 'i3')?.content, '袜子');
    assert.equal(detail.items.find((row: ListItem) => row.id === 'i3')?.sort_order, 1);
    assert.equal(ui.quickDrafts.ungrouped, '保留');
    assert.equal(ui.quickDrafts.s1, '删除目标草稿');
    assert.equal(ui.foldOpen.s1, true);
    assert.equal(ui.collapsed.s1, true);
    assert.equal(ui.editing?.draft, '袜子编辑中');
    assert.deepEqual(ui.recovered, ['其他草稿']);

    const canonical = { list, sections: [sections[1]], items: items.filter((row) => row.section_id !== 's2').concat([
      { ...items[1], section_id: null, sort_order: 3 }, { ...items[0], section_id: null, sort_order: 4 },
      { id: 'i6', list_id: listId, space_id: spaceId, section_id: null, content: '并发新增', completed: false, sort_order: 5 },
    ]) };
    finishRead(canonical);
    await read;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(readFinished, true);
    assert.deepEqual(deriveListDetail(listId, spaceId, detail.sections, detail.items).ungrouped.active.map((row: ListItem) => row.id), ['i1', 'i4', 'i6']);
    assert.equal(detail.projectedUngroupedOrder, undefined);

    ui = { ...initialListDetailUiState(), quickDrafts: { ungrouped: '保留', s1: '删除目标草稿', s2: '清除' }, foldOpen: { ungrouped: true, s1: true, s2: true }, collapsed: { s1: true, s2: true }, editing: { kind: 'item', id: 'i3', draft: '袜子编辑中' } };
    ui = { ...ui, quickDrafts: Object.fromEntries(Object.entries(ui.quickDrafts).filter(([key]) => key !== 's2')) };
    detail = applyConfirmedDetailChange(original, { kind: 'section-delete', id: 's2', preserveItems: false });
    ui = reconcileListDetailUiState(ui, detail.sections, detail.items);
    assert.deepEqual(detail.sections.map((row: ListSection) => row.id), ['s1']);
    assert.deepEqual(detail.items.map((row: ListItem) => row.id), ['i2', 'i1', 'i5']);
    assert.equal(ui.quickDrafts.ungrouped, '保留');
    assert.equal(ui.quickDrafts.s1, '删除目标草稿');
    assert.equal(ui.quickDrafts.s2, undefined);
    assert.equal(ui.foldOpen.s1, true);
    assert.equal(ui.collapsed.s1, true);
    assert.equal(ui.editing, null);
    assert.deepEqual(ui.recovered, []);
  } finally { await vite.close(); }
});

test('failed Section delete leaves local detail and UI unchanged', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { commitConfirmedDetailMutation, initialListDetailUiState } = await vite.ssrLoadModule('/src/lib/lists-detail.ts');
    const detail = { list: { id: listId, space_id: spaceId, name: '采购' }, sections, items };
    const ui = { ...initialListDetailUiState(), quickDrafts: { s2: '继续编辑' } };
    let committed = false;
    let rereads = 0;
    await assert.rejects(commitConfirmedDetailMutation(async () => { throw new Error('RPC failed'); }, () => { committed = true; }, async () => { rereads++; }), /RPC failed/);
    assert.equal(committed, false);
    assert.equal(rereads, 0);
    assert.equal(detail.sections, sections);
    assert.equal(detail.items, items);
    assert.equal(ui.quickDrafts.s2, '继续编辑');
  } finally { await vite.close(); }
});

test('an in-flight pre-delete read cannot overwrite the confirmed projection or later canonical read', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { applyConfirmedDetailChange } = await vite.ssrLoadModule('/src/lib/lists-detail.ts');
    const { createRequestGuard } = await vite.ssrLoadModule('/src/lib/request-guard.ts');
    const guard = createRequestGuard();
    const original = { list: { id: listId, space_id: spaceId, name: '采购' }, sections: [...sections], items: [...items] };
    let detail = original;
    let finishOld!: (value: typeof original) => void;
    const oldRead = new Promise<typeof original>((resolve) => { finishOld = resolve; });
    const oldRequest = guard.begin();
    const publishOld = oldRead.then((result) => { if (guard.isCurrent(oldRequest)) detail = result; });

    guard.invalidate();
    detail = applyConfirmedDetailChange(detail, { kind: 'section-delete', id: 's2', preserveItems: true });
    assert.deepEqual(detail.sections.map((row: ListSection) => row.id), ['s1']);
    finishOld(original);
    await publishOld;
    assert.deepEqual(detail.sections.map((row: ListSection) => row.id), ['s1']);

    const currentRequest = guard.begin();
    const canonical = { ...original, sections: [sections[1]], items: items.map((row) => row.section_id === 's2' ? { ...row, section_id: null, sort_order: row.sort_order + 2 } : row) };
    if (guard.isCurrent(currentRequest)) detail = canonical;
    assert.equal(detail.projectedUngroupedOrder, undefined);
    assert.deepEqual(detail.sections.map((row: ListSection) => row.id), ['s1']);
  } finally { await vite.close(); }
});
