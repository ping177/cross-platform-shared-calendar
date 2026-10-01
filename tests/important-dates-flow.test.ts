import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { createServer } from 'vite';

// Small injected hook runtime: exercises the real hook/component handlers without
// installing a DOM package or touching any authenticated backend/browser session.
function hooks() {
  let cursor = 0;
  const slots: any[] = [];
  const effects: Array<() => void | (() => void)> = [];
  return {
    reset() { cursor = 0; }, effects,
    useState(initial: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value: any) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(value: any) { const index = cursor++; return slots[index] ??= { current: value }; },
    useCallback(fn: any, deps: any[]) {
      const index = cursor++;
      if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) slots[index] = { fn, deps };
      return slots[index].fn;
    },
    useEffect(fn: any, deps: any[]) {
      const index = cursor++;
      if (!slots[index] || deps.some((dep, i) => dep !== slots[index][i])) { slots[index] = deps; effects.push(fn); }
    },
  };
}
function elements(node: any): any[] {
  return React.isValidElement(node) ? [node, ...React.Children.toArray((node.props as any).children).flatMap(elements)] : [];
}
function deferred() {
  let resolve!: (value: any) => void;
  let reject!: (value: any) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const space = { id: 'shared', name: '共同', kind: 'shared', membershipRole: 'member', created_by: 'other' };
const row = { id: 'date-a', space_id: space.id, name: '生日', emoji: null, repeat_kind: 'annual', year: null, month: 2, day: 29 };
const snapshot = { memberSpaces: [space], eligibleSpaces: [space], dates: [row] };

async function runtime(run: (env: any) => Promise<void>) {
  const hook = hooks();
  const calls: any[] = [];
  class AuthError extends Error {}
  let loader: any = async () => snapshot;
  const mock: any = { ...hook, AuthError, create: async (...args: any[]) => { calls.push(['create', ...args]); return row; }, update: async (...args: any[]) => { calls.push(['update', ...args]); return row; }, remove: async (...args: any[]) => { calls.push(['delete', ...args]); return undefined; }, load: (...args: any[]) => loader(...args),
    auth: (_event: any, _session: any) => undefined,
    supabase: { from: () => mock.moduleQuery, rpc: (...args: any[]) => mock.moduleRpc(...args), auth: { onAuthStateChange(fn: any) { mock.auth = fn; return { data: { subscription: { unsubscribe() {} } } }; } } } };
  mock.moduleQuery = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { enabled: false }, error: null }) };
  mock.moduleRpc = async (...args: any[]) => { calls.push(['toggle', ...args]); return { error: null }; };
  (globalThis as any).__importantDatesTest = mock;
  const vite = await createServer({ configFile: false, logLevel: 'silent', ssr: { noExternal: [/^react$/], external: ['react/jsx-dev-runtime', 'react/jsx-runtime'] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{
    name: 'important-date-injected-runtime', enforce: 'pre',
    resolveId(id, importer) {
      if (id === 'react' && importer?.includes('/components/')) return '\0important-date-hooks';
      if (id.endsWith('/important-dates-data') || id.endsWith('/important-dates-data.ts')) return '\0important-date-data';
      if (id.endsWith('/supabase') || id.endsWith('/supabase.ts')) return '\0important-date-client';
    },
    load(id) {
      if (id === '\0important-date-hooks') return 'const m=globalThis.__importantDatesTest; export const {useState,useRef,useCallback,useEffect}=m;';
      if (id === '\0important-date-data') return 'const m=globalThis.__importantDatesTest; export const loadImportantDates=m.load,ImportantDatesAuthError=m.AuthError,createImportantDate=m.create,updateImportantDate=m.update,deleteImportantDate=m.remove;';
      if (id === '\0important-date-client') return 'export const supabase=globalThis.__importantDatesTest.supabase;';
    },
  }] });
  try {
    const use = (await vite.ssrLoadModule('/src/components/useImportantDates.ts')).useImportantDates;
    const sheets = await vite.ssrLoadModule('/src/components/ImportantDateSheet.tsx');
    const Sheet = sheets.ImportantDateSheet;
    const useToggle = (await vite.ssrLoadModule('/src/components/useSpaceImportantDatesModule.ts')).useSpaceImportantDatesModule;
    const renderToggle = (target = space) => { hook.reset(); return useToggle(target); };
    const Page = (await vite.ssrLoadModule('/src/components/ImportantDatesPage.tsx')).ImportantDatesPage;
    const renderHook = (options?: any) => { hook.reset(); return use('me', () => calls.push('no-eligible'), 0, options); };
    const renderSheet = (props: any) => { hook.reset(); return Sheet(props); };
    const renderPage = () => { hook.reset(); const child = Page({ userId: 'me', onHubBack() {}, onNoEligible() {} }); return child.type(child.props); };
    const renderDelete = (props: any) => { hook.reset(); return sheets.ImportantDateDeleteDialog(props); };
    await run({ hook, calls, mock, renderHook, renderSheet, renderPage, renderDelete, renderToggle, setLoader: (fn: any) => { loader = fn; } });
  } finally { await vite.close(); delete (globalThis as any).__importantDatesTest; }
}

test('Important Dates real request guard ignores older refresh, invalidation and unmount replies', () => runtime(async (env) => {
  const first = deferred(); const second = deferred();
  let index = 0;
  env.setLoader(() => index++ === 0 ? first.promise : second.promise);
  let view = env.renderHook();
  const older = view.refresh(); const newer = view.refresh();
  second.resolve(snapshot); await newer;
  first.resolve({ ...snapshot, dates: [{ ...row, id: 'stale' }] }); await older;
  view = env.renderHook(); assert.equal(view.state.data.dates[0].id, row.id);
  const late = deferred(); env.setLoader(() => late.promise);
  const pending = view.refresh(); view.invalidate(); late.resolve(snapshot); await pending;
  assert.equal(env.renderHook().state.data, null);
  const last = deferred(); env.setLoader(() => last.promise);
  const promise = env.renderHook().refresh();
  // First effect is the real mount/read effect; use its cleanup to model unmount.
  const cleanup = env.hook.effects[0](); cleanup();
  last.resolve(snapshot); await promise;
  assert.equal(env.renderHook().state.data, null);
}));

test('Important Dates read errors retain known rows; confirmed eligibility loss clears affected rows before source failure', () => runtime(async (env) => {
  await env.renderHook().refresh();
  env.setLoader(async () => { throw new Error('offline'); });
  await env.renderHook().refresh();
  assert.equal(env.renderHook().state.data.dates.length, 1);
  assert.equal(env.renderHook().canAct, false);
  env.setLoader(async (_user: any, _client: any, _spaces: any, publish: any) => {
    publish({ memberSpaces: [], eligibleSpaces: [] }); throw new Error('offline after eligibility');
  });
  await env.renderHook().refresh();
  assert.deepEqual(env.renderHook().state.data.dates, []);
  assert.equal(env.calls.length, 0); // Read failure is not a confirmed empty success.
  env.setLoader(async () => ({ memberSpaces: [], eligibleSpaces: [], dates: [] }));
  await env.renderHook().refresh();
  assert.deepEqual(env.calls, ['no-eligible']);
  env.setLoader(async () => { throw new env.mock.AuthError('登录已变化'); });
  await env.renderHook().refresh();
  assert.equal(env.renderHook().state.data, null);
  assert.equal(env.renderHook().state.authLost, true);
}));

test('Important Date Sheet keeps target through filter/eligibility changes and submits only explicit selection', () => runtime(async (env) => {
  const submitted: any[] = [];
  const props = { memberSpaces: [space, { ...space, id: 'personal', kind: 'personal' }], eligibleSpaces: [space], initialTargetId: space.id, canAct: true,
    onSubmit: async (draft: any, id: string) => submitted.push([draft, id]), onCancel() {}, onDelete() {} };
  let tree = env.renderSheet(props);
  const input = (id: string, value: string) => elements(tree).find((item) => item.props.id === id || item.props['aria-label'] === id).props.onChange({ target: { value } });
  input('important-date-name', '生日'); input('月', '2'); input('日', '29');
  tree = env.renderSheet({ ...props, initialTargetId: 'personal' });
  assert.equal(elements(tree).find((item) => item.props.id === 'important-date-space').props.value, space.id);
  tree = env.renderSheet({ ...props, eligibleSpaces: [] });
  assert.equal(elements(tree).find((item) => item.props.type === 'submit').props.disabled, true);
  await elements(tree).find((item) => item.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(submitted.length, 0);
  tree = env.renderSheet({ ...props, eligibleSpaces: props.memberSpaces });
  input('important-date-space', 'personal');
  tree = env.renderSheet({ ...props, eligibleSpaces: props.memberSpaces });
  await elements(tree).find((item) => item.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(submitted[0][1], 'personal');
  assert.equal(submitted[0][0].year, null);
}));

test('Important Date Sheet validates before submit and locks duplicate pending saves', () => runtime(async (env) => {
  let count = 0; const saving = deferred();
  const props = { date: row, memberSpaces: [space], eligibleSpaces: [space], canAct: true, onSubmit: async () => { count++; await saving.promise; }, onCancel() {}, onDelete() {} };
  let tree = env.renderSheet(props);
  const day = elements(tree).find((item) => item.props['aria-label'] === '日'); day.props.onChange({ target: { value: '30' } });
  tree = env.renderSheet(props);
  await elements(tree).find((item) => item.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(count, 0);
  elements(tree).find((item) => item.props['aria-label'] === '日').props.onChange({ target: { value: '29' } });
  tree = env.renderSheet(props);
  const submit = elements(tree).find((item) => item.type === 'form').props.onSubmit;
  submit({ preventDefault() {} }); submit({ preventDefault() {} });
  assert.equal(count, 1);
  saving.resolve(undefined);
}));

test('Important Dates page edit invokes canonical update then rereads; delete opens confirmation before RPC', () => runtime(async (env) => {
  let reads = 0;
  env.setLoader(async () => { reads++; return snapshot; });
  let tree = env.renderPage();
  env.hook.effects[0]();
  await new Promise((resolve) => setTimeout(resolve, 0));
  tree = env.renderPage();
  const content = () => elements(tree).find((item) => item.type?.name === 'ImportantDatesContent');
  content().props.onOpen(row);
  tree = env.renderPage();
  let sheet = elements(tree).find((item) => item.type?.name === 'ImportantDateSheet');
  await sheet.props.onSubmit(row, space.id);
  assert.equal(env.calls[0][0], 'update');
  assert.equal(reads, 2);
  tree = env.renderPage(); content().props.onOpen(row);
  tree = env.renderPage();
  sheet = elements(tree).find((item) => item.type?.name === 'ImportantDateSheet');
  sheet.props.onDelete();
  tree = env.renderPage();
  assert.equal(env.calls.filter((call: any) => call[0] === 'delete').length, 0);
  const dialog = elements(tree).find((item) => item.type?.name === 'ImportantDateDeleteDialog');
  assert.equal(dialog.props.date.id, row.id);
  assert.equal(dialog.props.space.id, space.id);
  dialog.props.onConfirm();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(env.calls.filter((call: any) => call[0] === 'delete').length, 1);
  assert.equal(reads, 3);
}));

test('Important Dates focus/reconnect/visibility and local midnight refresh; auth switch clears data and invalidates late read', () => runtime(async (env) => {
  const oldWindow = (globalThis as any).window;
  const oldDocument = (globalThis as any).document;
  const oldTimeout = globalThis.setTimeout;
  const oldClear = globalThis.clearTimeout;
  const listeners = new Map<string, () => void>();
  let rollover!: () => void;
  let delay = 0;
  const surface = { addEventListener(key: string, fn: () => void) { listeners.set(key, fn); }, removeEventListener(key: string) { listeners.delete(key); }, visibilityState: 'visible' };
  (globalThis as any).window = surface;
  (globalThis as any).document = surface;
  (globalThis as any).setTimeout = (fn: () => void, ms: number) => { rollover = fn; delay = ms; return 1; };
  (globalThis as any).clearTimeout = () => undefined;
  const cleanup: Array<() => void> = [];
  try {
    let reads = 0;
    env.setLoader(async () => { reads++; return snapshot; });
    env.renderHook();
    for (const effect of env.hook.effects) { const stop = effect(); if (stop) cleanup.push(stop); }
    await Promise.resolve(); await Promise.resolve();
    assert.ok(delay > 0 && delay <= 25 * 60 * 60 * 1000);
    for (const name of ['focus', 'online', 'visibilitychange']) { listeners.get(name)!(); await Promise.resolve(); await Promise.resolve(); }
    rollover(); await Promise.resolve(); await Promise.resolve();
    assert.equal(reads, 5);
    const late = deferred(); env.setLoader(() => late.promise);
    const pending = env.renderHook().refresh();
    env.mock.auth('SIGNED_OUT', null);
    late.resolve(snapshot); await pending;
    assert.equal(env.renderHook().state.data, null);
    assert.equal(env.renderHook().state.authLost, true);
    for (const stop of cleanup) stop();
    assert.equal(listeners.size, 0);
  } finally {
    for (const stop of cleanup) stop();
    (globalThis as any).window = oldWindow; (globalThis as any).document = oldDocument;
    globalThis.setTimeout = oldTimeout; globalThis.clearTimeout = oldClear;
  }
}));


test('Important Dates entry hints only seed same-scope display; canonical reread grants actions and scope/error loss blocks', () => runtime(async (env) => {
  let invalidations = 0;
  const entry = { memberSpaces: [space], eligibleSpaces: [space] };
  const options = { entry, initialData: snapshot, initialFilter: { spaceId: space.id }, onInvalidateEligibility: () => invalidations++ };
  let view = env.renderHook(options);
  assert.equal(view.state.data.dates[0].id, row.id);
  assert.equal(view.filter.spaceId, space.id);
  assert.equal(view.canAct, false); // Hint is display only, not mutation authority.
  await view.refresh();
  assert.equal(env.renderHook(options).canAct, true);
  assert.equal(env.renderHook({ ...options, entry: null, entryPending: true }).canAct, false);
  assert.equal(env.renderHook({ ...options, entry: { ...entry, eligibleSpaces: [] } }).state.data, null);
  env.setLoader(async () => { throw new Error('offline'); });
  await env.renderHook(options).refresh();
  assert.equal(env.renderHook(options).canAct, false);
  assert.equal(env.renderHook(options).state.data.dates[0].id, row.id);
  env.setLoader(async () => snapshot);
  await env.renderHook({ ...options, entry: null }).refresh();
  assert.equal(invalidations, 1); // A successful module read asks Hub to resolve unknown hints.
  env.renderHook(options).invalidate();
  assert.equal(invalidations, 2);
  assert.equal(env.renderHook(options).state.data, null);
}));

test('Important Dates ordinary entry uses session scope for canonical read; foreground/retry refresh rediscovers eligibility', () => runtime(async (env) => {
  const entry = { memberSpaces: [space], eligibleSpaces: [space] };
  const reads: any[] = [];
  env.setLoader(async (...args: any[]) => { reads.push(args); return snapshot; });
  env.renderHook({ entry, initialData: snapshot });
  const cleanup = env.hook.effects[0]();
  await Promise.resolve();
  assert.deepEqual(reads[0][4], entry);
  await env.renderHook({ entry }).refresh();
  assert.equal(reads[1][4], undefined);
  cleanup();
}));

test('Important Dates source-confirmed disable/removal invalidates stale Hub scope and clears affected rows on read failure', () => runtime(async (env) => {
  let invalidations = 0;
  const options = { entry: { memberSpaces: [space], eligibleSpaces: [space] }, initialData: snapshot, onInvalidateEligibility: () => invalidations++ };
  env.setLoader(async (_user: any, _client: any, _spaces: any, publish: any) => {
    publish({ memberSpaces: [], eligibleSpaces: [] });
    throw new Error('source offline after revocation');
  });
  await env.renderHook(options).refresh();
  assert.equal(env.renderHook(options).state.data, null);
  assert.equal(env.renderHook(options).canAct, false);
  assert.equal(env.calls.length, 0);
  env.setLoader(async () => ({ ...snapshot, memberSpaces: [{ ...space, membershipRole: 'owner' }] }));
  await env.renderHook(options).refresh();
  assert.equal(invalidations, 1);
  assert.equal(env.renderHook(options).canAct, false);
}));


test('Important Dates owner toggle calls only frozen RPC, locks double submit and reads canonical state; member cannot toggle', () => runtime(async (env) => {
  let module = env.renderToggle();
  await module.retry();
  assert.equal(env.renderToggle().state, 'disabled');
  await env.renderToggle().toggle();
  assert.equal(env.calls.length, 0);
  const owner = { ...space, membershipRole: 'owner' };
  const pending = deferred();
  env.mock.moduleRpc = async (...args: any[]) => { env.calls.push(args); await pending.promise; return { error: null }; };
  module = env.renderToggle(owner);
  const first = module.toggle(); const duplicate = module.toggle();
  assert.equal(env.calls.length, 1);
  assert.deepEqual(env.calls[0], ['set_space_module_enabled', { p_space_id: space.id, p_module_key: 'important_dates', p_enabled: true }]);
  env.mock.moduleQuery.maybeSingle = async () => ({ data: { enabled: true }, error: null });
  pending.resolve(undefined);
  assert.equal(await first, 'enabled'); await duplicate;
  assert.equal(env.renderToggle(owner).state, 'enabled');
  assert.equal(env.renderToggle(owner).busy, false);
}));

test('Important Dates toggle denial retains known state; canonical read failure stays unknown and retryable', () => runtime(async (env) => {
  const owner = { ...space, membershipRole: 'owner' };
  await env.renderToggle(owner).retry();
  env.mock.moduleRpc = async () => ({ error: new Error('denied') });
  assert.equal(await env.renderToggle(owner).toggle(), undefined);
  assert.equal(env.renderToggle(owner).state, 'disabled');
  assert.match(env.renderToggle(owner).error, /切换失败/);
  env.mock.moduleRpc = async () => ({ error: null });
  env.mock.moduleQuery.maybeSingle = async () => ({ data: null, error: new Error('offline') });
  assert.equal(await env.renderToggle(owner).toggle(), undefined);
  assert.equal(env.renderToggle(owner).state, 'error');
  env.mock.moduleQuery.maybeSingle = async () => ({ data: null, error: null });
  await env.renderToggle(owner).retry();
  assert.equal(env.renderToggle(owner).state, 'disabled');
}));

test('Important Dates toggle unmount or Space change cannot publish an old canonical reply', () => runtime(async (env) => {
  const owner = { ...space, membershipRole: 'owner' };
  await env.renderToggle(owner).retry();
  const pending = deferred();
  env.mock.moduleRpc = async () => { await pending.promise; return { error: null }; };
  const old = env.renderToggle(owner).toggle();
  const cleanup = env.hook.effects[0](); cleanup();
  await env.renderToggle({ ...owner, id: 'different' }).retry();
  pending.resolve(undefined);
  assert.equal(await old, undefined);
  assert.equal(env.renderToggle({ ...owner, id: 'different' }).state, 'disabled');
  assert.equal(env.renderToggle({ ...owner, id: 'different' }).busy, false);
}));
