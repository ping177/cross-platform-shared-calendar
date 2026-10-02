import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const civil = (year: number, month: number, day: number) => ({ year, month, day });
const space = { id: 'shared', name: '共同', kind: 'shared', membershipRole: 'member' };
const date = { id: 'date', space_id: space.id, name: '生日', emoji: null, repeat_kind: 'annual', year: null, month: 2, day: 29 };
const snapshot = { memberSpaces: [space], eligibleSpaces: [space], dates: [date] };
const entry = { memberSpaces: [space], eligibleSpaces: [space] };
const home = { kind: 'home', today: civil(2027, 2, 27) };
const calendar = { kind: 'calendar', spaceIds: [space.id], range: { start: civil(2027, 2, 28), end: civil(2027, 2, 28) } };
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}

async function runtime(run: (env: any) => Promise<void>) {
  let cursor = 0; const slots: any[] = []; const effects: any[] = [];
  const mock: any = {
    load: async () => snapshot,
    authListener: () => undefined,
    useState(initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value: any) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(value: any) { const index = cursor++; return slots[index] ??= { current: value }; },
    useCallback(fn: any, deps: any[]) { const index = cursor++; if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) slots[index] = { fn, deps }; return slots[index].fn; },
    useEffect(fn: any, deps: any[]) { const index = cursor++; if (!slots[index] || deps.some((dep, i) => dep !== slots[index][i])) { slots[index] = deps; effects.push(fn); } },
  };
  class AuthError extends Error {}
  mock.AuthError = AuthError;
  mock.supabase = { auth: { onAuthStateChange(fn: any) { mock.authListener = fn; return { data: { subscription: { unsubscribe() {} } } }; } } };
  (globalThis as any).__importantDateProjectionTest = mock;
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', ssr: { noExternal: [/^react$/] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{
    name: 'important-date-projection-runtime', enforce: 'pre',
    resolveId(id, importer) {
      if (id === 'react' && importer?.endsWith('/useImportantDateProjection.ts')) return '\0projection-hooks';
      if (id.endsWith('/important-dates-data')) return '\0projection-data';
      if (id.endsWith('/supabase')) return '\0projection-client';
    },
    load(id) {
      if (id === '\0projection-hooks') return 'const m=globalThis.__importantDateProjectionTest; export const {useState,useRef,useCallback,useEffect}=m;';
      if (id === '\0projection-data') return 'const m=globalThis.__importantDateProjectionTest; export const ImportantDatesAuthError=m.AuthError,loadHomeImportantDates=(...args)=>m.load("home",...args),loadCalendarImportantDates=(...args)=>m.load("calendar",...args);';
      if (id === '\0projection-client') return 'export const supabase=globalThis.__importantDateProjectionTest.supabase;';
    },
  }] } as any);
  try {
    const use = (await vite.ssrLoadModule('/src/components/useImportantDateProjection.ts')).useImportantDateProjection;
    const render = (request: any = home, scope: any = entry, userId = 'me') => { cursor = 0; return use(userId, request, scope); };
    await run({ render, mock, effects, setLoader: (fn: any) => { mock.load = fn; } });
  } finally { await vite.close(); delete (globalThis as any).__importantDateProjectionTest; }
}

test('projection hook ignores older refreshes, invalidation and unmount replies', () => runtime(async (env) => {
  const first = deferred(); const second = deferred(); let index = 0;
  env.setLoader(() => index++ === 0 ? first.promise : second.promise);
  const view = env.render(); const older = view.refresh(); const newer = view.refresh();
  second.resolve(snapshot); await newer; first.resolve({ ...snapshot, dates: [{ ...date, id: 'stale' }] }); await older;
  assert.equal(env.render().state.view.items[0].importantDateId, date.id);
  const pending = deferred(); env.setLoader(() => pending.promise);
  const refresh = env.render().refresh(); env.render().invalidate(); pending.resolve(snapshot); await refresh;
  assert.equal(env.render().state.view, null);
  env.setLoader(async () => snapshot);
  const cleanup = env.effects[0](); cleanup(); await Promise.resolve(); await Promise.resolve();
  assert.equal(env.render().state.view, null);
}));

test('range/scope/user changes hide obsolete projections before effects and ignore their late responses', () => runtime(async (env) => {
  await env.render(calendar).refresh();
  const pending = deferred(); env.setLoader(() => pending.promise);
  const older = env.render(calendar).refresh();
  const next = { ...calendar, range: { start: civil(2028, 2, 29), end: civil(2028, 2, 29) } };
  assert.equal(env.render(next).state.view, null);
  env.setLoader(async () => snapshot); await env.render(next).refresh();
  pending.resolve({ ...snapshot, dates: [{ ...date, id: 'old' }] }); await older;
  assert.deepEqual(env.render(next).state.view.items[0].occurrenceDate, civil(2028, 2, 29));
  const changedScope = { ...entry, eligibleSpaces: [] };
  assert.equal(env.render(next, changedScope).state.view, null);
  assert.equal(env.render(next, entry, 'other').state.view, null);
  const otherFilter = { ...next, spaceIds: ['personal'] };
  assert.equal(env.render(otherFilter).state.view, null);
}));

test('rapid filter changes cannot publish stale sources and empty new scope is confirmed only after read success', () => runtime(async (env) => {
  const pending = deferred(); env.setLoader(() => pending.promise);
  const old = env.render(calendar).refresh();
  const filtered = { ...calendar, spaceIds: [] };
  let calls = 0;
  env.setLoader(async (kind: string, userId: string, ids: string[]) => {
    calls++; assert.equal(kind, 'calendar'); assert.equal(userId, 'me'); assert.deepEqual(ids, []);
    return { ...snapshot, dates: [] };
  });
  assert.equal(env.render(filtered).state.status, 'loading');
  await env.render(filtered).refresh();
  pending.resolve(snapshot); await old;
  assert.equal(calls, 1);
  assert.equal(env.render(filtered).state.status, 'success');
  assert.deepEqual(env.render(filtered).state.view.items, []);
}));

test('membership/module loss clears old data even when the subsequent source read fails; retry is explicit', () => runtime(async (env) => {
  await env.render().refresh();
  const later = deferred();
  env.setLoader(async (...args: any[]) => {
    args.at(-1)({ memberSpaces: [], eligibleSpaces: [] });
    await later.promise; throw new Error('offline');
  });
  const read = env.render().refresh();
  assert.equal(env.render().state.view, null);
  later.resolve(null); await read;
  assert.equal(env.render().state.status, 'error'); assert.ok(env.render().state.error);
  env.setLoader(async () => ({ memberSpaces: [], eligibleSpaces: [], dates: [] }));
  await env.render().refresh();
  assert.equal(env.render().state.status, 'success'); assert.deepEqual(env.render().state.view.items, []);
}));

test('failed eligibility/source reads never appear as empty success and recover through retry', () => runtime(async (env) => {
  env.setLoader(async () => { throw new Error('offline'); });
  await env.render().refresh();
  assert.equal(env.render().state.status, 'error'); assert.equal(env.render().state.view, null);
  env.setLoader(async () => snapshot); await env.render().refresh();
  assert.equal(env.render().state.status, 'success');
}));

test('A→B→A before effect cleanup still invalidates the first request and masks its old successful view', () => runtime(async (env) => {
  await env.render(calendar).refresh();
  const pending = deferred(); env.setLoader(() => pending.promise);
  const older = env.render(calendar).refresh();
  const next = { ...calendar, spaceIds: [] };
  env.render(next);
  assert.equal(env.render(calendar).state.view, null);
  pending.resolve(snapshot); await older;
  assert.equal(env.render(calendar).state.status, 'loading');
  env.setLoader(async () => snapshot); await env.render(calendar).refresh();
  assert.equal(env.render(calendar).state.status, 'success');
}));

test('A1→B→A2 keeps A2 when A1 returns last even though the final scope equals A', () => runtime(async (env) => {
  const a1 = deferred(); const b = deferred(); const a2 = deferred();
  const replies = [a1, b, a2]; let calls = 0;
  env.setLoader(() => replies[calls++].promise);
  const first = env.render(calendar).refresh();
  const other = env.render({ ...calendar, spaceIds: [] }).refresh();
  const newest = env.render(calendar).refresh();
  a2.resolve({ ...snapshot, dates: [{ ...date, id: 'a2' }] }); await newest;
  assert.equal(env.render(calendar).state.view.items[0].importantDateId, 'a2');
  b.resolve({ ...snapshot, dates: [] }); await other;
  a1.resolve({ ...snapshot, dates: [{ ...date, id: 'a1' }] }); await first;
  assert.equal(calls, 3);
  assert.equal(env.render(calendar).state.status, 'success');
  assert.equal(env.render(calendar).state.view.items[0].importantDateId, 'a2');
}));

test('focus/reconnect/visibility rereads and auth switch invalidates pending data without Realtime', () => runtime(async (env) => {
  const oldWindow = (globalThis as any).window; const oldDocument = (globalThis as any).document;
  const listeners = new Map<string, () => void>();
  const surface = { visibilityState: 'visible', addEventListener(key: string, fn: () => void) { listeners.set(key, fn); }, removeEventListener(key: string) { listeners.delete(key); } };
  (globalThis as any).window = surface; (globalThis as any).document = surface;
  const cleanups: Array<() => void> = [];
  try {
    let reads = 0; env.setLoader(async () => { reads++; return snapshot; }); env.render();
    for (const effect of env.effects) { const stop = effect(); if (stop) cleanups.push(stop); }
    await Promise.resolve(); await Promise.resolve();
    for (const name of ['focus', 'online', 'visibilitychange']) { listeners.get(name)!(); await Promise.resolve(); await Promise.resolve(); }
    assert.equal(reads, 4);
    const pending = deferred(); env.setLoader(() => pending.promise); const read = env.render().refresh();
    env.mock.authListener('SIGNED_OUT', null); pending.resolve(snapshot); await read;
    assert.equal(env.render().state.status, 'error'); assert.equal(env.render().state.view, null);
  } finally {
    for (const stop of cleanups) stop(); assert.equal(listeners.size, 0);
    (globalThis as any).window = oldWindow; (globalThis as any).document = oldDocument;
  }
}));

test('T1 production additions have no Event writes/RPC, occurrence persistence, navigation or Realtime channel', () => {
  for (const path of ['src/lib/important-date-projection.ts', 'src/components/useImportantDateProjection.ts']) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.rpc\(|\.channel\(|\.insert\(|\.update\(|\.delete\(|sessionStorage|localStorage|EventSheet|setNavigation/);
  }
  const source = readFileSync(new URL('../src/lib/important-dates-data.ts', import.meta.url), 'utf8');
  const added = source.slice(source.indexOf('// Numeric civil fields only;'), source.indexOf('function contentArgs('));
  assert.doesNotMatch(added, /\.rpc\(|\.channel\(|\.insert\(|\.update\(|\.delete\(|from\('events'\)/);
});
