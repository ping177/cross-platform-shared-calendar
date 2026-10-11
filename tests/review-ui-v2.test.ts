import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const blank = () => ({ review_id: 'r', user_id: 'me', focus: null, progress: null, problems: null, next_plan: null, content_revision: 0, filled_revision: null, updated_at: '2026-10-11' });
const nodes = (node: any): any[] => React.isValidElement(node) ? [node, ...React.Children.toArray((node.props as any).children).flatMap(nodes)] : [];
const words = (node: any): string => React.isValidElement(node) ? React.Children.toArray((node.props as any).children).map(words).join('') : typeof node === 'string' ? node : '';
const findButton = (tree: any, label: string) => nodes(tree).find((n) => n.type === 'button' && words(n) === label);
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise((yes) => setTimeout(yes, 0)); };

// Real component handlers and effects; only scheduling and external reads/writes are injected.
async function editorRuntime(run: (env: any) => Promise<void>, startEditing = false) {
  let cursor = 0; const slots: any[] = []; const effects: any[] = []; const cleanups = new Map();
  const calls: any[] = []; const originalWindow = globalThis.window;
  const m: any = { entry: blank(), confirm: true,
    useState(initial: any) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], (v: any) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
    useRef(initial: any) { return slots[cursor++] ??= { current: initial }; },
    useId() { return 'editor'; },
    useEffect(fn: any, deps: any[]) { const i = cursor++; if (!slots[i] || deps.some((d, n) => d !== slots[i][n])) { slots[i] = deps; effects.push({ i, fn }); } },
    async read(_client: any, reviewId: string, userId: string) { calls.push(['read', reviewId, userId]); if (m.readError) throw m.readError; return { ...m.entry, review_id: reviewId, user_id: userId }; },
    async save(_client: any, reviewId: string, userId: string, draft: any) { calls.push(['save', reviewId, userId, { ...draft }]); if (m.saveBarrier) await m.saveBarrier; if (m.saveError) throw m.saveError; m.entry = { ...m.entry, ...draft, review_id: reviewId, user_id: userId, content_revision: m.entry.content_revision + 1 }; return { ...m.entry }; },
    async mark(_client: any, reviewId: string, userId: string) { calls.push(['mark', reviewId, userId]); if (m.markBarrier) await m.markBarrier; if (m.markError) throw m.markError; m.entry = { ...m.entry, filled_revision: m.entry.content_revision }; return { ...m.entry }; },
  };
  (globalThis as any).__reviewV2 = m;
  (globalThis as any).window = { confirm: () => { calls.push(['confirm']); return m.confirm; } };
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{
      name: 'review-v2-runtime', enforce: 'pre',
      resolveId(id, importer) { if (id === 'react' && importer?.includes('/components/')) return '\0review-hooks'; if (/\/review-entry-data(?:\.ts)?$/.test(id)) return '\0review-data'; if (/\/supabase(?:\.ts)?$/.test(id)) return '\0review-client'; },
      load(id) { const pre = 'const m=globalThis.__reviewV2;';
        if (id === '\0review-hooks') return pre + 'export const {useState,useRef,useId,useEffect}=m;';
        if (id === '\0review-data') return pre + 'export const readMyReviewEntry=m.read,saveMyReviewEntry=m.save,markMyReviewFilled=m.mark;';
        if (id === '\0review-client') return 'export const supabase={};';
      },
    }] } as any);
  try {
    const { ReviewEntryEditor } = await vite.ssrLoadModule('/src/components/ReviewEntryEditor.tsx');
    const props: any = { reviewId: 'r', userId: 'me', startEditing, onDirtyChange: (dirty: boolean) => calls.push(['dirty', dirty]) };
    const render = () => { cursor = 0; return ReviewEntryEditor(props); };
    const pump = async () => { for (let j = 0; j < 4; j++) { render(); for (const { i, fn } of effects.splice(0)) { cleanups.get(i)?.(); const done = fn(); if (done) cleanups.set(i, done); } await flush(); } return render(); };
    const change = (field: string, value: string) => { const el = nodes(render()).find((n) => n.type === 'textarea' && n.props.id.endsWith('-' + field)); assert.ok(el); el.props.onChange({ target: { value } }); };
    const html = () => renderToStaticMarkup(render());
    const save = () => nodes(render()).find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} });
    await run({ m, calls, props, render, pump, change, html, save });
  } finally { for (const done of cleanups.values()) done(); await vite.close(); delete (globalThis as any).__reviewV2; (globalThis as any).window = originalWindow; }
}

test('historical entry starts in reading view, exposes four saved fields and only own edit action', () => editorRuntime(async ({ m, pump, html, render }) => {
  m.entry = { ...blank(), focus: '专注内容', progress: '进展内容', problems: '问题内容', next_plan: '计划内容', content_revision: 2, filled_revision: 2 };
  await pump(); const text = html();
  for (const value of ['专注内容', '进展内容', '问题内容', '计划内容', '已填写']) assert.ok(text.includes(value));
  assert.doesNotMatch(text, /<textarea|对方|保存草稿|Review/);
  findButton(render(), '编辑我的回顾').props.onClick(); await pump(); assert.equal(nodes(render()).filter((n) => n.type === 'textarea').length, 4);
}));

test('new round opens four-field editor; draft save and filled marking remain separate', () => editorRuntime(async ({ pump, change, render, save, calls, html }) => {
  await pump(); assert.equal(nodes(render()).filter((n) => n.type === 'textarea').length, 4);
  assert.equal(findButton(render(), '我已填写').props.disabled, true);
  for (const field of ['focus', 'progress', 'problems', 'next_plan']) change(field, field + ' 内容');
  await pump(); assert.equal(findButton(render(), '我已填写').props.disabled, true);
  await save(); await pump(); assert.match(html(), /编辑中/); assert.equal(calls.filter((c: any) => c[0] === 'mark').length, 0);
  assert.equal(findButton(render(), '我已填写').props.disabled, false);
  await findButton(render(), '我已填写').props.onClick(); await pump(); assert.match(html(), /已填写/);
  assert.deepEqual(calls.filter((c: any) => c[0] === 'mark')[0], ['mark', 'r', 'me']);
  assert.doesNotMatch(html(), /<textarea/);
}, true));

test('saved edit of filled content becomes 有更新 without marking the other participant', () => editorRuntime(async ({ m, pump, change, render, save, html, calls }) => {
  m.entry = { ...blank(), focus: '原内容', content_revision: 1, filled_revision: 1 }; await pump();
  findButton(render(), '编辑我的回顾').props.onClick(); change('focus', '新内容'); await save(); await pump();
  assert.match(html(), /有更新/); assert.equal(findButton(render(), '我已填写').props.disabled, false);
  assert.equal(calls.filter((c: any) => c[0] === 'mark').length, 0);
}));

test('cancel respects unsaved confirmation and restores canonical saved draft only after acceptance', () => editorRuntime(async ({ m, pump, change, render, html, calls }) => {
  await pump(); findButton(render(), '填写我的回顾').props.onClick(); change('focus', '未保存'); await pump();
  m.confirm = false; findButton(render(), '取消').props.onClick(); assert.match(html(), /未保存/); assert.match(html(), /<textarea/);
  m.confirm = true; findButton(render(), '取消').props.onClick(); await pump(); assert.doesNotMatch(html(), /<textarea|未保存/);
  findButton(render(), '填写我的回顾').props.onClick(); assert.equal(nodes(render()).find((n) => n.type === 'textarea').props.value, '');
  assert.equal(calls.filter((c: any) => ['save', 'mark'].includes(c[0])).length, 0);
}));

test('save failure preserves all fields, allows retry, and never marks filled', () => editorRuntime(async ({ m, pump, change, save, html, calls }) => {
  await pump(); for (const field of ['focus', 'progress', 'problems', 'next_plan']) change(field, field + ' 草稿');
  m.saveError = new Error('network'); await save(); await pump(); assert.match(html(), /保存失败/);
  for (const field of ['focus', 'progress', 'problems', 'next_plan']) assert.ok(html().includes(field + ' 草稿'));
  m.saveError = null; await save(); await pump(); assert.match(html(), /编辑中/);
  assert.equal(calls.filter((c: any) => c[0] === 'mark').length, 0);
}, true));

test('save and mark reject duplicate submission while busy; permission failure keeps retryable draft', () => editorRuntime(async ({ m, pump, change, render, save, html, calls }) => {
  await pump(); change('focus', '保留草稿'); let release!: () => void;
  m.saveBarrier = new Promise<void>((yes) => { release = yes; }); const handler = nodes(render()).find((n) => n.type === 'form').props.onSubmit;
  const first = handler({ preventDefault() {} }); await handler({ preventDefault() {} });
  assert.equal(calls.filter((c: any) => c[0] === 'save').length, 1); assert.equal(findButton(render(), '取消').props.disabled, true);
  m.saveError = new Error('permission denied'); release(); await first; await pump(); assert.match(html(), /参与权限已变化/); assert.match(html(), /保留草稿/);
  m.saveBarrier = null; m.saveError = null; await save(); await pump();
  m.markBarrier = new Promise<void>((yes) => { release = yes; }); const mark = findButton(render(), '我已填写').props.onClick;
  const marking = mark(); await mark(); assert.equal(calls.filter((c: any) => c[0] === 'mark').length, 1);
  m.markError = new Error('Review module is disabled'); release(); await marking; await pump(); assert.match(html(), /模块已关闭/); assert.match(html(), /编辑中/);
}, true));

test('changed review identity invalidates late save and loads the next round instead', () => editorRuntime(async ({ m, props, pump, change, save, html }) => {
  await pump(); change('focus', '旧轮草稿'); let release!: () => void;
  m.saveBarrier = new Promise<void>((yes) => { release = yes; }); const pending = save();
  props.reviewId = 'next'; m.entry = blank(); await pump(); release(); await pending; await pump();
  assert.doesNotMatch(html(), /旧轮草稿/);
}, true));
