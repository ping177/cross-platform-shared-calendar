import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const item = { id: 'a', list_id: 'l', space_id: 's', section_id: null, content: '牛奶', completed: false, sort_order: 1 };
const noop = () => {};
async function modules(run: (m: any) => Promise<void>) {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try { await run({ ...await vite.ssrLoadModule('/src/components/ListDetailPage.tsx'), ...await vite.ssrLoadModule('/src/lib/lists-detail.ts') }); }
  finally { await vite.close(); }
}
test('normal item name is an edit button, without permanent delete or item menu', () => modules(async ({ ItemRow }) => {
  const props = { item, editing: null, busy: false, disabled: false, drag: { innerRef: noop, draggableProps: {}, dragHandleProps: {} }, onToggle: noop, onEdit: noop, onEditChange: noop, onSave: noop, onCancel: noop, onDelete: noop };
  const html = renderToStaticMarkup(React.createElement(ItemRow, props));
  assert.match(html, /<button[^>]*aria-label="编辑 牛奶"[^>]*>牛奶<\/button>/);
  assert.doesNotMatch(html, />编辑<|>删除<|更多操作|role="dialog"/);
}));
test('editing exposes only in-place save cancel delete and freezes its checkbox', () => modules(async ({ ItemRow }) => {
  const html = renderToStaticMarkup(React.createElement(ItemRow, { item, editing: { kind: 'item', id: 'a', draft: '新内容', original: '牛奶' }, busy: false, disabled: false, drag: { innerRef: noop, draggableProps: {}, dragHandleProps: {} }, onToggle: noop, onEdit: noop, onEditChange: noop, onSave: noop, onCancel: noop, onDelete: noop }));
  assert.match(html, /type="checkbox"[^>]*disabled=""/);
  for (const label of ['保存', '取消', '删除']) assert.ok(html.includes('>' + label + '<'));
  assert.doesNotMatch(html, /role="dialog"/);
}));
test('remote removal recovers unsaved edit text, without recreating a business row', () => modules(async ({ initialListDetailUiState, reconcileListDetailUiState }) => {
  const state = { ...initialListDetailUiState(), editing: { kind: 'item', id: 'a', draft: '需要复制的输入', original: '牛奶' } };
  const next = reconcileListDetailUiState(state, [], []);
  assert.equal(next.editing, null); assert.deepEqual(next.recovered, ['需要复制的输入']);
}));
test('ordinary refresh preserves draft; remotely completed edited item stays visible', () => modules(async ({ initialListDetailUiState, reconcileListDetailUiState }) => {
  const state = { ...initialListDetailUiState(), editing: { kind: 'item', id: 'a', draft: '保留草稿', original: '牛奶' } };
  const next = reconcileListDetailUiState(state, [], [{ ...item, completed: true }]);
  assert.deepEqual(next.editing, state.editing); assert.equal(next.foldOpen.ungrouped, true);
}));

const nodes = (node: any): any[] => React.isValidElement(node) ? [node, ...React.Children.toArray((node.props as any).children).flatMap(nodes)] : [];
const text = (node: any): string => React.isValidElement(node) ? React.Children.toArray((node.props as any).children).map(text).join('') : typeof node === 'string' ? node : '';
async function runtime(component: string, run: (env: any) => Promise<void>) {
  let cursor = 0; const slots: any[] = []; const effects: any[] = []; const cleanups = new Map(); const events = new Map(); const calls: any[] = [];
  const oldWindow = globalThis.window, oldDocument = globalThis.document, oldRaf = globalThis.requestAnimationFrame;
  const m: any = { confirm: true, state: { status: 'ready', degraded: false, data: { list: { id: 'l', space_id: 's', name: '采购' }, space: { id: 's', name: '共同空间', kind: 'shared', membershipRole: 'member' }, sections: [{ id: 'g', list_id: 'l', name: '行李', sort_order: 1 }], items: [item, { ...item, id: 'b', content: '外套', section_id: 'g' }] } },
    useState(initial: any) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], (v: any) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
    useRef(initial: any) { return slots[cursor++] ??= { current: initial }; },
    useEffect(fn: any, deps: any[]) { const i = cursor++; if (!slots[i] || deps.some((v, n) => v !== slots[i][n])) { slots[i] = deps; effects.push({ i, fn }); } },
    async refresh() { calls.push(['refresh']); }, reconnect() {}, startDrag() {}, finishDrag() {},
    applyConfirmed(change: any) { calls.push(['confirmed', change]); if (change.kind === 'item') m.state.data = { ...m.state.data, items: [...m.state.data.items.filter((i: any) => i.id !== change.row.id), change.row] }; },
    async edit(_client: any, target: any, row: any, value: string) { calls.push(['edit', target, row.id, value]); if (m.barrier) await m.barrier; if (m.error) throw m.error; return { ...row, content: value }; },
    async add(_client: any, target: any, section: any, content: string) { calls.push(['add', section, content]); if (m.barrier) await m.barrier; if (m.error) throw m.error; return { ...item, id: 'new' + calls.length, section_id: section, content }; },
    async remove(_client: any, listId: string, id: string) { calls.push(['delete', listId, id]); },
    async renameGroup(_client: any, row: any, name: string) { calls.push(['rename-group', row.id, name]); return { ...row, name }; },
  };
  (globalThis as any).__listInteraction = m;
  (globalThis as any).window = { confirm(message: string) { calls.push(['confirm', message]); return m.confirm; } };
  (globalThis as any).document = { addEventListener(name: string, fn: any) { events.set(name, fn); }, removeEventListener(name: string) { events.delete(name); }, getElementById(id: string) { return { focus() { calls.push(['focus', id]); } }; } };
  (globalThis as any).requestAnimationFrame = (fn: any) => { fn(); return 1; };
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{
    name: 'list-interaction-handlers', enforce: 'pre', resolveId(id, importer) {
      if (id === 'react' && importer?.includes('/components/')) return '\0interaction-hooks';
      if (id === '@hello-pangea/dnd') return '\0interaction-dnd';
      if (/\/useListDetail(?:\.ts)?$/.test(id)) return '\0interaction-detail';
      if (/\/lists-detail-data(?:\.ts)?$/.test(id)) return '\0interaction-writes';
      if (/\/supabase(?:\.ts)?$/.test(id)) return '\0interaction-client';
    }, load(id) { const pre = 'const m=globalThis.__listInteraction;';
      if (id === '\0interaction-dnd') return 'export const DragDropContext=()=>null,Draggable=()=>null,Droppable=()=>null;';
      if (id === '\0interaction-hooks') return pre + 'export const {useState,useRef,useEffect}=m;';
      if (id === '\0interaction-detail') return pre + 'export const useListDetail=()=>m;';
      if (id === '\0interaction-client') return 'export const supabase={};';
      if (id === '\0interaction-writes') return pre + 'export const editListItem=m.edit,createListItem=m.add,deleteListItem=m.remove,renameListSection=m.renameGroup;export const createListSection=async()=>{},deleteListSection=async()=>{},reorderListItems=async()=>{},setListItemCompleted=async()=>{};';
    },
  }] } as any);
  try {
    const exports = await vite.ssrLoadModule('/src/components/ListDetailPage.tsx');
    const props: any = component === 'ListDetailPage' ? { userId: 'me', target: { listId: 'l', spaceId: 's' }, onBack: () => calls.push(['back']), onUnavailable: noop, onLeaveGuardChange: (guard: any) => { m.leave = guard; } }
      : component === 'QuickAdd' ? { label: '添加清单项目', value: '中文输入', busy: false, disabled: false, onInput: noop, onChange: noop, onSubmit: () => calls.push(['quick-submit']) }
      : component === 'ItemRow' ? { item, editing: { kind: 'item', id: 'a', draft: '牛奶', original: '牛奶' }, busy: false, disabled: false, drag: { innerRef: noop, draggableProps: {}, dragHandleProps: {} }, onToggle: noop, onEdit: noop, onEditChange: noop, onSave: () => calls.push(['save']), onCancel: () => calls.push(['cancel']), onDelete: noop }
      : { label: '清单', disabled: false, onRename: () => calls.push(['rename']), onDelete: () => calls.push(['remove']) };
    const render = () => { cursor = 0; return exports[component](props); };
    const pump = async () => { for (let j = 0; j < 3; j++) { render(); for (const { i, fn } of effects.splice(0)) { cleanups.get(i)?.(); const done = fn(); if (done) cleanups.set(i, done); } await new Promise(yes => setImmediate(yes)); } return render(); };
    const region = (key = 'ungrouped') => nodes(render()).find(n => n.type === exports.ListDetailRegion && n.props.regionKey === key).props;
    const button = (name: string) => nodes(render()).find(n => n.type === 'button' && text(n) === name);
    await pump(); await run({ m, props, calls, events, slots, render, pump, region, button, exports, unmount: () => { for (const done of cleanups.values()) done(); } });
  } finally { for (const done of cleanups.values()) done(); await vite.close(); delete (globalThis as any).__listInteraction; (globalThis as any).window = oldWindow; (globalThis as any).document = oldDocument; (globalThis as any).requestAnimationFrame = oldRaf; }
}

test('name edit, clean cancel and dirty cancel or target switch use explicit confirmation', () => runtime('ListDetailPage', async ({ m, calls, region, pump }) => {
  region().onEditItem(item); await pump(); assert.equal(region().ui.editing.original, '牛奶');
  region().onCancelEdit(); await pump(); assert.equal(region().ui.editing, null); assert.equal(calls.filter((c: any) => c[0] === 'confirm').length, 0);
  region().onEditItem(item); region().onEditChange('未保存'); await pump(); m.confirm = false;
  region().onCancelEdit(); await pump(); assert.equal(region().ui.editing.draft, '未保存');
  region('g').onEditItem(m.state.data.items[1]); await pump(); assert.equal(region().ui.editing.id, 'a');
  m.confirm = true; region('g').onEditItem(m.state.data.items[1]); await pump(); assert.equal(region().ui.editing.id, 'b');
}));

test('dirty completed fold, group collapse, return and parent navigation guard cannot silently discard', () => runtime('ListDetailPage', async ({ m, region, pump, button, calls }) => {
  m.state.data = { ...m.state.data, items: m.state.data.items.map((i: any) => i.id === 'a' ? { ...i, completed: true } : i) }; await pump();
  region().onEditItem(m.state.data.items[0]); region().onEditChange('草稿'); await pump(); m.confirm = false;
  region().onToggleFold(); await pump(); assert.equal(region().ui.foldOpen.ungrouped, true);
  button('清单总览').props.onClick(); assert.equal(m.leave(), false); assert.equal(calls.filter((c: any) => c[0] === 'back').length, 0);
  m.confirm = true; region().onCancelEdit(); region('g').onEditItem(m.state.data.items[1]); region('g').onEditChange('分组内草稿'); await pump(); m.confirm = false;
  const toggle = nodes((await pump())).find(n => n.type === 'button' && text(n).startsWith('行李'));
  toggle.props.onClick(); await pump(); assert.equal(Boolean(region().ui.collapsed.g), false);
  m.confirm = true; button('清单总览').props.onClick(); assert.equal(calls.filter((c: any) => c[0] === 'back').length, 1);
}));

test('edit save failure keeps draft, retry works, duplicate and busy target changes are blocked', () => runtime('ListDetailPage', async ({ m, calls, region, pump }) => {
  region().onEditItem(item); region().onEditChange('保留'); await pump(); let release!: () => void;
  m.barrier = new Promise<void>(yes => { release = yes; }); m.error = new Error('保存失败');
  region().onSaveEdit(); region().onSaveEdit(); await pump(); assert.equal(calls.filter((c: any) => c[0] === 'edit').length, 1);
  region('g').onEditItem(m.state.data.items[1]); assert.equal(m.leave(), false); await pump(); assert.equal(region().ui.editing.id, 'a');
  release(); await pump(); assert.equal(region().ui.editing.draft, '保留');
  m.barrier = null; m.error = null; region().onSaveEdit(); await pump(); assert.equal(region().ui.editing, null);
  assert.equal(calls.filter((c: any) => c[0] === 'edit').length, 2);
}));

test('remote deletion recovers input and a late save cannot apply false success; permission loss blocks writes', () => runtime('ListDetailPage', async ({ m, calls, region, pump }) => {
  region().onEditItem(item); region().onEditChange('远端删除时保留'); await pump(); let release!: () => void;
  m.barrier = new Promise<void>(yes => { release = yes; }); region().onSaveEdit();
  m.state.data = { ...m.state.data, items: m.state.data.items.filter((i: any) => i.id !== 'a') }; await pump();
  assert.deepEqual(region().ui.recovered, ['远端删除时保留']); release(); await pump(); assert.equal(calls.filter((c: any) => c[0] === 'confirmed').length, 0);
  m.state.degraded = true; await pump(); region('g').onEditItem(m.state.data.items[0]); region('g').onSaveEdit(); await pump(); assert.equal(calls.filter((c: any) => c[0] === 'edit').length, 1);
}));

test('quick add remains independent, refocuses after confirmed success and rejects duplicate submits', () => runtime('ListDetailPage', async ({ m, calls, exports, render, pump }) => {
  const quick = () => nodes(render()).find(n => typeof n.type === 'function' && n.type.name === 'QuickAdd' && n.props.label === '添加清单项目').props;
  quick().onInput({ focus() { calls.push(['quick-focus']); } }); quick().onChange('连续第一项'); await pump(); let release!: () => void;
  m.barrier = new Promise<void>(yes => { release = yes; }); quick().onSubmit(); quick().onSubmit(); assert.equal(calls.filter((c: any) => c[0] === 'add').length, 1);
  release(); await pump(); assert.equal(quick().value, ''); assert.ok(calls.some((c: any) => c[0] === 'quick-focus'));
  m.barrier = null; quick().onChange('连续第二项'); await pump(); quick().onSubmit(); await pump(); assert.equal(calls.filter((c: any) => c[0] === 'add').length, 2);
}));

test('composition Enter and Escape never save or cancel; plain Escape cancels and form Enter saves', () => runtime('ItemRow', async ({ render, calls }) => {
  const input = () => nodes(render()).find(n => n.type === 'input' && n.props['aria-label'] === '编辑项目内容');
  const form = () => nodes(render()).find(n => n.type === 'form');
  input().props.onCompositionStart(); form().props.onSubmit({ preventDefault() {} });
  input().props.onKeyDown({ key: 'Escape', nativeEvent: { isComposing: true }, preventDefault() {} }); assert.equal(calls.length, 0);
  input().props.onCompositionEnd(); form().props.onSubmit({ preventDefault() {} }); input().props.onKeyDown({ key: 'Escape', nativeEvent: { isComposing: false }, preventDefault() {} });
  assert.deepEqual(calls, [['save'], ['cancel']]);
}));

test('management popover supports actions, outside and Escape close, focus restore and permission invalidation', () => runtime('ListActionsMenu', async ({ props, slots, events, render, pump, calls }) => {
  slots[2].current = { focus() { calls.push(['trigger-focus']); } }; slots[3].current = { focus() { calls.push(['menu-focus']); } }; slots[1].current = { contains(target: any) { return target === 'inside'; } };
  const open = () => nodes(render()).find(n => n.type === 'button' && n.props['aria-expanded'] !== undefined).props.onClick();
  open(); await pump(); assert.ok(events.has('pointerdown')); assert.ok(calls.some((c: any) => c[0] === 'menu-focus'));
  nodes(render()).find(n => n.type === 'button' && text(n) === '重命名清单').props.onClick(); await pump(); assert.ok(calls.some((c: any) => c[0] === 'rename'));
  open(); await pump(); events.get('pointerdown')({ target: 'outside' }); await pump(); assert.equal(nodes(render()).some(n => n.props.role === 'group'), false);
  open(); await pump(); nodes(render())[0].props.onKeyDown({ key: 'Escape', preventDefault() {}, stopPropagation() {} }); await pump(); assert.ok(calls.some((c: any) => c[0] === 'trigger-focus'));
  open(); await pump(); props.disabled = true; await pump(); assert.equal(nodes(render()).some(n => n.props.role === 'group'), false);
}));


test('quick-add IME never mis-submits but ordinary Enter submission remains available', () => runtime('QuickAdd', async ({ render, calls }) => {
  const input = nodes(render()).find(n => n.type === 'input');
  input.props.onCompositionStart(); nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); assert.deepEqual(calls, []);
  input.props.onCompositionEnd(); nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); assert.deepEqual(calls, [['quick-submit']]);
}));

test('group menu rename remains inline and composition does not submit its form', () => runtime('ListDetailPage', async ({ render, exports, pump, calls }) => {
  nodes(render()).find(n => n.type === exports.ListActionsMenu && n.props.label === '分组 行李').props.onRename(); await pump();
  const input = () => nodes(render()).find(n => n.type === 'input' && n.props['aria-label'] === '编辑分组名称');
  input().props.onChange({ target: { value: '新分组名称' } }); await pump();
  input().props.onCompositionStart(); nodes(render()).find(n => n.type === 'form' && nodes(n).some(i => i.props['aria-label'] === '编辑分组名称')).props.onSubmit({ preventDefault() {} });
  assert.equal(calls.filter((c: any) => c[0] === 'rename-group').length, 0);
  input().props.onCompositionEnd(); nodes(render()).find(n => n.type === 'form' && nodes(n).some(i => i.props['aria-label'] === '编辑分组名称')).props.onSubmit({ preventDefault() {} }); await pump();
  assert.deepEqual(calls.find((c: any) => c[0] === 'rename-group'), ['rename-group', 'g', '新分组名称']);
}));


test('unmounted late save never commits or starts an obsolete page reread', () => runtime('ListDetailPage', async ({ m, calls, region, pump, unmount }) => {
  region().onEditItem(item); region().onEditChange('旧页面输入'); await pump(); let release!: () => void;
  m.barrier = new Promise<void>(yes => { release = yes; }); region().onSaveEdit(); unmount(); release(); await pump();
  assert.equal(calls.filter((c: any) => c[0] === 'confirmed' || c[0] === 'refresh').length, 0);
}));

test('permission loss during pending save keeps draft and cannot report local success', () => runtime('ListDetailPage', async ({ m, calls, region, pump }) => {
  region().onEditItem(item); region().onEditChange('资格变化时保留'); await pump(); let release!: () => void;
  m.barrier = new Promise<void>(yes => { release = yes; }); region().onSaveEdit(); m.state.degraded = true; await pump(); release(); await pump();
  assert.equal(calls.filter((c: any) => c[0] === 'confirmed').length, 0); assert.equal(region().ui.editing.draft, '资格变化时保留');
}));


test('remote deletion also preserves untouched original text from an open editor for copying', () => modules(async ({ initialListDetailUiState, reconcileListDetailUiState }) => {
  const state = { ...initialListDetailUiState(), editing: { kind: 'item', id: 'a', draft: '牛奶', original: '牛奶' } };
  const next = reconcileListDetailUiState(state, [], []); assert.equal(next.editing, null); assert.deepEqual(next.recovered, ['牛奶']);
}));
