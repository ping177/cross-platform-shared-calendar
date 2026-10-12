import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const personal = { id: 'p', name: '我的空间', kind: 'personal', membershipRole: 'owner', created_by: 'me' };
const shared = { id: 's', name: '共同空间', kind: 'shared', membershipRole: 'member', created_by: 'other' };
const list = { id: 'l', space_id: 's', name: '旅行采购', created_at: '2026-10-11', updated_at: '2026-10-11', created_by: 'me' };
const noop = () => undefined;
const nodes = (node: any): any[] => React.isValidElement(node) ? [node, ...React.Children.toArray((node.props as any).children).flatMap(nodes)] : [];

async function withComponents(run: (components: any) => Promise<void>) {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{
    name: 'lists-v2-detail-fixture', enforce: 'pre',
    resolveId(id) { if (/\/useListDetail(?:\.ts)?$/.test(id)) return '\0lists-v2-detail'; },
    load(id) { if (id === '\0lists-v2-detail') return 'export const useListDetail=()=>globalThis.__listsV2Detail;'; },
  }] });
  try { await run({ ...await vite.ssrLoadModule('/src/components/ListsOverviewPage.tsx'), ...await vite.ssrLoadModule('/src/components/ListSheets.tsx'), ...await vite.ssrLoadModule('/src/components/ListDetailPage.tsx') }); }
  finally { await vite.close(); delete (globalThis as any).__listsV2Detail; }
}

test('overview retains actual names, counts, Space and independent actions in one lightweight group', () => withComponents(async ({ ListsRows }) => {
  const html = renderToStaticMarkup(React.createElement(ListsRows, { rows: [{ list, totalItems: 3, completedCount: 1 }], spaces: [shared], showSource: true, onOpen: noop, onRename: noop, onDelete: noop }));
  assert.match(html, /旅行采购/); assert.match(html, /共同空间/); assert.match(html, /已完成 1 \/ 3/);
  assert.equal((html.match(/<button/g) ?? []).length, 3);
  assert.match(html, /ui-lists-rows/); assert.doesNotMatch(html, /shadow-sm/);
}));

test('create and rename use one header submit, a close callback and name before original Space control', () => withComponents(async ({ ListEditorSheet }) => {
  for (const mode of ['create', 'rename']) {
    const html = renderToStaticMarkup(React.createElement(ListEditorSheet, { mode, list, memberSpaces: [personal, shared], eligibleSpaces: [personal, shared], userId: 'me', initialTargetId: 'p', onSubmit: async () => {}, onCancel: noop }));
    assert.match(html, /<header[\s\S]*type="submit"[\s\S]*<\/header>/);
    assert.match(html, /aria-label="关闭清单表单"/);
    assert.ok(html.indexOf('for="list-name"') < html.indexOf('for="list-space"'));
    assert.equal((html.match(/type="submit"/g) ?? []).length, 1);
    assert.equal((html.match(/<input/g) ?? []).length, 1);
    assert.equal((html.match(/<select/g) ?? []).length, mode === 'create' ? 1 : 0);
    assert.doesNotMatch(html, /描述|选择图标|创建后添加/);
  }
}));

test('detail progress derives from all actual groups, retains empty active state and never produces NaN', () => withComponents(async ({ ListDetailPage }) => {
  const render = (items: any[]) => {
    (globalThis as any).__listsV2Detail = { state: { status: 'ready', degraded: false, data: { list, space: shared, sections: [{ id: 'g', list_id: 'l', space_id: 's', name: '行李', sort_order: 1 }], items } }, refresh: noop, reconnect: noop, applyConfirmed: noop, startDrag: noop, finishDrag: noop, syncError: '' };
    return renderToStaticMarkup(React.createElement(ListDetailPage, { userId: 'me', target: { listId: 'l', spaceId: 's' }, onBack: noop, onUnavailable: noop }));
  };
  const row = { list_id: 'l', space_id: 's', content: '物品', sort_order: 1 };
  const html = render([{ ...row, id: 'a', section_id: null, completed: false }, { ...row, id: 'b', section_id: 'g', completed: true }]);
  assert.match(html, /已完成 1 \/ 2/); assert.match(html, /aria-label="清单完成进度"[^>]*value="50"/);
  assert.match(html, /清单改名|删除清单|添加分组/);
  const empty = render([]); assert.match(empty, /已完成 0 \/ 0/); assert.match(empty, /还没有清单项/); assert.doesNotMatch(empty, /NaN|Infinity/);
}));

// Actual Sheet event handlers, with only React scheduling injected; no database or new submit chain.
async function sheetRuntime(run: (env: any) => Promise<void>) {
  let cursor = 0; const slots: any[] = [];
  (globalThis as any).__listsV2Hooks = {
    useState(initial: any) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (value: any) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial: any) { return slots[cursor++] ??= { current: initial }; }, useEffect() {},
  };
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{
    name: 'lists-v2-sheet-handlers', enforce: 'pre', resolveId(id, importer) { if (id === 'react' && importer?.endsWith('/ListSheets.tsx')) return '\0lists-v2-hooks'; },
    load(id) { if (id === '\0lists-v2-hooks') return 'export const {useState,useRef,useEffect}=globalThis.__listsV2Hooks;'; },
  }] } as any);
  try {
    const { ListEditorSheet } = await vite.ssrLoadModule('/src/components/ListSheets.tsx');
    const calls: any[] = []; const props: any = { mode: 'create', memberSpaces: [personal, shared], eligibleSpaces: [personal, shared], userId: 'me', initialTargetId: 'p', onSubmit: async (...args: any[]) => { calls.push(args); }, onCancel: () => calls.push('cancel') };
    const render = () => { cursor = 0; return ListEditorSheet(props); };
    const change = (name: string, value: string) => nodes(render()).find(n => n.props.id === name).props.onChange({ target: { value } });
    const submit = () => { nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); };
    const flush = async () => { await new Promise(yes => setImmediate(yes)); };
    await run({ props, calls, render, change, submit, flush, html: () => renderToStaticMarkup(render()) });
  } finally { await vite.close(); delete (globalThis as any).__listsV2Hooks; }
}

test('header save preserves chosen Space and trim validation; close keeps original cancel callback', () => sheetRuntime(async ({ calls, render, change, submit, flush, html }) => {
  change('list-name', '   '); submit(); await flush(); assert.equal(calls.length, 0); assert.match(html(), /role="alert"/);
  change('list-name', '  买菜  '); change('list-space', 's'); submit(); await flush(); assert.deepEqual(calls, [['买菜', 's']]);
  nodes(render()).find(n => n.props['aria-label'] === '关闭清单表单').props.onClick(); assert.equal(calls[1], 'cancel');
}));

test('save failure preserves text, duplicate save is locked and eligibility change blocks retry', () => sheetRuntime(async ({ props, calls, render, change, submit, flush, html }) => {
  let release!: () => void; const barrier = new Promise<void>(yes => { release = yes; });
  props.onSubmit = async (...args: any[]) => { calls.push(args); await barrier; throw new Error('保存失败，请重试。'); };
  change('list-name', '保留输入'); submit(); submit(); assert.equal(calls.length, 1);
  assert.equal(nodes(render()).find(n => n.props['aria-label'] === '关闭清单表单').props.disabled, true);
  release(); await flush(); assert.match(html(), /保存失败，请重试。/); assert.match(html(), /value="保留输入"/);
  props.eligibleSpaces = [shared]; submit(); await flush(); assert.equal(calls.length, 1);
  props.eligibleSpaces = [personal, shared]; props.onSubmit = async (...args: any[]) => { calls.push(args); }; submit(); await flush(); assert.equal(calls.length, 2);
}));


test('overview handles empty, single and multiple actual rows without inventing Personal participants', () => withComponents(async ({ ListsOverviewPage }) => {
  for (const count of [0, 1, 3]) {
    const rows = Array.from({ length: count }, (_, i) => ({ list: { ...list, id: 'l' + i, space_id: 'p', name: '个人清单' + i }, totalItems: 0, completedCount: 0 }));
    const data = { memberSpaces: [personal], eligibleSpaces: [personal], grouped: { active: rows, completed: [] } };
    const html = renderToStaticMarkup(React.createElement(ListsOverviewPage, { userId: 'me', entry: { memberSpaces: [personal], eligibleSpaces: [personal] }, initialData: data, onHubBack: noop, onNoEligible: noop, onOpenDetail: noop }));
    assert.equal((html.match(/data-list-id=/g) ?? []).length, count);
    assert.match(html, count ? /个人清单/ : /还没有清单/);
    assert.doesNotMatch(html, /对方|共同空间|第二参与者/);
    assert.match(html, /aria-label="新建清单"[^>]*><svg[^>]*width="18"[^>]*height="18"/);
    assert.match(html, /bg-transparent/);
  }
}));
