import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { createServer } from 'vite';

const space = { id: 'shared', name: '共同', kind: 'shared', membershipRole: 'member' };
const personal = { ...space, id: 'personal', name: '我的空间', kind: 'personal', membershipRole: 'owner' };
const row = { id: 'date-a', space_id: space.id, name: '同名', emoji: '❤️', repeat_kind: 'annual', year: null, month: 2, day: 29,
  reminder_kind: 'all_day_previous_day_20', time_zone: 'Asia/Shanghai', reminder_schedule_changed_at: '2026-10-03T00:00:00.123456Z' };
const eligibility = { memberSpaces: [space, personal], eligibleSpaces: [space, personal] };
const snapshot = { ...eligibility, dates: [row, { ...row, id: 'date-b', space_id: personal.id }] };
const target = (requestId = 1, id = row.id, spaceId = space.id) => ({ requestId, spaceId, importantDateId: id });
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise((yes) => { resolve = yes; }); return { resolve, promise }; };
const elements = (node: any): any[] => React.isValidElement(node) ? [node, ...React.Children.toArray((node.props as any).children).flatMap(elements)] : [];

function hooks() {
  let cursor = 0; const slots: any[] = []; const effects: Array<{ index: number; fn: () => any }> = []; const cleanups = new Map<number, () => void>();
  const mountedEffects = new Map<number, () => any>();
  return {
    reset() { cursor = 0; },
    useState(initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value: any) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(value: any) { const index = cursor++; return slots[index] ??= { current: value }; },
    useCallback(fn: any, deps: any[]) { const index = cursor++; if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) slots[index] = { fn, deps }; return slots[index].fn; },
    useEffect(fn: any, deps: any[]) { const index = cursor++; if (!slots[index] || deps.some((dep, i) => dep !== slots[index][i])) { slots[index] = deps; effects.push({ index, fn }); } },
    flush() { for (const { index, fn } of effects.splice(0)) { cleanups.get(index)?.(); mountedEffects.set(index, fn); const stop = fn(); if (stop) cleanups.set(index, stop); else cleanups.delete(index); } },
    replay() { for (const stop of cleanups.values()) stop(); cleanups.clear(); for (const [index, fn] of mountedEffects) { const stop = fn(); if (stop) cleanups.set(index, stop); } },
    stop() { for (const stop of cleanups.values()) stop(); cleanups.clear(); },
  };
}

async function runtime(run: (env: any) => Promise<void>) {
  const hook = hooks(); const calls: any[] = []; const auth = new Set<any>();
  const mock: any = { ...hook, target: async (_user: string, identity: any) => {
    calls.push(['target', identity]); const date = snapshot.dates.find((d) => d.id === identity.importantDateId && d.space_id === identity.spaceId);
    return date ? { status: 'ready', date, space: eligibility.eligibleSpaces.find((s) => s.id === date.space_id) } : { status: 'missing' };
  }, update: async (...args: any[]) => { calls.push(['update', ...args]); }, remove: async (...args: any[]) => { calls.push(['delete', ...args]); },
    supabase: { auth: { onAuthStateChange(fn: any) { auth.add(fn); return { data: { subscription: { unsubscribe() { auth.delete(fn); } } } }; } } } };
  (globalThis as any).__importantDateTargetTest = mock;
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{ name: 'target-authority-runtime', enforce: 'pre',
      resolveId(id, importer) {
        if (id === 'react' && importer?.includes('/components/')) return '\0target-hooks';
        if (/\/important-dates-data(?:\.ts)?$/.test(id)) return '\0target-data';
        if (/\/supabase(?:\.ts)?$/.test(id)) return '\0target-client';
      },
      load(id) {
        if (id === '\0target-hooks') return 'const m=globalThis.__importantDateTargetTest; export const {useState,useRef,useCallback,useEffect}=m;';
        if (id === '\0target-data') return 'const m=globalThis.__importantDateTargetTest; export const readImportantDateTarget=(...a)=>m.target(...a),updateImportantDate=(...a)=>m.update(...a),deleteImportantDate=(...a)=>m.remove(...a);';
        if (id === '\0target-client') return 'export const supabase=globalThis.__importantDateTargetTest.supabase;';
      },
    }] } as any);
  try {
    const use = (await vite.ssrLoadModule('/src/components/useImportantDateEditor.ts')).useImportantDateEditor;
    const props: any = { userId: 'me', identity: target(), spaces: eligibility.memberSpaces, entry: eligibility };
    const render = () => { hook.reset(); return use(props.userId, props.identity, { spaces: props.spaces, entry: props.entry,
      onClose() { calls.push(['close']); props.identity = null; }, onReconcile() { calls.push(['refresh']); } }); };
    const pump = async () => { for (let i = 0; i < 6; i++) { render(); hook.flush(); await new Promise((r) => setImmediate(r)); } return render(); };
    await run({ mock, props, calls, render, pump, flush: hook.flush, replay: hook.replay, stop: hook.stop,
      auth: (event: string, user?: string) => { for (const fn of auth) fn(event, user ? { user: { id: user } } : null); } });
  } finally { hook.stop(); await vite.close(); delete (globalThis as any).__importantDateTargetTest; }
}

test('direct editor reads exact canonical identity, including Reminder fields, without any module navigation/list', () => runtime(async (e) => {
  e.props.identity = target(1, 'date-b', personal.id);
  assert.equal(e.render().editor, null);
  const view = await e.pump(); assert.equal(view.editor.date, snapshot.dates[1]);
  assert.equal(view.editor.date.reminder_kind, 'all_day_previous_day_20');
  assert.equal(view.editor.date.reminder_schedule_changed_at, row.reminder_schedule_changed_at);
  view.close(); assert.equal((await e.pump()).editor, null);
  assert.equal(e.calls.filter((c: any) => c[0] === 'target').length, 1);
}));

for (const status of ['missing', 'ineligible']) test(`confirmed ${status} never opens another object and reconciles once`, () => runtime(async (e) => {
  e.mock.target = async () => ({ status });
  const view = await e.pump(); assert.equal(view.editor, null); assert.match(view.notice, /不可访问/);
  await e.pump(); assert.equal(e.calls.filter((c: any) => c[0] === 'refresh').length, 1);
}));

test('wrong Space with a colliding ID cannot publish authority', () => runtime(async (e) => {
  e.mock.target = async () => ({ status: 'ready', date: { ...row, space_id: personal.id }, space: personal });
  const view = await e.pump(); assert.equal(view.editor, null); assert.match(view.targetRead.error, /身份不一致/);
}));

test('unknown read failure keeps exact identity for retry, rather than claiming deletion', () => runtime(async (e) => {
  const read = e.mock.target; e.mock.target = async () => { throw new Error('offline'); };
  let view = await e.pump(); assert.equal(view.editor, null); assert.match(view.targetRead.error, /重试/);
  assert.equal(e.calls.filter((c: any) => c[0] === 'refresh').length, 0);
  e.mock.target = read; view.retry(); view = await e.pump(); assert.equal(view.editor.date, row);
}));

for (const kind of ['disabled', 'membership', 'role']) test(`confirmed ${kind} loss revokes editor and late save/delete closures`, () => runtime(async (e) => {
  const view = await e.pump(); view.beginDelete(); const deleting = await e.pump();
  if (kind === 'disabled') e.props.entry = { ...eligibility, eligibleSpaces: [personal] };
  else if (kind === 'membership') e.props.spaces = [personal];
  else { e.props.spaces = [{ ...space, membershipRole: 'owner' }, personal]; e.props.entry = { memberSpaces: e.props.spaces, eligibleSpaces: e.props.spaces }; }
  assert.equal(e.render().editor, null);
  await assert.rejects(view.save({}, space.id), /当前无法保存/); await deleting.confirmDelete();
  assert.equal(e.calls.some((c: any) => ['update', 'delete'].includes(c[0])), false);
  assert.equal((await e.pump()).editor, null);
}));

test('unknown availability hint preserves already qualified editor and does not cause a reread', () => runtime(async (e) => {
  await e.pump(); e.props.entry = null; const view = await e.pump(); assert.equal(view.editor.date, row);
  assert.equal(e.calls.filter((c: any) => c[0] === 'target').length, 1);
}));

test('confirmed scope loss before target publication rejects the late result', () => runtime(async (e) => {
  const pending = deferred(); e.mock.target = () => pending.promise; await e.pump();
  e.props.entry = { ...eligibility, eligibleSpaces: [personal] }; e.render();
  pending.resolve({ status: 'ready', date: row, space });
  assert.equal((await e.pump()).editor, null);
}));

test('A1 → B → A2 late read cannot replace A2', () => runtime(async (e) => {
  const old = deferred(); const second = deferred(); let index = 0; const read = e.mock.target;
  e.mock.target = (...args: any[]) => index++ === 0 ? old.promise : index === 2 ? second.promise : read(...args);
  await e.pump(); e.props.identity = target(2, 'date-b', personal.id); await e.pump();
  e.props.identity = target(3); assert.equal((await e.pump()).editor.date, row);
  old.resolve({ status: 'ready', date: { ...row, name: 'old A1' }, space });
  second.resolve({ status: 'ready', date: snapshot.dates[1], space: personal });
  const view = await e.pump(); assert.equal(view.editor.requestId, 3); assert.equal(view.editor.date, row);
}));

test('StrictMode cleanup/replay schedules a single exact read', () => runtime(async (e) => {
  e.render(); e.flush(); e.replay(); await e.pump();
  assert.equal(e.calls.filter((c: any) => c[0] === 'target').length, 1);
}));

for (const operation of ['save', 'delete']) test(`${operation} keeps canonical own-object identity and refreshes without reopening`, () => runtime(async (e) => {
  let view = await e.pump();
  if (operation === 'save') await view.save({ name: 'fresh' }, space.id);
  else { view.beginDelete(); view = await e.pump(); await view.confirmDelete(); }
  assert.equal(e.calls.find((c: any) => c[0] === (operation === 'save' ? 'update' : 'delete'))[3], row);
  assert.equal((await e.pump()).editor, null);
  assert.equal(e.calls.filter((c: any) => c[0] === 'refresh').length, 1);
}));

for (const operation of ['save', 'delete']) test(`late ${operation} success cannot close a newer interaction`, () => runtime(async (e) => {
  const pending = deferred(); let view = await e.pump();
  e.mock[operation === 'save' ? 'update' : 'remove'] = () => pending.promise;
  if (operation === 'delete') { view.beginDelete(); view = await e.pump(); }
  const work = operation === 'save' ? view.save({}, space.id) : view.confirmDelete();
  e.props.identity = target(2, 'date-b', personal.id); await e.pump(); pending.resolve(undefined); await work;
  assert.equal((await e.pump()).editor.date, snapshot.dates[1]);
  assert.equal(e.calls.filter((c: any) => c[0] === 'close').length, 0);
}));

for (const change of ['sign-out', 'user-switch', 'unmount']) test(`${change} blocks late target publication and old mutation authority`, () => runtime(async (e) => {
  const view = await e.pump();
  if (change === 'sign-out') e.auth('SIGNED_OUT');
  else if (change === 'user-switch') { e.props.userId = 'other'; e.render(); }
  else e.stop();
  await assert.rejects(view.save({}, space.id), /当前无法保存/);
  assert.equal(e.calls.some((c: any) => c[0] === 'update'), false);
}));


for (const change of ['sign-out', 'user-switch', 'unmount']) test(`pending exact read after ${change} cannot publish or reconcile`, () => runtime(async (e) => {
  const pending = deferred(); e.mock.target = () => pending.promise; await e.pump();
  if (change === 'sign-out') { e.auth('SIGNED_OUT'); e.render(); }
  else if (change === 'user-switch') { e.props.userId = 'other'; e.props.identity = null; e.render(); }
  else e.stop();
  pending.resolve({ status: 'ready', date: row, space }); await new Promise((r) => setImmediate(r));
  const view = e.render(); assert.equal(view.editor, null);
  assert.equal(e.calls.some((c: any) => ['close', 'refresh'].includes(c[0])), false);
}));

test('queued same-turn A1 → B → A2 schedules only the current exact read', () => runtime(async (e) => {
  e.render(); e.flush(); e.props.identity = target(2, 'date-b', personal.id); e.render(); e.flush();
  e.props.identity = target(3); e.render(); e.flush(); const view = await e.pump();
  assert.equal(view.editor.requestId, 3); assert.equal(view.editor.date, row);
  assert.equal(e.calls.filter((c: any) => c[0] === 'target').length, 1);
}));
