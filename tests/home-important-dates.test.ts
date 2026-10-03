import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';

const personal = { id: 'personal', name: 'Personal internal name', kind: 'personal', created_by: 'me', membershipRole: 'owner' };
const shared = { ...personal, id: 'shared', name: '我们的空间', kind: 'shared', membershipRole: 'member' };
const spaces = [personal, shared];
const row = (id: string, space_id = shared.id, fields = {}) => ({ id, space_id, name: '同名', emoji: '❤️', repeat_kind: 'annual', year: null, month: 2, day: 29,
  reminder_kind: 'all_day_previous_day_20', time_zone: 'Asia/Shanghai', ...fields });
const tick = () => new Promise((resolve) => setTimeout(resolve, 2));
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise((yes) => { resolve = yes; }); return { resolve, promise }; };
const elements = (node: any): any[] => React.isValidElement(node) ? [node, ...React.Children.toArray((node.props as any).children).flatMap(elements)] : [];
const section = (tree: any) => elements(tree).find((el) => el.type === 'section' && el.props['aria-label'] === '重要日');
const items = (tree: any) => elements(section(tree)).filter((el) => el.type === 'li');
const sheet = (tree: any) => elements(tree).find((el) => el.type?.name === 'ImportantDateSheet');
const text = (node: any): string => React.isValidElement(node) ? React.Children.toArray((node.props as any).children).map(text).join('') : typeof node === 'string' ? node : '';
const button = (tree: any, label: string) => elements(tree).find((el) => el.type === 'button' && (el.props['aria-label'] === label || text(el) === label));

// Execute real App/Home/section/T1/T2/Page handlers. Only network, account
// bootstrap and unrelated module availability boundaries are injected.
async function runtime(run: (env: any) => Promise<void>) {
  const previous = { window: (globalThis as any).window, document: (globalThis as any).document, Date };
  let now = new Date(2027, 1, 27, 12); let active: any; const mounts = new Map<string, any>();
  const listeners = new Map<string, Set<any>>(); const auth = new Set<any>(); const timers = new Set<any>(); const calls: any[] = [];
  const store = new Map(); const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
  const surface = { visibilityState: 'visible', localStorage: storage, sessionStorage: storage,
    addEventListener(key: string, fn: any) { if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key)!.add(fn); },
    removeEventListener(key: string, fn: any) { listeners.get(key)?.delete(fn); } };
  const m: any = { rows: [row('b', personal.id), row('a'), row('c', shared.id, { name: '第三条', month: 3, day: 1 }), row('d', personal.id, { name: '第四条', month: 3, day: 2 })],
    eligible: spaces, members: spaces, homeFailure: false, eventFailure: false, taskFailure: false, timer: (fn: any) => { timers.add(fn); return fn; }, clearTimer: (fn: any) => timers.delete(fn),
    useState(initial: any) { const i = active.cursor++; if (!(i in active.slots)) active.slots[i] = typeof initial === 'function' ? initial() : initial;
      const mount = active; return [mount.slots[i], (value: any) => { mount.slots[i] = typeof value === 'function' ? value(mount.slots[i]) : value; }]; },
    useRef(value: any) { return active.slots[active.cursor++] ??= { current: value }; },
    useCallback(fn: any, deps: any[]) { const i = active.cursor++; if (!active.slots[i] || deps.some((v, n) => v !== active.slots[i].deps[n])) active.slots[i] = { fn, deps }; return active.slots[i].fn; },
    useMemo(fn: any, deps: any[]) { const i = active.cursor++; if (!active.slots[i] || deps.some((v, n) => v !== active.slots[i].deps[n])) active.slots[i] = { value: fn(), deps }; return active.slots[i].value; },
    useEffect(fn: any, deps: any[]) { const i = active.cursor++; if (!active.slots[i] || deps.some((v, n) => v !== active.slots[i][n])) { active.slots[i] = deps; active.effects.push({ i, fn }); } },
    async home(userId: string, today: any, _client: any, _page: any, publish: any) {
      calls.push(['home', userId, today]); const scope = { memberSpaces: m.members, eligibleSpaces: m.eligible }; publish?.(scope);
      if (m.homeFailure) throw new Error('offline');
      return { ...scope, dates: m.rows.filter((r: any) => m.eligible.some((s: any) => s.id === r.space_id)) };
    },
    async canonical(...args: any[]) { calls.push(['canonical']); args[3]?.({ memberSpaces: m.members, eligibleSpaces: m.eligible });
      return { memberSpaces: m.members, eligibleSpaces: m.eligible, dates: m.rows.filter((r: any) => m.eligible.some((s: any) => s.id === r.space_id)) }; },
    async update(_client: any, _user: any, date: any, draft: any) { calls.push(['update', date.space_id, date.id]); m.rows = m.rows.map((r: any) => r.id === date.id && r.space_id === date.space_id ? { ...r, ...draft } : r); },
    async remove(_client: any, _user: any, date: any) { calls.push(['delete', date.space_id, date.id]); m.rows = m.rows.filter((r: any) => r.id !== date.id || r.space_id !== date.space_id); },
    async events() { if (m.eventFailure) throw new Error('日程测试失败');
      const source = { id: 'event', space_id: shared.id, scope: 'shared', recurrence_rule: null };
      return { occurrences: [{ title: '日程成功内容', source_event: source, occurrence_id: 'event', occurrence_starts_at: now.toISOString(), all_day: true }], membersBySpaceId: {} }; },
    async tasks() { if (m.taskFailure) throw new Error('任务测试失败'); return { tasks: [{ id: 'task', title: '任务成功内容', space_id: shared.id, assigned_to_user_id: null, due_on: null }], enabledSpaceIds: [shared.id], membersBySpaceId: {} }; },
  };
  m.supabase = { auth: { onAuthStateChange(fn: any) { auth.add(fn); return { data: { subscription: { unsubscribe: () => auth.delete(fn) } } }; } },
    from(table: string) { assert.equal(table, 'space_modules'); const query: any = { select: () => query, in: () => query, eq: () => query, order: () => query,
      range: async () => ({ data: [{ space_id: shared.id, enabled: true }], count: 1, error: null }) }; return query; },
    channel(name: string) { calls.push(['channel', name]); const channel: any = { on: () => channel, subscribe: (fn: any) => { fn('SUBSCRIBED'); return channel; } }; return channel; }, removeChannel() {},
    rpc() { throw new Error('No RPC/network allowed in fixture'); } };
  (globalThis as any).__homeImportantDates = m;
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] }, ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{
    name: 'home-important-date-fixture', enforce: 'pre',
    resolveId(id, importer) {
      if (id === 'react' && (importer?.includes('/components/') || importer?.endsWith('/App.tsx'))) return '\0home-hooks';
      if (/\/important-dates-data(?:\.ts)?$/.test(id)) return '\0home-dates';
      if (/\/supabase(?:\.ts)?$/.test(id)) return '\0home-client';
      if (/\/current-spaces(?:\.ts)?$/.test(id)) return '\0home-spaces';
      if (importer?.endsWith('/App.tsx') && id.endsWith('/space-selection')) return '\0home-bootstrap';
      if (importer?.endsWith('/App.tsx') && id.endsWith('/ModuleHub')) return '\0home-availability';
      if (importer?.endsWith('/App.tsx') && id.endsWith('/push-notifications')) return '\0home-push';
    },
    load(id) {
      const prefix = 'const m=globalThis.__homeImportantDates;';
      if (id === '\0home-hooks') return prefix + 'export const {useState,useRef,useCallback,useEffect,useMemo}=m;';
      if (id === '\0home-client') return prefix + 'export const supabase=m.supabase,isSupabaseConfigured=true;';
      if (id === '\0home-spaces') return prefix + 'export const listCurrentSpaces=async()=>m.members;';
      if (id === '\0home-dates') return prefix + 'export class ImportantDatesAuthError extends Error{};export const loadHomeImportantDates=(...a)=>m.home(...a),loadCalendarImportantDates=()=>{throw Error("T4 not started")},loadImportantDates=(...a)=>m.canonical(...a),loadImportantDatesEligibility=async()=>({memberSpaces:m.members,eligibleSpaces:m.eligible}),updateImportantDate=(...a)=>m.update(...a),deleteImportantDate=(...a)=>m.remove(...a),createImportantDate=()=>{throw Error("not used")};';
      if (id === '\0home-bootstrap') return prefix + 'export const bootstrapSpaces=async()=>({spaces:m.members,selectedSpaceId:"personal"}),chooseSelectedSpaceId=(s,id)=>s.find(x=>x.id===id)?.id??s[0]?.id,ensureOnceUntilFailure=f=>f,writeSelectedSpaceId=()=>{},clearSelectedSpaceId=()=>{};';
      if (id === '\0home-availability') return prefix + 'export const ModuleHub=()=>null,useModuleAvailability=()=>({availability:{tasksIds:["shared"],reviewIds:[],listsIds:[],importantDatesIds:m.eligible.map(s=>s.id)},refreshing:false,refresh:async()=>{},invalidate:()=>{}});';
      if (id === '\0home-push') return 'export const registerPushServiceWorker=async()=>{};';
    },
    transform(code, id) {
      if (id.endsWith('/App.tsx')) return code + '\nexport { CalendarApp as HomeTestApp };';
      if (id.endsWith('/HomeImportantDatesSection.tsx')) return code.replace(/setTimeout\(/g, 'globalThis.__homeImportantDates.timer(').replace(/clearTimeout\(/g, 'globalThis.__homeImportantDates.clearTimer(');
      if (id.endsWith('/home-aggregation.ts')) return code.replace('export async function readHomeEvents(', 'async function originalReadHomeEvents(').replace('export async function readHomeTasks(', 'async function originalReadHomeTasks(')
        + '\nexport const readHomeEvents=(...a)=>globalThis.__homeImportantDates.events(...a),readHomeTasks=(...a)=>globalThis.__homeImportantDates.tasks(...a);';
    },
  }] } as any);
  const stop = (mount: any) => { for (const fn of mount.cleanups.values()) fn(); };
  const execute = (key: string, fn: any, props: any) => {
    if (!mounts.has(key)) mounts.set(key, { slots: [], cleanups: new Map(), effects: [], cursor: 0 });
    active = mounts.get(key); active.cursor = 0; return fn(props);
  };
  try {
    const App = (await vite.ssrLoadModule('/src/App.tsx')).HomeTestApp;
    const Section = (await vite.ssrLoadModule('/src/components/HomeImportantDatesSection.tsx')).HomeImportantDatesSection;
    (globalThis as any).window = surface; (globalThis as any).document = surface;
    (globalThis as any).Date = new Proxy(previous.Date, { construct(target, args) { return Reflect.construct(target, args.length ? args : [now.getTime()]); } });
    const expanded = new Set(['HomePage', 'HomeSection', 'HomeImportantDatesSection', 'ImportantDatesPage', 'ImportantDatesModule', 'BottomNavigation']);
    let app = false; let props: any = { userId: 'me', spaces, entry: { memberSpaces: spaces, eligibleSpaces: spaces }, onViewAll() {}, onOpen() {} };
    const render = () => {
      const visited = new Set<string>();
      const expand = (node: any, path: string): any => {
        if (!React.isValidElement(node)) return node;
        if (typeof node.type === 'function' && expanded.has(node.type.name)) { const key = path + ':' + node.type.name + ':' + (node.key ?? ''); visited.add(key); return expand(execute(key, node.type, node.props), key); }
        const children = React.Children.toArray((node.props as any).children).map((child, i) => expand(child, path + ':' + i));
        return React.cloneElement(node, undefined, ...children);
      };
      visited.add('root'); const tree = expand(execute('root', app ? App : Section, app ? { session: { user: { id: 'me' } }, restoreOnStartup: false } : props), 'root');
      for (const [key, mount] of mounts) if (!visited.has(key)) { stop(mount); mounts.delete(key); }
      return tree;
    };
    const pump = async () => { let tree: any; for (let n = 0; n < 7; n++) { tree = render(); for (const mount of mounts.values()) for (const { i, fn } of mount.effects.splice(0)) { mount.cleanups.get(i)?.(); const cleanup = fn(); if (cleanup) mount.cleanups.set(i, cleanup); else mount.cleanups.delete(i); } await tick(); } return render(); };
    const dispatch = (key: string) => { for (const fn of [...listeners.get(key) ?? []]) fn(); };
    await run({ m, calls, props, render, pump, dispatch, surface, timers, auth, listenerCount: () => [...listeners.values()].reduce((count, set) => count + set.size, 0), app: () => { app = true; for (const mount of mounts.values()) stop(mount); mounts.clear(); }, now: (value: Date) => { now = value; }, unmount: () => { for (const mount of mounts.values()) stop(mount); mounts.clear(); } });
  } finally {
    for (const mount of mounts.values()) stop(mount); await vite.close(); delete (globalThis as any).__homeImportantDates;
    (globalThis as any).window = previous.window; (globalThis as any).document = previous.document; (globalThis as any).Date = previous.Date;
  }
}

test('Home renders 0/1/3/>3 from T1 global ranking with canonical presentation, stable ties and Space sources', () => runtime(async (e) => {
  assert.match(renderToStaticMarkup(e.render()), /正在读取/);
  for (const count of [0, 1, 3, 4]) {
    e.m.rows = Array.from({ length: count }, (_, n) => row(String(n), n % 2 ? personal.id : shared.id)); e.dispatch('focus');
    const tree = await e.pump(); assert.equal(items(tree).length, Math.min(count, 3));
    if (!count) assert.match(renderToStaticMarkup(tree), /暂无重要日/);
    else assert.deepEqual(items(tree).map((el) => el.props['data-important-date-id']), ['0', '1', '2'].slice(0, count));
  }
  e.m.rows = [row('past', shared.id, { repeat_kind: 'none', year: 2020 }), row('future', personal.id, { year: 2030, month: 9, day: 30 }), row('leap'), row('once', personal.id, { repeat_kind: 'none', year: 2027, month: 2, day: 28 })];
  e.dispatch('focus'); const tree = await e.pump(); const html = renderToStaticMarkup(tree);
  assert.deepEqual(items(tree).map((el) => el.props['data-important-date-id']), ['leap', 'once', 'future']);
  assert.match(html, /还有 1 天/); assert.match(html, /我的空间/); assert.match(html, /我们的空间/); assert.doesNotMatch(html, /Personal internal name|展开更多/);
  assert.match(text(items(tree)[2]), /还有 1311 天/); // True 2030 anchor, not this year's month/day.
  e.m.rows = [row('old-annual', shared.id, { year: 2020, month: 2, day: 28 })]; e.dispatch('focus');
  assert.match(renderToStaticMarkup(await e.pump()), /第 2557 天.*距 7 周年还有 1 天/);
  e.now(new Date(2027, 1, 28)); for (const fn of [...e.timers]) fn();
  assert.match(renderToStaticMarkup(await e.pump()), /7 周年/);
}));

test('eligibility governs hiding vs confirmed empty and module disable/re-enable/membership loss', () => runtime(async (e) => {
  await e.pump();
  e.m.eligible = [personal]; e.props.entry = { memberSpaces: spaces, eligibleSpaces: [personal] };
  let tree = await e.pump(); assert.deepEqual(items(tree).map((el) => el.props['data-space-id']), ['personal', 'personal']);
  e.m.eligible = []; e.props.entry = { memberSpaces: spaces, eligibleSpaces: [] };
  assert.equal(section(await e.pump()), undefined);
  e.m.eligible = [shared]; e.props.entry = { memberSpaces: spaces, eligibleSpaces: [shared] };
  assert.equal(items(await e.pump()).length, 2);
  const reads = e.calls.length; const newRole = { ...shared, membershipRole: 'owner' };
  e.m.members = [personal, newRole]; e.m.eligible = [newRole]; e.props.spaces = e.m.members; e.props.entry = { memberSpaces: e.m.members, eligibleSpaces: e.m.eligible };
  await e.pump(); assert.ok(e.calls.length > reads);
  e.m.members = []; e.m.eligible = []; e.props.spaces = []; e.props.entry = { memberSpaces: [], eligibleSpaces: [] };
  assert.equal(section(await e.pump()), undefined);
}));

test('Important Date error is distinct from empty, retries independently and isolates all three Home sections', () => runtime(async (e) => {
  e.app(); e.m.homeFailure = true;
  let tree = await e.pump(); let html = renderToStaticMarkup(tree);
  assert.match(html, /重要日暂时无法加载/); assert.match(html, /日程成功内容/); assert.match(html, /任务成功内容/); assert.doesNotMatch(renderToStaticMarkup(section(tree)), /暂无重要日/);
  e.m.homeFailure = false; button(section(tree), '重试').props.onClick(); tree = await e.pump(); assert.equal(items(tree).length, 3);
  e.unmount(); e.m.eventFailure = true; tree = await e.pump(); html = renderToStaticMarkup(tree);
  assert.match(html, /日程测试失败/); assert.equal(items(tree).length, 3); assert.match(html, /任务成功内容/);
  e.unmount(); e.m.eventFailure = false; e.m.taskFailure = true; tree = await e.pump(); html = renderToStaticMarkup(tree);
  assert.match(html, /任务测试失败/); assert.equal(items(tree).length, 3); assert.match(html, /日程成功内容/);
  assert.ok(e.calls.filter((c: any) => c[0] === 'channel').every((c: any) => /^home-(events|tasks):/.test(c[1])));
}));

test('focus/visible/online/retry/midnight refresh and auth/scope/unmount suppress late replies', () => runtime(async (e) => {
  await e.pump();
  for (const name of ['focus', 'online', 'visibilitychange']) { const before = e.calls.length; e.dispatch(name); await e.pump(); assert.ok(e.calls.length > before); }
  e.surface.visibilityState = 'hidden'; const before = e.calls.length; e.dispatch('visibilitychange'); await e.pump(); assert.equal(e.calls.length, before); e.surface.visibilityState = 'visible';
  e.now(new Date(2027, 1, 28, 0, 0)); for (const fn of [...e.timers]) fn(); let tree = await e.pump(); assert.match(renderToStaticMarkup(tree), /就是今天/);
  e.now(new Date(2027, 2, 1)); e.dispatch('focus'); tree = await e.pump(); assert.match(text(items(tree).find((el) => el.props['data-important-date-id'] === 'a')), /还有 365 天/);
  const late = deferred(); e.m.home = () => late.promise; e.dispatch('focus'); await tick();
  e.props.userId = 'other'; e.props.entry = { memberSpaces: [], eligibleSpaces: [] }; e.m.home = async () => ({ memberSpaces: [], eligibleSpaces: [], dates: [] });
  assert.doesNotMatch(renderToStaticMarkup(e.render()), /同名/); await e.pump(); late.resolve({ memberSpaces: spaces, eligibleSpaces: spaces, dates: [row('old')] }); await e.pump(); assert.equal(section(e.render()), undefined);
  e.unmount(); assert.equal(e.timers.size, 0); assert.ok([...e.auth].length === 0);
}));

test('real App view-all/title opens canonical module without Sheet; item opens exact canonical own object and returns home', () => runtime(async (e) => {
  e.app(); let tree = await e.pump();
  for (const label of ['查看全部重要日', '进入重要日']) {
    button(section(tree), label).props.onClick(); tree = await e.pump(); assert.equal(sheet(tree), undefined);
    assert.ok(button(tree, '新建重要日')); button(tree, '首页').props.onClick(); tree = await e.pump(); assert.equal(items(tree).length, 3);
  }
  const clicked = items(tree).find((el) => el.props['data-important-date-id'] === 'b');
  e.m.rows = e.m.rows.map((r: any) => r.id === 'b' ? { ...r, name: 'fresh canonical name' } : r);
  button(clicked, '打开重要日 同名').props.onClick(); tree = await e.pump();
  assert.equal(sheet(tree).props.date, e.m.rows.find((r: any) => r.id === 'b')); assert.equal(sheet(tree).props.date.space_id, personal.id);
  assert.equal(sheet(tree).props.date.name, 'fresh canonical name');
  assert.equal(sheet(tree).props.date.reminder_kind, 'all_day_previous_day_20'); assert.ok(button(tree, '返回首页'));
  sheet(tree).props.onCancel(); tree = await e.pump(); assert.equal(sheet(tree), undefined);
  const reads = e.calls.filter((c: any) => c[0] === 'home').length; button(tree, '返回首页').props.onClick(); tree = await e.pump();
  assert.equal(items(tree).length, 3); assert.ok(e.calls.filter((c: any) => c[0] === 'home').length > reads); assert.equal(sheet(tree), undefined);
}));

test('unknown eligibility failure stays an error and auth loss discards an outstanding successful projection', () => runtime(async (e) => {
  const loader = e.m.home; e.m.home = async () => { throw new Error('qualification offline'); };
  let tree = await e.pump(); assert.match(renderToStaticMarkup(tree), /重要日暂时无法加载/); assert.doesNotMatch(renderToStaticMarkup(tree), /暂无重要日/);
  e.m.home = loader; button(tree, '重试').props.onClick(); tree = await e.pump(); assert.equal(items(tree).length, 3);
  const late = deferred(); e.m.home = () => late.promise; e.dispatch('focus');
  for (const fn of e.auth) fn('SIGNED_OUT', null);
  late.resolve({ memberSpaces: spaces, eligibleSpaces: spaces, dates: [row('stale')] });
  tree = await e.pump(); assert.equal(items(tree).length, 0); assert.match(renderToStaticMarkup(tree), /重要日暂时无法加载/);
}));

test('rapid scope A1→B→A2 preserves the latest projection even if A1 returns last; unmount cleans lifecycle', () => runtime(async (e) => {
  await e.pump(); const a1 = deferred(); const b = deferred(); const a2 = deferred(); const replies = [a1, b, a2]; let reads = 0;
  e.m.home = () => replies[reads++].promise; e.dispatch('focus'); await e.pump();
  e.props.entry = { memberSpaces: spaces, eligibleSpaces: [] }; await e.pump();
  e.props.entry = { memberSpaces: spaces, eligibleSpaces: spaces }; await e.pump();
  a2.resolve({ memberSpaces: spaces, eligibleSpaces: spaces, dates: [row('latest', shared.id, { name: 'A2 latest' })] }); await e.pump();
  b.resolve({ memberSpaces: spaces, eligibleSpaces: [], dates: [] }); a1.resolve({ memberSpaces: spaces, eligibleSpaces: spaces, dates: [row('stale')] });
  assert.equal(reads, 3); const tree = await e.pump(); assert.deepEqual(items(tree).map((el) => el.props['data-important-date-id']), ['latest']);
  const unmounted = deferred(); e.m.home = () => unmounted.promise; e.dispatch('focus'); e.unmount(); unmounted.resolve({ memberSpaces: spaces, eligibleSpaces: spaces, dates: [row('stale')] }); await tick();
  assert.equal(e.timers.size, 0); assert.equal(e.auth.size, 0); assert.equal(e.listenerCount(), 0);
}));

test('save/delete through existing canonical handlers updates Home on return and fills the vacant top-three slot', () => runtime(async (e) => {
  e.app(); let tree = await e.pump();
  button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump();
  await sheet(tree).props.onSubmit({ ...sheet(tree).props.date, name: '已修改', month: 2, day: 27 }, shared.id); tree = await e.pump(); assert.equal(sheet(tree), undefined);
  button(tree, '返回首页').props.onClick(); tree = await e.pump(); assert.match(renderToStaticMarkup(section(tree)), /已修改.*就是今天/);
  button(items(tree)[0], '打开重要日 已修改').props.onClick(); tree = await e.pump(); sheet(tree).props.onDelete(); tree = await e.pump();
  const dialog = elements(tree).find((el) => el.type?.name === 'ImportantDateDeleteDialog'); await dialog.props.onConfirm(); tree = await e.pump();
  button(tree, '返回首页').props.onClick(); tree = await e.pump();
  assert.deepEqual(items(tree).map((el) => el.props['data-important-date-id']), ['b', 'c', 'd']); assert.equal(sheet(tree), undefined);
}));

test('deleted projection target is confirmed missing by canonical reread rather than opening a colliding object', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); const first = items(tree)[0]; e.m.rows = e.m.rows.filter((r: any) => r.id !== 'a');
  button(first, '打开重要日 同名').props.onClick(); tree = await e.pump();
  assert.equal(sheet(tree), undefined); assert.ok(elements(tree).some((el) => el.props.role === 'status' && String(el.props.children).includes('已删除')));
}));

test('Home section reuses projection and identity-only handoff without editing, database subscriptions or persistence', () => {
  const source = readFileSync(new URL('../src/components/HomeImportantDatesSection.tsx', import.meta.url), 'utf8');
  assert.match(source, /useImportantDateProjection/); assert.doesNotMatch(source, /\.sort\(|resolveImportantDateOccurrence|\.rpc\(|\.channel\(|localStorage|sessionStorage|EventSheet|ImportantDateSheet/);
});
