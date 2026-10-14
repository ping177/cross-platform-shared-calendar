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
  const response: any = { data: { ...space, name: '新空间' }, error: null };
  const query: any = { update(value: any) { calls.push(value); return query; }, eq() { return query; }, select() { return query; }, async maybeSingle() { return response; } };
  const client: any = { auth: { async getUser() { return { data: { user: { id: 'me' } }, error: null }; } }, from() { return query; } };
  (globalThis as any).__renameHooks = hooks; (globalThis as any).__renameClient = client;
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] }, plugins: [{ name: 'rename-runtime', enforce: 'pre', resolveId(id) { if (id === 'react') return '\0rename-hooks'; if (/\/supabase(?:\.ts)?$/.test(id)) return '\0rename-client'; }, load(id) { if (id === '\0rename-hooks') return 'export const {useState,useRef,useEffect}=globalThis.__renameHooks;'; if (id === '\0rename-client') return 'export const supabase=globalThis.__renameClient;'; } }] } as any);
  try {
    const { SpaceNameEditor } = await vite.ssrLoadModule('/src/components/SpaceNameEditor.tsx');
    const props: any = { space, userId: 'me', busy: false, onBusyChange(busy: boolean) { props.busy = busy; }, onSpaceChange(updated: any) { saved.push(updated); props.space = { ...props.space, ...updated }; } };
    const render = () => { cursor = 0; return SpaceNameEditor(props); };
    const click = (label: string) => nodes(render()).find(n => n.type === 'button' && n.props.children === label).props.onClick();
    const change = (value: string) => nodes(render()).find(n => n.type === 'input').props.onChange({ target: { value } });
    const submit = () => nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    await run({ props, render, click, change, submit, calls, saved, client, query, response, effects, html: () => renderToStaticMarkup(render()), flush: () => new Promise(r => setImmediate(r)) });
  } finally { await vite.close(); delete (globalThis as any).__renameHooks; delete (globalThis as any).__renameClient; }
}
test('only current owners have the inline edit entry; Personal additionally requires creator identity', () => runtime(async ({ props, html }) => {
  assert.match(html(), /修改名称|ui-focus|min-h-11/);
  props.space = { ...space, membershipRole: 'member' }; assert.equal(html(), '');
  props.space = { ...space, kind: 'personal', created_by: 'me' }; assert.match(html(), /修改名称/);
  props.space = { ...props.space, created_by: 'other' }; assert.equal(html(), '');
}));
test('prefilled required input and unchanged submit do not send a mutation', () => runtime(async ({ click, submit, calls, render, html, flush }) => {
  click('修改名称'); const input = nodes(render()).find(n => n.type === 'input');
  assert.equal(input.props.value, space.name); assert.equal(input.props.required, true);
  assert.equal(input.props.maxLength, undefined); // UTF-16 maxLength must not cap 80 astral characters at 40.
  assert.equal(nodes(render()).find(n => n.type === 'button' && n.props.type === 'submit').props.disabled, true);
  submit(); await flush(); assert.equal(calls.length, 0); assert.doesNotMatch(html(), /<input/);
}));
test('successful save trims input, applies canonical record once and closes inline form', () => runtime(async ({ click, change, submit, saved, calls, html, flush }) => {
  click('修改名称'); change(' \u00a0新空间\ufeff '); submit(); await flush();
  assert.deepEqual(calls, [{ name: '新空间' }]); assert.equal(saved.length, 1);
  assert.equal(saved[0].invite_code, 'KEEP'); assert.match(html(), /空间名称已更新/); assert.doesNotMatch(html(), /<input/);
}));
test('same-tick submits and cancel are blocked while saving', () => runtime(async ({ click, change, submit, query, calls, html, flush }) => {
  let release: any; query.maybeSingle = () => new Promise(resolve => { release = resolve; });
  click('修改名称'); change('新空间'); submit(); submit(); await flush(); click('取消');
  assert.equal(calls.length, 1); assert.match(html(), /保存中|value="新空间"/);
  release({ data: { ...space, name: '新空间' }, error: null }); await flush(); assert.doesNotMatch(html(), /<input/);
}));
test('failure preserves original name and edited input; retry then succeeds', () => runtime(async ({ props, response, saved, click, change, submit, html, flush }) => {
  response.error = { message: 'Only the Space owner may change its name' };
  click('修改名称'); change('新空间'); submit(); await flush();
  assert.equal(props.space.name, space.name); assert.equal(saved.length, 0); assert.match(html(), /当前空间所有者|value="新空间"/);
  response.error = null; submit(); await flush(); assert.equal(saved.length, 1); assert.equal(props.space.name, '新空间');
}));
test('empty, whitespace and overlength drafts retain original canonical name without writes', () => runtime(async ({ props, calls, click, change, submit, html, flush }) => {
  click('修改名称');
  for (const value of ['', '\t\u00a0\ufeff', '🌿'.repeat(81)]) {
    change(value); submit(); await flush(); assert.match(html(), /1–80/); assert.equal(props.space.name, space.name);
  }
  assert.equal(calls.length, 0);
}));
test('IME composition blocks Enter submission and Escape cancellation', () => runtime(async ({ click, change, submit, render, calls, flush }) => {
  click('修改名称'); change('新空间'); let prevented = 0;
  nodes(render()).find(n => n.type === 'input').props.onCompositionStart();
  nodes(render()).find(n => n.type === 'form').props.onKeyDownCapture({ key: 'Enter', nativeEvent: { isComposing: true }, preventDefault() { prevented++; } });
  submit(); await flush(); assert.equal(calls.length, 0); assert.equal(prevented, 1);
  nodes(render()).find(n => n.type === 'input').props.onCompositionEnd(); submit(); await flush(); assert.equal(calls.length, 1);
}));
test('unmounted editor suppresses late canonical callbacks and releases local busy state', () => runtime(async ({ props, click, change, submit, effects, query, saved, flush }) => {
  let release: any; query.maybeSingle = () => new Promise(resolve => { release = resolve; });
  click('修改名称'); const unmount = effects[0](); change('新空间'); submit(); await flush();
  unmount(); assert.equal(props.busy, false); release({ data: { ...space, name: '新空间' }, error: null }); await flush(); assert.equal(saved.length, 0);
}));
test('root canonical Space update refreshes name labels and invalidates copied names only on rename', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const body = app.split('function updateSpace(updated: Space) {')[1].split('\n  const validFilter')[0].trim().slice(0, -1);
  const keys = ['tasksSnapshot', 'listsSnapshot', 'importantDatesSnapshot', 'reviewSnapshot', 'homeEventsSnapshot', 'homeTasksSnapshot', 'homeImportantDatesSnapshot', 'calendarEventsSnapshot', 'calendarImportantDatesSnapshot'];
  const apply = new Function('spaces', 'updated', 'setSpaces', ...keys, body);
  let spaces: any[] = [space]; const retained = keys.map(() => ({ current: 'existing' }));
  const setSpaces = (updater: any) => { spaces = updater(spaces); };
  apply(spaces, { ...space, invite_code: 'NEWCODE' }, setSpaces, ...retained); assert.ok(retained.every(ref => ref.current === 'existing'));
  apply(spaces, { ...space, name: '新空间' }, setSpaces, ...retained); assert.ok(retained.every(ref => ref.current === null));
  assert.equal(spaces[0].name, '新空间'); assert.equal(spaces[0].membershipRole, 'owner');
});
