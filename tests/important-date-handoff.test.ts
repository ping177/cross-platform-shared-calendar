import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const space = { id: 'shared', name: '共同', kind: 'shared', membershipRole: 'member' };
const personal = { ...space, id: 'personal', name: '我的空间', kind: 'personal', membershipRole: 'owner' };
const row = { id: 'date-a', space_id: space.id, name: '同名', emoji: '❤️', repeat_kind: 'annual', year: null, month: 2, day: 29,
  reminder_kind: 'all_day_previous_day_20', time_zone: 'Asia/Shanghai', reminder_schedule_changed_at: '2026-10-03T00:00:00.123456Z' };
const eligibility = { memberSpaces: [space, personal], eligibleSpaces: [space, personal] };
const snapshot = { ...eligibility, dates: [row, { ...row, id: 'date-b', space_id: personal.id }] };
const target = (requestId = 1, returnTo = 'home', id = row.id, spaceId = space.id) => ({ requestId, spaceId, importantDateId: id, returnTo });
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
  const pageHooks = hooks(); const controllerHooks = hooks(); const sheetHooks = hooks(); let active = pageHooks;
  const calls: any[] = []; const listeners = new Map<string, () => void>();
  const previousWindow = (globalThis as any).window; const previousDocument = (globalThis as any).document;
  const surface = { visibilityState: 'visible', addEventListener(key: string, fn: () => void) { listeners.set(key, fn); }, removeEventListener(key: string) { listeners.delete(key); } };
  (globalThis as any).window = surface; (globalThis as any).document = surface;
  class AuthError extends Error {}
  const mock: any = {
    useState: (...args: any[]) => active.useState(args[0]), useRef: (...args: any[]) => active.useRef(args[0]),
    useCallback: (...args: any[]) => active.useCallback(args[0], args[1]), useEffect: (...args: any[]) => active.useEffect(args[0], args[1]),
    load: async (...args: any[]) => { calls.push(['read', args.at(-1)]); args[3]?.(eligibility); return snapshot; },
    eligible: async () => eligibility, AuthError,
    target: async (_user: string, identity: any) => {
      calls.push(['target', identity]); const scope = await mock.eligible();
      if (!scope.eligibleSpaces.some((s: any) => s.id === identity.spaceId)) return { status: 'ineligible' };
      const date = snapshot.dates.find((d) => d.space_id === identity.spaceId && d.id === identity.importantDateId);
      return date ? { status: 'ready', date, space: scope.eligibleSpaces.find((s: any) => s.id === identity.spaceId) } : { status: 'missing' };
    },
    create: async (...args: any[]) => { calls.push(['create', ...args]); return row; },
    update: async (...args: any[]) => { calls.push(['update', ...args]); return row; },
    remove: async (...args: any[]) => { calls.push(['delete', ...args]); },
    auth: () => undefined,
    supabase: { auth: { onAuthStateChange(fn: any) { mock.auth = fn; return { data: { subscription: { unsubscribe() {} } } }; } } },
  };
  (globalThis as any).__importantDateHandoffTest = mock;
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{ name: 'handoff-runtime', enforce: 'pre',
      resolveId(id, importer) {
        if (id === 'react' && importer?.includes('/components/')) return '\0handoff-hooks';
        if (/\/important-dates-data(?:\.ts)?$/.test(id)) return '\0handoff-data';
        if (/\/supabase(?:\.ts)?$/.test(id)) return '\0handoff-client';
      },
      load(id) {
        if (id === '\0handoff-hooks') return 'const m=globalThis.__importantDateHandoffTest; export const {useState,useRef,useCallback,useEffect}=m;';
        if (id === '\0handoff-data') return 'const m=globalThis.__importantDateHandoffTest; export const loadImportantDates=async(...args)=>{const d=await m.load(...args);args[3]?.(d);return d},readImportantDateTarget=(...args)=>m.target(...args),loadImportantDatesEligibility=(...args)=>m.eligible(...args),ImportantDatesAuthError=m.AuthError,createImportantDate=m.create,updateImportantDate=m.update,deleteImportantDate=m.remove;';
        if (id === '\0handoff-client') return 'export const supabase=globalThis.__importantDateHandoffTest.supabase;';
      },
    }] } as any);
  try {
    const controller = (await vite.ssrLoadModule('/src/components/useImportantDateHandoff.ts')).useImportantDateHandoff;
    const Page = (await vite.ssrLoadModule('/src/components/ImportantDatesPage.tsx')).ImportantDatesPage;
    const Sheet = (await vite.ssrLoadModule('/src/components/ImportantDateSheet.tsx')).ImportantDateSheet;
    const props: any = { userId: 'me', handoff: target(), returnTo: 'home', onHubBack() {}, onNoEligible() { calls.push(['no-eligible']); },
      onHandoffHandled(id: number) { calls.push(['handled', id]); if (props.handoff?.requestId === id) props.handoff = null; } };
    const render = () => { active = pageHooks; active.reset(); const child = Page(props); return child.type(child.props); };
    const pump = async () => { let tree: any; for (let i = 0; i < 6; i++) { tree = render(); pageHooks.flush(); await new Promise((resolve) => setImmediate(resolve)); } return render(); };
    const renderController = (user = 'me') => { active = controllerHooks; active.reset(); return controller(user, () => calls.push(['navigate'])); };
    const sheet = (tree: any) => elements(tree).find((item) => item.type?.name === 'ImportantDateSheet');
    const renderSheet = (value: any) => { active = sheetHooks; active.reset(); return Sheet(value); };
    const navigation = await vite.ssrLoadModule('/src/lib/navigation.ts');
    const hub = await vite.ssrLoadModule('/src/components/ModuleHub.tsx');
    await run({ props, calls, mock, render, pump, sheet, renderController, renderSheet, navigation, hub, flush: () => pageHooks.flush(), replay: () => pageHooks.replay(), stop: () => pageHooks.stop() });
  } finally {
    pageHooks.stop(); controllerHooks.stop(); sheetHooks.stop(); await vite.close();
    delete (globalThis as any).__importantDateHandoffTest;
    (globalThis as any).window = previousWindow; (globalThis as any).document = previousDocument;
  }
}

test('in-memory handler strips source objects, assigns distinct generations, consumes only current target and scopes to user', () => runtime(async (env) => {
  let controller = env.renderController();
  controller.open({ ...target(), date: row }); controller = env.renderController();
  assert.deepEqual(Object.keys(controller.pending).sort(), ['importantDateId', 'requestId', 'returnTo', 'spaceId']);
  const first = controller.pending.requestId;
  controller.open(target(1, 'calendar', 'date-b', personal.id)); controller = env.renderController();
  assert.ok(controller.pending.requestId > first); controller.consume(first);
  assert.equal(env.renderController().pending.importantDateId, 'date-b');
  controller.consume(controller.pending.requestId); controller = env.renderController();
  assert.equal(controller.pending, null); assert.equal(controller.returnTo, 'calendar');
  assert.equal(env.renderController('other').returnTo, null);
  assert.equal(env.renderController().returnTo, null); // A→B→A user changes cannot restore old origin.
  assert.throws(() => env.renderController().open({ ...target(), returnTo: 'event' }));
  env.renderController().reset(); assert.equal(env.renderController().pending, null);
}));

test('Home/Calendar handoff opens exact canonical Sheet after fresh read, never a retained or colliding snapshot', () => runtime(async (env) => {
  for (const origin of ['home', 'calendar']) {
    env.props.handoff = target(origin === 'home' ? 1 : 2, origin, 'date-b', personal.id);
    env.props.returnTo = origin; env.props.entry = eligibility; env.props.initialData = { ...snapshot, dates: [{ ...row, name: 'stale snapshot' }] };
    assert.equal(env.sheet(env.render()), undefined);
    const tree = await env.pump(); const sheet = env.sheet(tree);
    assert.equal(sheet.props.date, snapshot.dates[1]);
    assert.equal(sheet.props.date.reminder_kind, 'all_day_previous_day_20');
    assert.ok(env.calls.filter((call: any) => call[0] === 'read').every((call: any) => call[1] === undefined));
    const form = env.renderSheet(sheet.props);
    assert.equal(elements(form).find((item) => item.props.id === 'important-date-reminder').props.value, 'all_day_previous_day_20');
    sheet.props.onCancel(); await env.pump(); assert.equal(env.sheet(env.render()), undefined);
  }
}));

test('confirmed missing is handled once, keeps valid list usable and never opens another object', () => runtime(async (env) => {
  env.props.handoff = target(1, 'home', 'deleted');
  const tree = await env.pump(); assert.equal(env.sheet(tree), undefined);
  assert.ok(elements(tree).some((item) => item.props.role === 'status' && String(item.props.children).includes('已删除')));
  assert.equal(elements(tree).find((item) => item.props['aria-label'] === '新建重要日').props.disabled, false);
  await env.pump(); assert.equal(env.calls.filter((call: any) => call[0] === 'handled').length, 1);
}));

test('matching ID in the wrong eligible Space never opens that object', () => runtime(async (env) => {
  env.props.handoff = target(1, 'calendar', row.id, personal.id);
  const tree = await env.pump();
  assert.equal(env.sheet(tree), undefined);
  assert.ok(elements(tree).some((item) => item.props.role === 'status' && String(item.props.children).includes('已删除')));
  assert.equal(env.calls.filter((call: any) => call[0] === 'handled').length, 1);
}));

test('target failure is not deletion; exact identity retries independently of list success', () => runtime(async (env) => {
  const read = env.mock.target; env.mock.target = async () => { throw new Error('offline'); };
  let tree = await env.pump(); assert.equal(env.sheet(tree), undefined);
  assert.equal(env.calls.filter((c: any) => c[0] === 'handled').length, 0);
  env.mock.target = read;
  elements(elements(tree).find((el) => el.props.role === 'alert')).find((el) => el.type === 'button').props.onClick();
  tree = await env.pump(); assert.equal(env.sheet(tree).props.date, row);
}));

test('disabled/removed/lost membership never falls back; no eligible Space follows existing Hub boundary', () => runtime(async (env) => {
  for (const [index, mode] of ['disabled', 'membership', 'removed', 'all-disabled'].entries()) {
    env.props.handoff = target(index + 1);
    const spaces = mode === 'all-disabled' ? [] : [personal];
    const data = { memberSpaces: mode === 'disabled' ? [space, personal] : spaces, eligibleSpaces: spaces, dates: snapshot.dates.filter((date) => spaces.some((item) => item.id === date.space_id)) };
    env.mock.load = async () => data; env.mock.eligible = async () => data;
    const tree = await env.pump(); assert.equal(env.sheet(tree), undefined);
    if (spaces.length) assert.ok(elements(tree).some((item) => item.props.role === 'status' && String(item.props.children).includes('空间')));
    else assert.ok(env.calls.some((call: any) => call[0] === 'no-eligible'));
  }
}));

test('eligibility-query failure retains exact identity and retry opens only its canonical target', () => runtime(async (env) => {
  env.props.handoff = target(1, 'calendar', 'date-b', personal.id);
  const identity = { ...env.props.handoff };
  env.mock.eligible = async () => { throw new Error('eligibility offline'); };
  let tree = await env.pump();
  assert.equal(env.sheet(tree), undefined);
  assert.ok(elements(tree).some((item) => item.props.role === 'alert'));
  assert.deepEqual(env.props.handoff, identity);
  env.mock.eligible = async () => eligibility;
  elements(elements(tree).find((item) => item.props.role === 'alert')).find((item) => item.type === 'button').props.onClick();
  tree = await env.pump(); assert.equal(env.sheet(tree).props.date, snapshot.dates[1]);
  assert.equal(env.props.handoff, null);
}));

test('confirmed post-source target-Space loss consumes once and rereads the remaining canonical module without fallback', () => runtime(async (env) => {
  for (const [index, mode] of ['disabled', 'membership'].entries()) {
    env.props.handoff = target(index + 1);
    const remaining = { memberSpaces: mode === 'disabled' ? [space, personal] : [personal], eligibleSpaces: [personal] };
    const canonical = { ...snapshot.dates[1], name: 'fresh remaining list' };
    let reads = 0;
    env.mock.load = async (...args: any[]) => {
      reads++;
      const data = reads === 1 ? snapshot : { ...remaining, dates: [canonical] };
      args[3]?.(data); return data;
    };
    env.mock.eligible = async () => remaining;
    const tree = await env.pump();
    assert.equal(env.props.handoff, null); assert.equal(env.sheet(tree), undefined);
    assert.equal(reads, 2);
    assert.equal(elements(tree).find((item) => item.props['aria-label'] === '新建重要日').props.disabled, false);
    assert.equal(elements(tree).filter((item) => item.props.role === 'alert').length, 0);
    assert.ok(elements(tree).some((item) => item.props.role === 'status' && String(item.props.children).includes('不可访问')));
    const content = elements(tree).find((item) => item.type?.name === 'ImportantDatesContent');
    assert.deepEqual(content.props.data.dates, [canonical]);
    assert.equal(env.calls.filter((call: any) => call[0] === 'handled' && call[1] === index + 1).length, 1);
  }
}));

test('confirmed zero eligibility consumes and exits even before target read completes', () => runtime(async (env) => {
  const pending = deferred(); env.mock.target = () => pending.promise;
  env.mock.load = async (...args: any[]) => { args[3]?.({ memberSpaces: [], eligibleSpaces: [] }); return { memberSpaces: [], eligibleSpaces: [], dates: [] }; };
  const tree = await env.pump(); assert.equal(env.props.handoff, null); assert.equal(env.sheet(tree), undefined);
  assert.equal(env.calls.filter((c: any) => c[0] === 'no-eligible').length, 1);
  pending.resolve({ status: 'ready', date: row, space }); await env.pump(); assert.equal(env.sheet(env.render()), undefined);
}));

test('confirmed pre-source loss consumes even when the remaining list read fails; list retry cannot reopen the target', () => runtime(async (env) => {
  const remaining = { memberSpaces: [personal], eligibleSpaces: [personal] };
  env.mock.load = async (...args: any[]) => { args[3]?.(remaining); throw new Error('remaining list offline'); };
  let tree = await env.pump();
  assert.equal(env.props.handoff, null); assert.equal(env.sheet(tree), undefined);
  assert.ok(elements(tree).some((item) => item.props.role === 'alert'));
  env.mock.load = async () => ({ ...remaining, dates: [snapshot.dates[1]] }); env.mock.eligible = async () => remaining;
  elements(elements(tree).find((item) => item.props.role === 'alert')).find((item) => item.type === 'button').props.onClick();
  tree = await env.pump(); assert.equal(env.sheet(tree), undefined);
  assert.equal(elements(tree).find((item) => item.props['aria-label'] === '新建重要日').props.disabled, false);
}));

test('confirmed pre-source zero eligibility clears target and exits even if the remaining read fails', () => runtime(async (env) => {
  env.mock.load = async (...args: any[]) => { args[3]?.({ memberSpaces: [], eligibleSpaces: [] }); throw new Error('later read failure'); };
  const tree = await env.pump();
  assert.equal(env.props.handoff, null); assert.equal(env.sheet(tree), undefined);
  assert.equal(env.calls.filter((call: any) => call[0] === 'no-eligible').length, 1);
}));

test('target loss recovery is bounded to one module reread even when recovery fails', () => runtime(async (env) => {
  let reads = 0; env.mock.load = async () => { if (++reads === 1) return snapshot; throw new Error('recovery failed'); };
  env.mock.target = async () => ({ status: 'ineligible' });
  const tree = await env.pump(); assert.equal(env.props.handoff, null); assert.equal(env.sheet(tree), undefined);
  assert.equal(reads, 2); assert.ok(elements(tree).some((el) => el.props.role === 'alert'));
  await env.pump(); assert.equal(reads, 2); assert.equal(env.calls.filter((c: any) => c[0] === 'handled').length, 1);
}));

test('unrelated module scope drift does not replace or block the exact qualified target', () => runtime(async (env) => {
  const scope = { memberSpaces: [space], eligibleSpaces: [space] };
  env.mock.eligible = async () => scope;
  env.mock.load = async () => ({ ...scope, dates: [] });
  const tree = await env.pump(); assert.equal(env.sheet(tree).props.date, row); assert.equal(env.props.handoff, null);
}));

for (const latest of ['B', 'A2']) test(`late A1 target loss cannot consume current ${latest} generation`, () => runtime(async (env) => {
  const old = deferred(), b = deferred(), a2 = deferred(); const replies = [old,b,a2]; let calls = 0;
  env.mock.target = () => replies[calls++].promise;
  await env.pump(); env.props.handoff = target(2,'calendar','date-b',personal.id); await env.pump();
  if (latest === 'A2') { env.props.handoff = target(3); await env.pump(); }
  old.resolve({ status: 'ineligible' }); await env.pump();
  assert.equal(env.props.handoff.requestId,latest === 'B' ? 2 : 3); assert.equal(env.calls.filter((c: any) => c[0] === 'handled').length,0);
  (latest === 'B' ? b : a2).resolve({ status: 'ready', date: latest === 'B' ? snapshot.dates[1] : row, space: latest === 'B' ? personal : space });
  const tree = await env.pump(); assert.equal(env.sheet(tree).props.date, latest === 'B' ? snapshot.dates[1] : row);
}));

test('rapid A→B ignores late A target and list reads and opens only B', () => runtime(async (env) => {
  const a = deferred(), b = deferred(), listA = deferred(); let reads = 0;
  env.mock.target = () => reads++ === 0 ? a.promise : b.promise;
  env.mock.load = () => listA.promise;
  await env.pump(); env.props.handoff = target(2,'calendar','date-b',personal.id); await env.pump();
  b.resolve({ status: 'ready', date: snapshot.dates[1], space: personal }); let tree = await env.pump();
  assert.equal(env.sheet(tree).props.date.id,'date-b');
  a.resolve({ status: 'ready', date: row, space }); listA.resolve(snapshot); tree = await env.pump();
  assert.equal(env.sheet(tree).props.date.id,'date-b');
}));

test('A1→B→A2 target and background list generations cannot be overwritten by A1 last', () => runtime(async (env) => {
  const replies = [deferred(),deferred(),deferred()], lists = [deferred(),deferred(),deferred()]; let reads = 0, listReads = 0;
  env.mock.target = () => replies[reads++].promise; env.mock.load = () => lists[listReads++].promise;
  await env.pump(); env.props.handoff = target(2,'calendar','date-b',personal.id); await env.pump();
  env.props.handoff = target(3); await env.pump(); const newest = { ...row, name: 'canonical A2' };
  replies[2].resolve({ status: 'ready', date: newest, space }); lists[2].resolve({ ...snapshot,dates:[newest] });
  let tree = await env.pump(); assert.equal(env.sheet(tree).props.date,newest);
  replies[1].resolve({ status: 'ready',date:snapshot.dates[1],space:personal }); replies[0].resolve({ status: 'ready',date:row,space });
  lists[1].resolve(snapshot); lists[0].resolve({ ...snapshot, dates:[] }); tree = await env.pump();
  assert.equal(env.sheet(tree).props.date,newest); assert.equal(reads,3);
  assert.equal(elements(tree).find((el) => el.type?.name === 'ImportantDatesContent').props.data.dates[0],newest);
}));

test('consumed Sheet saves/deletes through existing CRUD and does not reopen after close, refresh or rerender', () => runtime(async (env) => {
  let tree = await env.pump(); const canonical = env.sheet(tree).props.date;
  await env.sheet(tree).props.onSubmit({ ...canonical, reminder_kind: null }, canonical.space_id);
  tree = await env.pump(); assert.equal(env.sheet(tree), undefined);
  const update = env.calls.find((call: any) => call[0] === 'update'); assert.equal(update[3], canonical); assert.equal(update[4].reminder_kind, null);
  env.props.handoff = target(2); tree = await env.pump(); env.sheet(tree).props.onDelete();
  tree = await env.pump(); assert.equal(env.calls.filter((call: any) => call[0] === 'delete').length, 0);
  elements(tree).find((item) => item.type?.name === 'ImportantDateDeleteDialog').props.onConfirm();
  tree = await env.pump(); assert.equal(env.calls.filter((call: any) => call[0] === 'delete').length, 1); assert.equal(env.sheet(tree), undefined);
  await env.pump(); assert.equal(env.sheet(env.render()), undefined);
}));

test('fresh exact target opens with unknown or initial-pending entry, without starting the gated module list', () => runtime(async (env) => {
  let requestId = 1;
  for (const entry of [undefined, null, eligibility]) {
    env.props.handoff = target(++requestId);
    env.props.entry = entry; env.props.entryPending = true;
    const tree = await env.pump();
    assert.equal(env.sheet(tree).props.date, row); assert.equal(env.sheet(tree).props.canAct, true);
    assert.equal(env.calls.filter((call: any) => call[0] === 'read').length, 0);
    env.sheet(tree).props.onCancel(); await env.pump();
  }
}));

test('unrelated Review availability remains pending while the exact target starts and opens an actionable Sheet', () => runtime(async (env) => {
  const review = deferred(); let hubDone = false;
  const availability = env.hub.resolveHubEligibility(async () => eligibility, () => review.promise,
    async () => eligibility, async () => eligibility).then(() => { hubDone = true; });
  env.props.entry = null; env.props.entryPending = true;
  const tree = await env.pump();
  assert.equal(hubDone, false); assert.equal(env.calls.filter((c: any) => c[0] === 'target').length, 1);
  assert.equal(env.sheet(tree).props.date, row); assert.equal(env.sheet(tree).props.canAct, true);
  assert.equal(env.calls.filter((c: any) => c[0] === 'read').length, 0);
  review.resolve([space]); await availability; env.props.entryPending = false; env.props.entry = eligibility;
  assert.equal(env.sheet(await env.pump()).props.date, row);
  assert.equal(env.calls.filter((c: any) => c[0] === 'target').length, 1);
}));

test('stable→refreshing→stable keeps one in-flight exact target and permits publication during refresh', () => runtime(async (env) => {
  const exact = deferred(); let starts = 0;
  env.props.entry = eligibility; env.mock.load = () => new Promise(() => {});
  env.mock.target = () => { starts++; return exact.promise; };
  await env.pump(); assert.equal(starts, 1);
  env.props.entry = null; env.props.entryPending = true; await env.pump();
  exact.resolve({ status: 'ready', date: row, space });
  let tree = await env.pump(); assert.equal(env.sheet(tree).props.date, row); assert.equal(env.sheet(tree).props.canAct, true);
  env.props.entry = eligibility; env.props.entryPending = false; tree = await env.pump();
  assert.equal(env.sheet(tree).props.date, row); assert.equal(starts, 1);
}));

test('first confirmed valid scope does not restart an unknown-entry read; first confirmed loss invalidates it', () => runtime(async (env) => {
  const first = deferred(), late = deferred(); let starts = 0;
  env.props.entry = null; env.props.entryPending = true; env.mock.load = () => new Promise(() => {});
  env.mock.target = () => (++starts === 1 ? first : late).promise;
  await env.pump(); env.props.entry = eligibility; env.props.entryPending = false; await env.pump();
  assert.equal(starts, 1); first.resolve({ status: 'ready', date: row, space });
  let tree = await env.pump(); assert.equal(env.sheet(tree).props.date, row); env.sheet(tree).props.onCancel();
  env.props.handoff = target(2); env.props.entry = null; env.props.entryPending = true; await env.pump();
  env.props.entry = { memberSpaces: [personal], eligibleSpaces: [personal] }; env.props.entryPending = false;
  await env.pump(); assert.equal(env.props.handoff, null);
  late.resolve({ status: 'ready', date: row, space }); assert.equal(env.sheet(await env.pump()), undefined);
}));

test('confirmed Space, membership or module loss consumes the target and rejects the late exact reply', () => runtime(async (env) => {
  for (const loss of ['space', 'membership', 'module']) {
    const exact = deferred(); env.props.entry = eligibility; env.props.entryPending = false;
    env.props.handoff = target(['space', 'membership', 'module'].indexOf(loss) + 1);
    env.mock.load = () => new Promise(() => {}); env.mock.target = () => exact.promise;
    await env.pump(); env.props.entryPending = true; env.props.entry = null; await env.pump();
    env.props.entryPending = false;
    env.props.entry = { memberSpaces: loss === 'module' ? eligibility.memberSpaces : [personal], eligibleSpaces: [personal] };
    await env.pump(); assert.equal(env.props.handoff, null);
    exact.resolve({ status: 'ready', date: row, space });
    assert.equal(env.sheet(await env.pump()), undefined);
  }
  assert.equal(env.calls.filter((c: any) => c[0] === 'handled').length, 3);
  assert.equal(env.calls.filter((c: any) => c[0] === 'no-eligible').length, 0);
}));

test('already confirmed zero eligible scope consumes before starting target read and uses the existing safe exit', () => runtime(async (env) => {
  env.props.entry = { memberSpaces: eligibility.memberSpaces, eligibleSpaces: [] };
  env.mock.load = () => new Promise(() => {});
  assert.equal(env.sheet(await env.pump()), undefined);
  assert.equal(env.calls.filter((c: any) => c[0] === 'target').length, 0);
  assert.equal(env.calls.filter((c: any) => c[0] === 'handled').length, 1);
  assert.equal(env.calls.filter((c: any) => c[0] === 'no-eligible').length, 1);
}));

test('confirmed target role change rejects the old reply; unrelated Space role change does not restart it', () => runtime(async (env) => {
  const old = deferred(), fresh = deferred(); let starts = 0;
  env.props.entry = eligibility; env.mock.load = () => new Promise(() => {});
  env.mock.target = () => (++starts === 1 ? old : fresh).promise;
  await env.pump();
  const otherRole = { ...personal, membershipRole: 'member' };
  env.props.entry = { memberSpaces: [space, otherRole], eligibleSpaces: [space, otherRole] };
  await env.pump(); assert.equal(starts, 1);
  const newRole = { ...space, membershipRole: 'owner' };
  env.props.entry = { memberSpaces: [newRole, otherRole], eligibleSpaces: [newRole, otherRole] };
  await env.pump(); assert.equal(starts, 2);
  old.resolve({ status: 'ready', date: { ...row, name: 'old role' }, space });
  assert.equal(env.sheet(await env.pump()), undefined); assert.ok(env.props.handoff);
  fresh.resolve({ status: 'ready', date: row, space: newRole });
  assert.equal(env.sheet(await env.pump()).props.date, row);
}));

test('StrictMode setup→cleanup→setup starts one actual target read; cleanup before microtask starts none', () => runtime(async (env) => {
  env.props.entry = null; env.props.entryPending = true;
  env.render(); env.flush(); env.replay();
  assert.equal(env.calls.filter((c: any) => c[0] === 'target').length, 0);
  assert.equal(env.sheet(await env.pump()).props.date, row);
  assert.equal(env.calls.filter((c: any) => c[0] === 'target').length, 1);
  env.props.handoff = target(2); env.render(); env.flush(); env.stop();
  await new Promise((r) => setImmediate(r));
  assert.equal(env.calls.filter((c: any) => c[0] === 'target').length, 1);
}));

test('queued A1→B→A2 only starts A2 and consumes its current identity once', () => runtime(async (env) => {
  env.props.entry = null; env.props.entryPending = true;
  env.render(); env.flush();
  env.props.handoff = target(2, 'calendar', 'date-b', personal.id); env.render(); env.flush();
  env.props.handoff = target(3); env.render(); env.flush();
  assert.equal(env.calls.filter((c: any) => c[0] === 'target').length, 0);
  assert.equal(env.sheet(await env.pump()).props.date, row);
  assert.equal(env.calls.filter((c: any) => c[0] === 'target').length, 1);
  assert.deepEqual(env.calls.filter((c: any) => c[0] === 'handled'), [['handled', 3]]);
}));

test('refreshing keeps qualified save/delete gates usable without reopening after canonical mutations', () => runtime(async (env) => {
  env.props.entry = eligibility; let tree = await env.pump();
  env.props.entry = null; env.props.entryPending = true; tree = await env.pump();
  await env.sheet(tree).props.onSubmit({ ...row, name: '保存', reminder_kind: null }, row.space_id);
  assert.equal(env.sheet(await env.pump()), undefined);
  env.props.handoff = target(2); tree = await env.pump(); env.sheet(tree).props.onDelete(); tree = await env.pump();
  const dialog = elements(tree).find((el) => el.type?.name === 'ImportantDateDeleteDialog');
  assert.equal(dialog.props.canAct, true); dialog.props.onConfirm(); await env.pump();
  assert.equal(env.calls.filter((c: any) => c[0] === 'update').length, 1);
  assert.equal(env.calls.filter((c: any) => c[0] === 'delete').length, 1);
  assert.equal(env.sheet(env.render()), undefined);
}));

test('late save from the previous target cannot refresh or disturb a new handoff even before effect cleanup', () => runtime(async (env) => {
  const tree = await env.pump(); const saved = deferred(); env.mock.update = () => saved.promise;
  const saving = env.sheet(tree).props.onSubmit(row, row.space_id);
  const readCount = env.calls.filter((call: any) => call[0] === 'read').length;
  env.props.handoff = target(2, 'calendar', 'date-b', personal.id); env.render();
  saved.resolve(row); await saving;
  assert.equal(env.calls.filter((call: any) => call[0] === 'read').length, readCount);
  assert.equal(env.sheet(await env.pump()).props.date, snapshot.dates[1]);
}));

test('switching target during delete clears the old confirmation busy state and ignores its late completion', () => runtime(async (env) => {
  let tree = await env.pump(); const removed = deferred(); env.mock.remove = () => removed.promise;
  env.sheet(tree).props.onDelete(); tree = await env.pump();
  elements(tree).find((item) => item.type?.name === 'ImportantDateDeleteDialog').props.onConfirm();
  env.props.handoff = target(2, 'calendar', 'date-b', personal.id); tree = await env.pump();
  removed.resolve(undefined); await new Promise((resolve) => setImmediate(resolve));
  env.sheet(tree).props.onDelete(); tree = await env.pump();
  const dialog = elements(tree).find((item) => item.type?.name === 'ImportantDateDeleteDialog');
  assert.equal(dialog.props.date, snapshot.dates[1]); assert.equal(dialog.props.busy, false);
}));

test('source return labels use the existing back callback and eligibility loss closes an already-open Sheet', () => runtime(async (env) => {
  let returns = 0; env.props.onHubBack = () => returns++;
  env.props.returnTo = 'calendar'; let tree = await env.pump();
  const back = elements(tree).find((item) => item.type === 'button' && React.Children.toArray(item.props.children).includes('返回日历'));
  back.props.onClick(); assert.equal(returns, 1);
  env.mock.load = async () => ({ memberSpaces: [personal], eligibleSpaces: [personal], dates: [snapshot.dates[1]] });
  env.mock.eligible = async () => ({ memberSpaces: [personal], eligibleSpaces: [personal] });
  env.props.eligibilityRevision = 1; tree = await env.pump();
  assert.equal(env.sheet(tree), undefined);
  assert.ok(elements(tree).some((item) => item.props.role === 'status' && String(item.props.children).includes('不可访问')));
}));

test('auth loss and unmount invalidate outstanding canonical replies', () => runtime(async (env) => {
  const pending = deferred(); env.mock.target = () => pending.promise;
  await env.pump(); env.mock.auth('SIGNED_OUT', null); pending.resolve({ status: 'ready', date: row, space });
  let tree = await env.pump(); assert.equal(env.sheet(tree), undefined);
  assert.ok(elements(tree).some((item) => item.props.role === 'alert' && String(item.props.children).includes('登录状态已变化')));
  env.props.handoff = target(2); const late = deferred(); env.mock.target = () => late.promise;
  await env.pump(); env.stop(); late.resolve({ status: 'ready', date: row, space }); tree = env.render();
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(env.sheet(env.render()), undefined);
}));

test('session restore remains page-only and production handoff cannot enter Event editor or persistence', () => runtime(async (env) => {
  const state = { tab: 'modules', moduleScreen: 'important-dates' } as const;
  assert.deepEqual(env.navigation.navigationTargetForState(state, 'profile', null, null, null), { page: 'important-dates' });
  assert.deepEqual(env.navigation.parseNavigationTarget(JSON.stringify({ page: 'important-dates', ...target(), date: row })), { page: 'important-dates' });
  const hook = readFileSync(new URL('../src/components/useImportantDateHandoff.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(hook, /EventEditTarget|EventSheet|\.rpc\(|\.channel\(|localStorage|sessionStorage/);
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /useImportantDateHandoff\(userId/);
  assert.match(app, /handoff=\{importantDateHandoff.pending\}/);
  assert.match(app, /onHandoffHandled=\{importantDateHandoff.consume\}/);
  assert.match(app, /onNoEligible=\{\(\) => \{ importantDateHandoff.reset\(\)/);
}));

test('background list failure cannot block or replace the exact target editor and target saving stays canonical', () => runtime(async (env) => {
  env.mock.load = async () => { throw new Error('list offline'); };
  const tree = await env.pump(); assert.equal(env.sheet(tree).props.date,row); assert.equal(env.sheet(tree).props.canAct,true);
  await env.sheet(tree).props.onSubmit({ ...row,name:'修改' },row.space_id); assert.equal(env.sheet(await env.pump()),undefined);
  assert.equal(env.calls.filter((c: any) => c[0] === 'update').length,1);
}));

test('target ready with list pending can delete through the existing canonical mutation path', () => runtime(async (env) => {
  const list = deferred(); env.mock.load = () => list.promise;
  let tree = await env.pump(); env.sheet(tree).props.onDelete(); tree = await env.pump();
  const dialog = elements(tree).find((el) => el.type?.name === 'ImportantDateDeleteDialog'); assert.equal(dialog.props.canAct,true);
  dialog.props.onConfirm(); await env.pump(); assert.equal(env.calls.filter((c: any) => c[0] === 'delete').length,1);
  list.resolve(snapshot); await env.pump(); assert.equal(env.sheet(env.render()),undefined);
}));

test('background list started before target opening still closes it on later confirmed eligibility loss', () => runtime(async (env) => {
  const list = deferred(); env.mock.load = () => list.promise;
  let tree = await env.pump(); assert.equal(env.sheet(tree).props.date, row);
  list.resolve({ memberSpaces: [personal], eligibleSpaces: [personal], dates: [snapshot.dates[1]] });
  tree = await env.pump(); assert.equal(env.sheet(tree), undefined);
  assert.equal(env.calls.filter((c: any) => c[0] === 'handled').length, 1);
  assert.ok(elements(tree).some((el) => el.props.role === 'status' && String(el.props.children).includes('不可访问')));
}));

test('confirmed list loss between target publication and React render cancels the queued editor', () => runtime(async (env) => {
  const exact = deferred(), list = deferred();
  env.mock.target = () => exact.promise; env.mock.load = () => list.promise;
  env.render(); env.flush(); await Promise.resolve();
  exact.resolve({ status: 'ready', date: row, space });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(env.calls.filter((c: any) => c[0] === 'handled').length, 1);
  list.resolve({ memberSpaces: [personal], eligibleSpaces: [personal], dates: [snapshot.dates[1]] });
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(env.sheet(env.render()), undefined);
  assert.equal(env.calls.filter((c: any) => c[0] === 'handled').length, 1);
}));

test('unknown in-flight module entry does not clear an already qualified editor; confirmed loss does', () => runtime(async (env) => {
  env.props.entry = eligibility; let tree = await env.pump(); assert.equal(env.sheet(tree).props.canAct,true);
  env.props.entryPending = true; env.props.entry = null; tree = await env.pump(); assert.equal(env.sheet(tree).props.date,row); assert.equal(env.sheet(tree).props.canAct,true);
  env.props.entryPending = false; env.props.entry = eligibility; tree = await env.pump(); assert.equal(env.sheet(tree).props.canAct,true);
  env.props.entry = { memberSpaces:[personal],eligibleSpaces:[personal] }; tree = await env.pump(); assert.equal(env.sheet(tree),undefined);
}));

test('background auth transport failure does not block exact target retry; real sign-out still closes it', () => runtime(async (env) => {
  env.mock.load = async () => { throw new env.mock.AuthError('登录读取暂不可用'); };
  const original = env.mock.target; env.mock.target = async () => { throw new env.mock.AuthError('登录读取暂不可用'); };
  let tree = await env.pump(); assert.equal(env.sheet(tree),undefined); assert.ok(env.props.handoff);
  env.mock.target = original;
  const targetAlert = elements(tree).filter((el) => el.props.role === 'alert')[0];
  elements(targetAlert).find((el) => el.type === 'button').props.onClick(); tree = await env.pump();
  assert.equal(env.sheet(tree).props.canAct,true);
  env.mock.auth('SIGNED_OUT',null); tree = await env.pump(); assert.equal(env.sheet(tree),undefined);
}));
