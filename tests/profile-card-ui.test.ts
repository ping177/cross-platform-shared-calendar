import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { CurrentSpace } from '../src/types.ts';

const space = { id: 's', name: '共同空间', kind: 'shared', membershipRole: 'owner', created_by: 'former-owner', invite_code: 'KEEP', created_at: '2026-01-01' } as CurrentSpace;
function nodes(tree: any): any[] { return React.isValidElement(tree) ? [tree, ...React.Children.toArray((tree.props as any).children).flatMap(nodes)] : []; }
async function runtime(run: (e: any) => Promise<void>) {
  let cursor = 0;
  const slots: any[] = [], effects: any[] = [], calls: any[] = [], saved: any[] = [];
  const hooks = { useState(initial: any) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (v: any) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; }, useRef(initial: any) { return slots[cursor++] ??= { current: initial }; }, useEffect(fn: any) { effects.push(fn); } };
  const response: any = { data: { display_name: '新名称' }, error: null };
  const query: any = { update(value: any) { calls.push(value); return query; }, eq() { return query; }, select() { return query; }, async maybeSingle() { return response; } };
  const client: any = { auth: { async getUser() { return { data: { user: { id: 'me' } }, error: null }; } }, from() { return query; } };
  (globalThis as any).__renameHooks = hooks; (globalThis as any).__renameClient = client;
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] }, plugins: [{ name: 'rename-runtime', enforce: 'pre', resolveId(id) { if (id === 'react') return '\0rename-hooks'; if (/\/supabase(?:\.ts)?$/.test(id)) return '\0rename-client'; }, load(id) { if (id === '\0rename-hooks') return 'export const {useState,useRef,useEffect}=globalThis.__renameHooks;'; if (id === '\0rename-client') return 'export const supabase=globalThis.__renameClient;'; } }] } as any);
  try {
    const { ProfileCard } = await vite.ssrLoadModule('/src/components/ProfileCard.tsx');
    const props: any = { userId: 'me', loading: false, profile: { display_name: '阿林', avatar_preset: null, avatar_path: null }, onProfileChange(updated: any) { saved.push(updated); props.profile = updated; } };
    const render = () => { cursor = 0; return ProfileCard(props); };
    const click = (label: string) => nodes(render()).find(n => n.type === 'button' && (n.props.children === label || n.props['aria-label'] === label)).props.onClick();
    const change = (value: string) => nodes(render()).find(n => n.type === 'input').props.onChange({ target: { value } });
    const submit = () => nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    await run({ props, render, click, change, submit, calls, saved, client, query, response, effects, html: () => renderToStaticMarkup(render()), flush: () => new Promise(r => setImmediate(r)) });
  } finally { await vite.close(); delete (globalThis as any).__renameHooks; delete (globalThis as any).__renameClient; }
}
test('default profile is compact; edit replaces name with input and cancel preserves saved name', () => runtime(async ({ click, html, render }) => {
  assert.doesNotMatch(html(), /<input|保存名称/); assert.match(html(), /阿林|lucide-pencil/);
  click('修改显示名称'); assert.match(html(), /value="阿林"/); assert.doesNotMatch(html(), /<h2/);
  assert.equal(nodes(render()).find(n => n.type === 'input').props.maxLength, 20);
  click('取消'); assert.doesNotMatch(html(), /<input/); assert.match(html(), /阿林/);
}));
test('unchanged trimmed name closes without a request; valid name saves only display_name', () => runtime(async ({ click, change, submit, calls, saved, html, flush }) => {
  click('修改显示名称'); change('  阿林  '); submit(); await flush(); assert.equal(calls.length, 0); assert.doesNotMatch(html(), /<input/);
  click('修改显示名称'); change('  新名称  '); submit(); await flush(); assert.deepEqual(calls, [{ display_name: '新名称' }]); assert.equal(saved[0].display_name, '新名称'); assert.doesNotMatch(html(), /<input/);
}));
test('blank and overlength names do not write and keep draft for correction', () => runtime(async ({ click, change, submit, calls, html, flush }) => {
  click('修改显示名称'); for (const value of ['', '  ', '字'.repeat(21)]) { change(value); submit(); await flush(); assert.match(html(), /1–20/); assert.equal(calls.length, 0); assert.match(html(), /<input/); }
}));
test('same-tick submit lock blocks duplicate writes and cancellation; failure keeps draft for retry', () => runtime(async ({ click, change, submit, query, calls, response, html, flush }) => {
  let release: any; query.maybeSingle = () => new Promise(resolve => { release = resolve; });
  click('修改显示名称'); change('新名称'); submit(); submit(); await flush(); click('取消'); assert.equal(calls.length, 1);
  release({ data: null, error: { message: 'fixture failure' } }); await flush(); assert.match(html(), /value="新名称"|未能更新/);
  query.maybeSingle = async () => response; submit(); await flush(); assert.equal(calls.length, 2); assert.doesNotMatch(html(), /<input/);
}));
test('IME composition blocks Enter/Escape; normal Escape cancels', () => runtime(async ({ click, change, submit, render, calls, html, flush }) => {
  click('修改显示名称'); change('新名称'); let prevented = 0;
  nodes(render()).find(n => n.type === 'input').props.onCompositionStart();
  nodes(render()).find(n => n.type === 'form').props.onKeyDownCapture({ key: 'Enter', nativeEvent: { isComposing: true }, preventDefault() { prevented++; } });
  submit(); await flush(); assert.equal(calls.length, 0); assert.equal(prevented, 1);
  nodes(render()).find(n => n.type === 'input').props.onCompositionEnd();
  nodes(render()).find(n => n.type === 'form').props.onKeyDownCapture({ key: 'Escape', nativeEvent: {}, preventDefault() {} }); assert.doesNotMatch(html(), /<input/);
}));
test('loading/error profiles cannot edit; account mismatch cannot update; unmounted writes do not publish UI state', () => runtime(async ({ props, click, change, submit, client, effects, query, saved, html, flush, calls }) => {
  props.loading = true; click('修改显示名称'); assert.doesNotMatch(html(), /<input/); props.loading = false;
  client.auth.getUser = async () => ({ data: { user: { id: 'other' } }, error: null }); click('修改显示名称'); change('新名称'); submit(); await flush(); assert.equal(calls.length, 0); assert.match(html(), /登录状态已变化/);
  client.auth.getUser = async () => ({ data: { user: { id: 'me' } }, error: null }); let release: any; query.maybeSingle = () => new Promise(r => { release = r; }); const unmount = effects[0](); submit(); await flush(); unmount(); release({ data: { display_name: '新名称' }, error: null }); await flush(); assert.equal(saved.length, 0);
}));
