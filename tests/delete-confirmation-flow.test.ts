import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { createServer } from 'vite';
const nodes = (n: any): any[] => React.isValidElement(n) ? [n, ...React.Children.toArray(n.props.children).flatMap(nodes)] : [];
const text = (n: any): string => React.isValidElement(n) ? React.Children.toArray(n.props.children).map(text).join('') : typeof n === 'string' ? n : '';
const button = (tree: any, label: string) => { const n = nodes(tree).find(n => n.type === 'button' && text(n) === label); assert.ok(n, label); return n; };

// Real page handlers; external data and React scheduling only are injected.
async function runtime(kind: 'review' | 'list' | 'invite', run: (e: any) => Promise<void>) {
  let cursor = 0; const slots: any[] = [], effects: any[] = []; const cleanups = new Map(); const calls: any[] = [];
  const old = { window: globalThis.window, requestAnimationFrame: globalThis.requestAnimationFrame };
  const entry = { review_id: 'r', user_id: 'me', next_plan: null };
  const m: any = { calls, detail: { round: { id: 'r', space_id: 's', round_no: 2, review_date: '2026-10-15' }, own: entry, other: { ...entry, user_id: 'other' } },
    data: { status: 'ready', space: { id: 's', kind: 'shared', name: '共享' }, list: { id: 'l', space_id: 's', name: '清单' }, sections: [{ id: 'g', list_id: 'l', name: '空分组', sort_order: 1 }], items: [{ id: 'i', list_id: 'l', space_id: 's', section_id: null, content: '牛奶', completed: false, sort_order: 1 }] },
    useState(initial: any) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], (v: any) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
    useRef(initial: any) { return slots[cursor++] ??= { current: initial }; },
    useId: () => 'fixture',
    useEffect(fn: any, deps: any[]) { const i = cursor++; if (!slots[i] || deps.some((d, n) => d !== slots[i][n])) { slots[i] = deps; effects.push({ i, fn }); } },
    async mutate(...args: any[]) { calls.push(['delete', ...args]); if (m.barrier) await m.barrier; if (m.error) throw m.error; },
    useListDetail() { return { state: { status: 'ready', degraded: false, data: m.data }, refresh: async () => m.data, reconnect() {}, applyConfirmed: (change: any) => calls.push(['projection', change]), startDrag() {}, finishDrag() {} }; },
  };
  (globalThis as any).__deleteFlow = m;
  (globalThis as any).window = { addEventListener() {}, removeEventListener() {}, confirm() { throw new Error('Unexpected native confirmation'); } };
  (globalThis as any).requestAnimationFrame = () => 0;
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] }, ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{ name: 'delete-confirm-flow', enforce: 'pre',
    resolveId(id, importer) {
      if (id === 'react' && importer?.includes('/components/')) return '\0hooks';
      for (const name of ['review-detail-data','review-history-data','supabase','lists-detail-data','useListDetail','ListSheets']) if (new RegExp('/'+name+'(?:\\.ts)?$').test(id)) return '\0'+name;
    },
    load(id) { const pre = 'const m=globalThis.__deleteFlow;';
      if (id === '\0hooks') return pre+'export const {useState,useRef,useId,useEffect}=m;';
      if (id === '\0supabase') return pre+'export const supabase={rpc:async(...args)=>{await m.mutate(...args);return {data:{id:"s",invite_code:"NEW"},error:null}}};';
      if (id === '\0review-history-data') return 'export const loadReviewEligibility=async()=>[{id:"s"}];';
      if (id === '\0review-detail-data') return pre+'export const readReviewDetail=async()=>m.detail,readPreviousPlan=async()=>null,correctReviewDate=async()=>null,deleteReviewRound=m.mutate;';
      if (id === '\0useListDetail') return pre+'export const useListDetail=m.useListDetail;';
      if (id === '\0ListSheets') return 'export const useListModalKeyboard=()=>({container:{current:null}}),ListDeleteDialog=()=>null,ListEditorSheet=()=>null;';
      if (id === '\0lists-detail-data') return pre+'export const deleteListItem=m.mutate,deleteListSection=m.mutate,createListItem=()=>{},createListSection=()=>{},editListItem=()=>{},renameListSection=()=>{},reorderListItems=()=>{},setListItemCompleted=()=>{};';
    },
  }] } as any);
  try {
    const loaded = await vite.ssrLoadModule(kind === 'review' ? '/src/components/ReviewDetailPage.tsx' : kind === 'invite' ? '/src/components/InvitePanel.tsx' : '/src/components/ListDetailPage.tsx');
    const Page = kind === 'review' ? loaded.ReviewDetailPage : kind === 'invite' ? loaded.InvitePanel : loaded.ListDetailPage;
    const props = { space: { id: 's', name: '共享', invite_code: 'OLD' }, onSpaceChange: () => calls.push(['rotated']), target: kind === 'review' ? { spaceId: 's', reviewId: 'r', justCreated: false } : { spaceId: 's', listId: 'l' }, userId: 'me', onDirtyChange() {}, onBack: () => calls.push(['back']), onUnavailable: () => calls.push(['unavailable']) };
    const render = () => { cursor = 0; return Page(props); };
    const pump = async () => { for (let j = 0; j < 5; j++) { render(); for (const { i, fn } of effects.splice(0)) { cleanups.get(i)?.(); const done = fn(); if (done) cleanups.set(i, done); } await new Promise(r => setTimeout(r, 0)); } return render(); };
    const open = () => kind === 'review' ? button(render(), '删除回顾').props.onClick() : kind === 'invite' ? button(render(), '轮换邀请码').props.onClick() : nodes(render()).find(n => n.props.onDeleteItem)?.props.onDeleteItem(m.data.items[0]);
    await pump(); await run({ m, calls, render, pump, open });
  } finally { for (const done of cleanups.values()) done(); await vite.close(); delete (globalThis as any).__deleteFlow; Object.assign(globalThis, old); }
}

for (const kind of ['review', 'list', 'invite'] as const) {
  const label = kind === 'review' ? '永久删除回顾' : kind === 'invite' ? '确认轮换' : '永久删除项目';
  test(`${kind}: cancel never deletes; confirming twice submits once and success reconciles`, () => runtime(kind, async ({ m, calls, render, pump, open }) => {
    open(); await pump(); assert.equal(calls.length, 0); button(render(), '取消').props.onClick(); await pump(); assert.equal(calls.length, 0);
    open(); await pump(); let release!: () => void; m.barrier = new Promise<void>(r => release = r);
    const action = button(render(), label).props.onClick; action(); action(); await pump(); assert.equal(calls.filter(c => c[0] === 'delete').length, 1); release(); await pump();
    assert.ok(calls.some(c => c[0] === (kind === 'review' ? 'unavailable' : kind === 'invite' ? 'rotated' : 'projection')));
  }));
  test(`${kind}: failure retains confirmation and permits retry without leaving`, () => runtime(kind, async ({ m, calls, render, pump, open }) => {
    open(); await pump(); m.error = new Error('删除失败，请重试。'); button(render(), label).props.onClick(); await pump();
    assert.ok(nodes(render()).some(n => n.props.role === 'dialog')); assert.ok(!button(render(), label).props.disabled); assert.ok(!calls.some(c => ['back','unavailable','projection','rotated'].includes(c[0])));
    m.error = null; button(render(), label).props.onClick(); await pump(); assert.equal(calls.filter(c => c[0] === 'delete').length, 2);
  }));
}

test('empty List group opens confirmation and cancellation does not run the mutation', () => runtime('list', async ({ calls, render, pump }) => {
  const menu = nodes(render()).find(n => n.props.label === '分组 空分组'); assert.ok(menu); menu.props.onDelete(); await pump(); assert.equal(calls.length, 0);
  assert.ok(button(render(), '永久删除分组')); button(render(), '取消').props.onClick(); await pump(); assert.equal(calls.length, 0);
}));
