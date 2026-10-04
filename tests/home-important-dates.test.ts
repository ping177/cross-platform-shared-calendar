import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { visibleHomeTasks } from '../src/lib/home-aggregation.ts';

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
    navigationCalls: 0, pageMounts: 0, eligible: spaces, members: spaces, homeFailure: false, eventFailure: false, taskFailure: false, taskIds: ['shared'], userId: 'me', timer: (fn: any) => { timers.add(fn); return fn; }, clearTimer: (fn: any) => timers.delete(fn),
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
    async target(_user: string, identity: any) {
      calls.push(['target', identity]);
      if (!m.eligible.some((s: any) => s.id === identity.spaceId)) return { status: 'ineligible' };
      const date = m.rows.find((d: any) => d.space_id === identity.spaceId && d.id === identity.importantDateId);
      return date ? { status: 'ready', date, space: m.members.find((s: any) => s.id === identity.spaceId) } : { status: 'missing' };
    },
    async update(_client: any, _user: any, date: any, draft: any) { calls.push(['update', date.space_id, date.id, date, draft]); m.rows = m.rows.map((r: any) => r.id === date.id && r.space_id === date.space_id ? { ...r, ...draft } : r); },
    async remove(_client: any, _user: any, date: any) { calls.push(['delete', date.space_id, date.id]); m.rows = m.rows.filter((r: any) => r.id !== date.id || r.space_id !== date.space_id); },
    eventRows: [{ source_event_id: 'event', occurrence_id: 'event', occurrence_date: '2027-02-27', occurrence_starts_at: now.toISOString(), occurrence_ends_at: null, all_day: true, title: '日程成功内容', description: null,
      source_event: { id: 'event', space_id: shared.id, scope: 'shared', owner_user_id: null, recurrence_rule: null, title: '日程成功内容', starts_at: now.toISOString(), all_day: true } }],
    taskRows: [{ id: 'task', title: '任务成功内容', space_id: shared.id, status: 'open', assigned_to_user_id: null, due_on: null, created_at: now.toISOString() }],
    async events(listed: any = spaces) { calls.push(['events']); if (m.eventFailure) throw new Error('日程测试失败');
      return { occurrences: structuredClone(m.eventRows.filter((r: any) => listed.some((s: any) => s.id === r.source_event.space_id))), membersBySpaceId: { shared: [{ space_id: 'shared', user_id: m.userId, profiles: { display_name: '我' } }] } }; },
    async tasks(_spaces: any, userId: string, today: Date, _ops: any) { calls.push(['tasks']); if (m.taskFailure) throw new Error('任务测试失败');
      return { tasks: structuredClone(visibleHomeTasks(m.taskRows.filter((t: any) => m.taskIds.includes(t.space_id) && _spaces.some((s: any) => s.id === t.space_id)), userId, today)), enabledSpaceIds: m.taskIds.filter((id: string) => _spaces.some((s: any) => s.id === id)), membersBySpaceId: { shared: [{ space_id: 'shared', user_id: m.userId, profiles: { display_name: '我' } }] } }; },
  };
  m.supabase = { auth: { getUser: async () => ({ data: { user: { id: m.userId } }, error: null }), onAuthStateChange(fn: any) { auth.add(fn); return { data: { subscription: { unsubscribe: () => auth.delete(fn) } } }; } },
    from(table: string) {
      assert.ok(['space_modules', 'space_members', 'tasks'].includes(table)); const filters: any = {}; let mutation: any;
      const result = () => {
        if (table === 'space_modules') return { data: m.members.filter((s: any) => !filters.space_id || (Array.isArray(filters.space_id) ? filters.space_id.includes(s.id) : filters.space_id === s.id)).map((s: any) => ({ space_id: s.id, enabled: m.taskIds.includes(s.id) })), error: null };
        if (table === 'space_members') return { data: m.members.some((s: any) => s.id === filters.space_id) ? [{ space_id: filters.space_id, user_id: m.userId, role: 'member', profiles: { display_name: '我' } }] : [], error: null };
        const matches = m.taskRows.filter((t: any) => Object.entries(filters).every(([k, v]) => t[k] === v));
        if (mutation) { calls.push(['task-mutation', { ...filters }]); for (const t of matches) Object.assign(t, mutation); }
        return { data: matches, error: null };
      };
      const query: any = { select: () => query, in: (k: string, v: any) => { filters[k] = v; return query; }, eq: (k: string, v: any) => { filters[k] = v; return query; }, order: () => query,
        update: (v: any) => { mutation = v; return query; },
        range: async () => { const r = result(); calls.push(['module-read']); return { ...r, count: r.data.length }; },
        maybeSingle: async () => { calls.push(['task-exact', { ...filters }]); if (m.exactTaskRead) return m.exactTaskRead(); const r = result(); return { ...r, data: r.data[0] ?? null }; },
        then: (yes: any, no: any) => Promise.resolve(result()).then(yes, no) };
      return query;
    },
    channels: [] as any[], channel(name: string) { calls.push(['channel', name]); const channel: any = { name, on: (_e: any, _config: any, fn: any) => { channel.change = fn; return channel; }, subscribe: (fn: any) => { channel.status = fn; fn('SUBSCRIBED'); return channel; } }; m.supabase.channels.push(channel); return channel; }, removeChannel(channel: any) { calls.push(['remove-channel', channel.name]); m.supabase.channels = m.supabase.channels.filter((c: any) => c !== channel); },
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
      if (id === '\0home-spaces') return prefix + 'export const listCurrentSpaces=async()=>m.spaceRead?m.spaceRead():m.members;';
      if (id === '\0home-dates') return prefix + 'export class ImportantDatesAuthError extends Error{};export const loadHomeImportantDates=(...a)=>m.home(...a),loadCalendarImportantDates=()=>{throw Error("T4 not started")},loadImportantDates=(...a)=>m.canonical(...a),readImportantDateTarget=(...a)=>m.target(...a),loadImportantDatesEligibility=async()=>({memberSpaces:m.members,eligibleSpaces:m.eligible}),updateImportantDate=(...a)=>m.update(...a),deleteImportantDate=(...a)=>m.remove(...a),createImportantDate=()=>{throw Error("not used")};';
      if (id === '\0home-bootstrap') return prefix + 'export const bootstrapSpaces=async()=>({spaces:m.members,selectedSpaceId:"personal"}),chooseSelectedSpaceId=(s,id)=>s.find(x=>x.id===id)?.id??s[0]?.id,ensureOnceUntilFailure=f=>f,writeSelectedSpaceId=()=>{},clearSelectedSpaceId=()=>{};';
      if (id === '\0home-availability') return prefix + 'export const ModuleHub=()=>null,useModuleAvailability=()=>({availability:{tasksIds:m.taskIds,reviewIds:[],listsIds:[],importantDatesIds:m.eligible.map(s=>s.id),importantDatesError:!!m.availabilityError},refreshing:!!m.availabilityPending,refresh:async()=>{},invalidate:()=>{},moduleChanged:()=>{}});';
      if (id === '\0home-push') return 'export const registerPushServiceWorker=async()=>{};';
    },
    transform(code, id) {
      if (id.endsWith('/navigation.ts')) return code.replace(/(export function (?:selectTab|openImportantDatesModule)\([^)]*\)[^{]*\{)/g, '$1 globalThis.__homeImportantDates.navigationCalls++;');
      if (id.endsWith('/App.tsx')) return code + '\nexport { CalendarApp as HomeTestApp };';
      if (id.endsWith('/HomeImportantDatesSection.tsx') || id.endsWith('/HomePage.tsx')) return code.replace(/setTimeout\(/g, 'globalThis.__homeImportantDates.timer(').replace(/clearTimeout\(/g, 'globalThis.__homeImportantDates.clearTimer(');
      if (id.endsWith('/home-aggregation.ts')) return code.replace('export async function readHomeEvents(', 'async function originalReadHomeEvents(').replace('export async function readHomeTasks(', 'async function originalReadHomeTasks(')
        + '\nexport const readHomeEvents=(...a)=>globalThis.__homeImportantDates.events(...a),readHomeTasks=(...a)=>globalThis.__homeImportantDates.tasks(...a);';
    },
  }] } as any);
  const stop = (mount: any) => { for (const fn of mount.cleanups.values()) fn(); };
  const execute = (key: string, fn: any, props: any) => {
    if (!mounts.has(key) && fn.name === 'ImportantDatesPage') m.pageMounts++;
    if (!mounts.has(key)) mounts.set(key, { slots: [], cleanups: new Map(), effects: [], cursor: 0 });
    active = mounts.get(key); active.cursor = 0; return fn(props);
  };
  try {
    const App = (await vite.ssrLoadModule('/src/App.tsx')).HomeTestApp;
    const Section = (await vite.ssrLoadModule('/src/components/HomeImportantDatesSection.tsx')).HomeImportantDatesSection;
    const Home = (await vite.ssrLoadModule('/src/components/HomePage.tsx')).HomePage;
    (globalThis as any).window = surface; (globalThis as any).document = surface;
    (globalThis as any).Date = new Proxy(previous.Date, { construct(target, args) { return Reflect.construct(target, args.length ? args : [now.getTime()]); } });
    const expanded = new Set(['HomePage', 'HomeSection', 'HomeImportantDatesSection', 'ImportantDatesPage', 'ImportantDatesModule', 'BottomNavigation']);
    let app = false, home = false; let props: any = { userId: 'me', spaces, entry: { memberSpaces: spaces, eligibleSpaces: spaces }, onViewAll() {}, onOpen() {} };
    const render = () => {
      const visited = new Set<string>();
      const expand = (node: any, path: string): any => {
        if (!React.isValidElement(node)) return node;
        if (typeof node.type === 'function' && expanded.has(node.type.name)) { const key = path + ':' + node.type.name + ':' + (node.key ?? ''); visited.add(key); return expand(execute(key, node.type, node.props), key); }
        const children = React.Children.toArray((node.props as any).children).map((child, i) => expand(child, path + ':' + i));
        return React.cloneElement(node, undefined, ...children);
      };
      visited.add('root'); const tree = expand(execute('root', app ? App : home ? Home : Section, app ? { session: { user: { id: m.userId } }, restoreOnStartup: false } : props), 'root');
      for (const [key, mount] of mounts) if (!visited.has(key)) { stop(mount); mounts.delete(key); }
      return tree;
    };
    const pump = async () => { let tree: any; for (let n = 0; n < 7; n++) { tree = render(); for (const mount of mounts.values()) for (const { i, fn } of mount.effects.splice(0)) { mount.cleanups.get(i)?.(); const cleanup = fn(); if (cleanup) mount.cleanups.set(i, cleanup); else mount.cleanups.delete(i); } await tick(); } return render(); };
    const dispatch = (key: string) => { for (const fn of [...listeners.get(key) ?? []]) fn(); };
    await run({ m, calls, props, render, pump, dispatch, surface, timers, auth, listenerCount: () => [...listeners.values()].reduce((count, set) => count + set.size, 0), home: () => { home = true; for (const mount of mounts.values()) stop(mount); mounts.clear(); Object.assign(props, { onMembershipRefresh: async () => {}, EventSheetComponent: function HomeEventSheet() {}, onOpenImportantDates() {} }); }, app: () => { app = true; for (const mount of mounts.values()) stop(mount); mounts.clear(); }, now: (value: Date) => { now = value; }, unmount: () => { for (const mount of mounts.values()) stop(mount); mounts.clear(); } });
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

test('real App view-all/title navigates to module; single item opens exact Sheet and closes on Home', () => runtime(async (e) => {
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
  assert.equal(sheet(tree).props.date.reminder_kind, 'all_day_previous_day_20'); assert.ok(section(tree));
  sheet(tree).props.onCancel(); tree = await e.pump(); assert.equal(sheet(tree), undefined);
  const reads = e.calls.filter((c: any) => c[0] === 'home').length; tree = await e.pump();
  assert.equal(items(tree).length, 3); assert.equal(e.calls.filter((c: any) => c[0] === 'home').length, reads); assert.equal(sheet(tree), undefined);
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
  tree = await e.pump(); assert.match(renderToStaticMarkup(section(tree)), /已修改.*就是今天/);
  button(items(tree)[0], '打开重要日 已修改').props.onClick(); tree = await e.pump(); sheet(tree).props.onDelete(); tree = await e.pump();
  const dialog = elements(tree).find((el) => el.type?.name === 'ImportantDateDeleteDialog'); await dialog.props.onConfirm(); tree = await e.pump();
  tree = await e.pump();
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


test('actual App navigation performs one fresh Home reconciliation per re-entry and stable renders add none', () => runtime(async (e) => {
  e.app(); let tree = await e.pump();
  // Begin outside Home, then enter through the real bottom navigation.
  button(tree, '日历').props.onClick(); tree = await e.pump();
  let before = e.calls.filter((c: any) => c[0] === 'home').length;
  button(tree, '首页').props.onClick(); tree = await e.pump();
  assert.equal(e.calls.filter((c: any) => c[0] === 'home').length - before, 1);
  button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump();
  sheet(tree).props.onCancel(); tree = await e.pump();
  button(section(tree), '查看全部重要日').props.onClick(); tree = await e.pump();
  before = e.calls.filter((c: any) => c[0] === 'home').length;
  button(tree, '首页').props.onClick(); tree = await e.pump();
  assert.equal(e.calls.filter((c: any) => c[0] === 'home').length - before, 1);
  await e.pump(); assert.equal(e.calls.filter((c: any) => c[0] === 'home').length - before, 1);
  assert.equal(items(tree).length, 3);
}));

test('App-owned Home validated view survives unmount and renders during unresolved canonical re-entry', () => runtime(async (e) => {
  e.app(); let tree = await e.pump();
  assert.deepEqual(items(tree).map((el) => el.props['data-important-date-id']), ['a', 'b', 'c']);
  button(section(tree), '查看全部重要日').props.onClick(); tree = await e.pump();
  const pending = deferred(); const spacesPending = deferred(); const loader = e.m.home;
  e.m.home = () => pending.promise;
  e.m.spaceRead = () => spacesPending.promise;
  button(tree, '首页').props.onClick();
  // No effect or network response is needed to restore the last validated rows.
  tree = e.render();
  assert.equal(items(tree).length, 3);
  assert.doesNotMatch(renderToStaticMarkup(section(tree)), /正在读取重要日/);
  tree = await e.pump(); assert.equal(items(tree).length, 3);
  e.m.rows = e.m.rows.map((r: any) => r.id === 'b' ? { ...r, name: 'fresh replacement' } : r);
  pending.resolve(await loader('me', {}, null, null, null));
  assert.match(renderToStaticMarkup(section(await e.pump())), /fresh replacement/);
  spacesPending.resolve(spaces); await e.pump();
}));

test('warm background failure retains presentation with refresh error and retry; unknown availability is not disable', () => runtime(async (e) => {
  e.app(); let tree = await e.pump();
  button(section(tree), '查看全部重要日').props.onClick(); tree = await e.pump();
  e.m.availabilityPending = true; e.m.availabilityError = true;
  const loader = e.m.home; e.m.home = async () => { throw new Error('offline qualification'); };
  button(tree, '首页').props.onClick(); assert.equal(items(e.render()).length, 3);
  tree = await e.pump(); const html = renderToStaticMarkup(section(tree));
  assert.equal(items(tree).length, 3); assert.match(html, /更新失败.*上次已读取/);
  assert.doesNotMatch(html, /正在读取重要日|暂时无法加载/);
  e.m.home = loader; button(section(tree), '重试').props.onClick(); tree = await e.pump();
  assert.equal(items(tree).length, 3); assert.doesNotMatch(renderToStaticMarkup(section(tree)), /更新失败/);
}));

test('fresh confirmed eligibility loss removes retained rows even if source reconciliation then fails', () => runtime(async (e) => {
  let validated: any; e.props.onValidated = (data: any) => { validated = data; };
  await e.pump(); e.props.initialData = validated;
  e.m.home = async (_u: any, _t: any, _c: any, _p: any, publish: any) => {
    publish({ memberSpaces: spaces, eligibleSpaces: [personal] }); throw new Error('source offline');
  };
  e.props.entry = null; e.dispatch('focus'); let tree = await e.pump();
  assert.equal(items(tree).length, 0); assert.match(renderToStaticMarkup(tree), /暂时无法加载/);
  e.m.home = async (_u: any, _t: any, _c: any, _p: any, publish: any) => {
    publish({ memberSpaces: [], eligibleSpaces: [] }); throw new Error('source offline');
  };
  e.dispatch('focus'); assert.equal(section(await e.pump()), undefined);
}));

test('retained initial view is rejected before render for another user, yesterday, role or membership change', () => runtime(async (e) => {
  let validated: any; e.props.onValidated = (data: any) => { validated = data; };
  await e.pump(); e.props.initialData = validated;
  const pending = deferred(); e.m.home = () => pending.promise;
  for (const patch of [
    { userId: 'other' },
    { spaces: [personal], entry: null },
    { spaces: [personal, { ...shared, membershipRole: 'owner' }], entry: null },
    { entry: { memberSpaces: spaces, eligibleSpaces: [] } },
  ]) {
    e.unmount(); Object.assign(e.props, { userId: 'me', spaces, entry: { memberSpaces: spaces, eligibleSpaces: spaces } }, patch);
    assert.equal(items(e.render()).length, 0); assert.match(renderToStaticMarkup(e.render()), /正在读取重要日/);
  }
  e.unmount(); Object.assign(e.props, { userId: 'me', spaces, entry: { memberSpaces: spaces, eligibleSpaces: spaces } });
  e.now(new Date(2027, 1, 28));
  assert.equal(items(e.render()).length, 0); assert.doesNotMatch(renderToStaticMarkup(e.render()), /还有 1 天/);
}));

test('mounted retained view crosses midnight without showing yesterday wording and sign-out clears App presentation', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); assert.match(renderToStaticMarkup(section(tree)), /还有 1 天/);
  const pending = deferred(); e.m.home = () => pending.promise;
  e.now(new Date(2027, 1, 28)); for (const fn of [...e.timers]) fn();
  assert.equal(items(e.render()).length, 0); await e.pump();
  pending.resolve({ memberSpaces: spaces, eligibleSpaces: spaces, dates: e.m.rows });
  tree = await e.pump(); assert.match(renderToStaticMarkup(section(tree)), /就是今天/);
  for (const fn of [...e.auth]) fn('SIGNED_OUT', null);
  assert.equal(items(e.render()).length, 0);
  // Even if this fixture keeps CalendarApp mounted, cleared presentation cannot
  // be restored on re-entry. Production also remounts at the auth boundary.
  button(tree, '功能中心').props.onClick(); tree = await e.pump();
  button(tree, '首页').props.onClick(); assert.equal(items(e.render()).length, 0);
}));

test('direct save/delete retains presentation until canonical refresh replaces it and fills fourth slot', () => runtime(async (e) => {
  e.app(); let tree = await e.pump();
  button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump();
  const loader = e.m.home; let pending = deferred(); e.m.home = () => pending.promise;
  await sheet(tree).props.onSubmit({ ...sheet(tree).props.date, name: 'canonical edited' }, shared.id); tree = await e.pump();
  assert.equal(items(tree).length, 3); assert.doesNotMatch(renderToStaticMarkup(section(tree)), /canonical edited|正在读取/);
  pending.resolve(await loader('me', {}, null, null, null)); tree = await e.pump();
  button(items(tree)[0], '打开重要日 canonical edited').props.onClick(); tree = await e.pump();
  sheet(tree).props.onDelete(); tree = await e.pump(); pending = deferred();
  await elements(tree).find((el) => el.type?.name === 'ImportantDateDeleteDialog').props.onConfirm(); tree = await e.pump();
  assert.deepEqual(items(tree).map((el) => el.props['data-important-date-id']), ['a', 'b', 'c']);
  assert.equal(sheet(tree), undefined); assert.doesNotMatch(renderToStaticMarkup(section(tree)), /正在读取/);
  pending.resolve(await loader('me', {}, null, null, null));
  assert.deepEqual(items(await e.pump()).map((el) => el.props['data-important-date-id']), ['b', 'c', 'd']);
}));

test('App known module disable and Space lifecycle signals invalidate only Home presentation before re-entry', () => runtime(async (e) => {
  e.app(); let tree = await e.pump();
  const management = async () => {
    button(tree, '我的').props.onClick(); tree = await e.pump();
    elements(tree).find((el) => el.type?.name === 'MyPage').props.onManageSpaces(); tree = await e.pump();
    return elements(tree).find((el) => el.type?.name === 'SpaceManagementPage');
  };
  (await management()).props.onModuleChanged('important_dates', shared.id, 'disabled');
  const loader = e.m.home; const pending = deferred(); e.m.home = () => pending.promise;
  button(tree, '首页').props.onClick(); assert.equal(items(e.render()).length, 0);
  await e.pump(); pending.resolve(await loader('me', {}, null, null, null)); tree = await e.pump();
  assert.equal(items(tree).length, 3);
  for (const action of ['leave', 'remove', 'delete']) {
    await (await management()).props.onLifecycleSettled(action);
    const reread = deferred(); e.m.home = () => reread.promise;
    button(tree, '首页').props.onClick(); assert.equal(items(e.render()).length, 0);
    await e.pump(); reread.resolve(await loader('me', {}, null, null, null)); tree = await e.pump();
    assert.equal(items(tree).length, 3);
  }
}));

const legacySection = (tree: any, title: string) => elements(tree).find((el) => el.type === 'section' && el.props['aria-label'] === title);
const eventSection = (tree: any) => legacySection(tree, '近期日程');
const taskSection = (tree: any) => legacySection(tree, '需要处理的任务');
async function leaveHome(e: any, tree: any) {
  button(tree, '功能中心').props.onClick(); return e.pump();
}

test('Home Event and Task warm return restore before unresolved reads and replace canonical content', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); tree = await leaveHome(e, tree);
  const events = deferred(), tasks = deferred(), members = deferred();
  const eventLoader = e.m.events, taskLoader = e.m.tasks;
  e.m.events = () => events.promise; e.m.tasks = () => tasks.promise; e.m.spaceRead = () => members.promise;
  button(tree, '首页').props.onClick(); tree = e.render();
  assert.match(renderToStaticMarkup(eventSection(tree)), /日程成功内容/);
  assert.match(renderToStaticMarkup(taskSection(tree)), /任务成功内容/);
  await e.pump(); tree = e.render();
  assert.doesNotMatch(renderToStaticMarkup(eventSection(tree)), /正在读取/);
  assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /正在读取/);
  const freshEvents = structuredClone(await eventLoader()); freshEvents.occurrences[0].title = 'fresh Event';
  const freshTasks = structuredClone(await taskLoader(spaces, 'me', new Date())); freshTasks.tasks[0].title = 'fresh Task';
  events.resolve(freshEvents); tasks.resolve(freshTasks); members.resolve(spaces);
  tree = await e.pump();
  assert.match(renderToStaticMarkup(eventSection(tree)), /fresh Event/);
  assert.match(renderToStaticMarkup(taskSection(tree)), /fresh Task/);
}));

test('Home Event and Task background failures keep retained rows with lightweight retry', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); tree = await leaveHome(e, tree);
  e.m.eventFailure = true; e.m.taskFailure = true;
  button(tree, '首页').props.onClick(); tree = await e.pump();
  for (const [section, content] of [[eventSection, '日程成功内容'], [taskSection, '任务成功内容']] as const) {
    const html = renderToStaticMarkup(section(tree)); assert.match(html, new RegExp(content));
    assert.match(html, /更新失败/); assert.doesNotMatch(html, /正在读取/);
    button(section(tree), '重试').props.onClick();
  }
  e.m.eventFailure = false; e.m.taskFailure = false; tree = await e.pump();
  assert.doesNotMatch(renderToStaticMarkup(eventSection(tree)), /更新失败/);
  assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /更新失败/);
}));

const eventEditor = (tree: any) => elements(tree).find((el) => el.type?.name === 'EventSheet' && el.props.target);
const taskEditor = (tree: any) => elements(tree).find((el) => el.type?.name === 'TaskSheet' && el.props.task);
const eventButton = (tree: any) => elements(eventSection(tree)).find((el) => el.type === 'button' && text(el).includes('日程成功内容'));
const taskButton = (tree: any) => elements(taskSection(tree)).find((el) => el.type === 'button' && text(el).includes('任务成功内容'));

test('retained recurring Event click waits for reconciliation and opens only fresh source/occurrence', () => runtime(async (e) => {
  e.app(); e.m.eventRows[0].source_event.recurrence_rule = { version: 1, frequency: 'daily', interval: 1, time_zone: 'Asia/Shanghai' };
  let tree = await e.pump(); tree = await leaveHome(e, tree);
  const pending = deferred(), loader = e.m.events; e.m.events = () => pending.promise;
  button(tree, '首页').props.onClick(); tree = await e.pump();
  const click = eventButton(tree).props.onClick(); tree = await e.pump(); assert.equal(eventEditor(tree), undefined);
  const fresh = structuredClone(await loader()); fresh.occurrences[0].title = 'new occurrence'; fresh.occurrences[0].source_event.title = 'new canonical series';
  pending.resolve(fresh); await click; tree = await e.pump();
  const editor = eventEditor(tree); assert.ok(editor); assert.equal(editor.props.target.event.title, 'new canonical series');
  assert.equal(editor.props.target.occurrence.title, 'new occurrence');
  assert.equal(e.calls.filter((c: any) => c[0] === 'events').length, 2); // Initial read plus fixture-generated fresh result; click adds none.
}));

test('retained Event deleted/moved out/permission loss does not initialize an editor', () => runtime(async (e) => {
  e.app(); let tree = await e.pump();
  for (const result of ['deleted', 'rescheduled', 'inaccessible']) {
    tree = await leaveHome(e, tree); const pending = deferred(); e.m.events = () => pending.promise;
    button(tree, '首页').props.onClick(); tree = await e.pump(); eventButton(tree).props.onClick();
    if (result === 'inaccessible') pending.resolve({ occurrences: [], membersBySpaceId: {} });
    else pending.resolve({ occurrences: [], membersBySpaceId: { shared: [] } });
    tree = await e.pump(); assert.equal(eventEditor(tree), undefined); assert.match(renderToStaticMarkup(eventSection(tree)), /日程已变化/);
    e.m.events = async () => ({ occurrences: e.m.eventRows, membersBySpaceId: { shared: [{ space_id: 'shared', user_id: 'me' }] } });
    button(eventSection(tree), '新建日程'); // Restore only via canonical refresh, not by action payload.
    tree = await leaveHome(e, tree); button(tree, '首页').props.onClick(); tree = await e.pump();
  }
}));

test('retained Task immediate open rereads exact module/task/member and uses fresh object', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); tree = await leaveHome(e, tree);
  const pending = deferred(); e.m.tasks = () => pending.promise;
  e.m.taskRows = [{ ...e.m.taskRows[0], title: 'exact fresh Task' }];
  button(tree, '首页').props.onClick(); tree = await e.pump(); await taskButton(tree).props.onClick(); tree = await e.pump();
  assert.equal(taskEditor(tree).props.task.title, 'exact fresh Task');
  assert.ok(e.calls.some((c: any) => c[0] === 'task-exact' && c[1].id === 'task' && c[1].space_id === 'shared'));
  assert.equal(e.calls.filter((c: any) => c[0] === 'task-mutation').length, 0);
}));

test('retained Task quick complete waits for fresh qualified result and uses an open-only conditional write', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); tree = await leaveHome(e, tree);
  const pending = deferred(), loader = e.m.tasks; e.m.tasks = () => pending.promise;
  button(tree, '首页').props.onClick(); tree = await e.pump(); button(taskSection(tree), '完成 任务成功内容').props.onClick();
  await e.pump(); assert.equal(e.calls.filter((c: any) => c[0] === 'task-mutation').length, 0);
  e.m.tasks = loader; pending.resolve(await loader(spaces, 'me', new Date())); tree = await e.pump();
  const writes = e.calls.filter((c: any) => c[0] === 'task-mutation'); assert.equal(writes.length, 1);
  assert.deepEqual(writes[0][1], { space_id: 'shared', id: 'task', status: 'open' });
  await new Promise((resolve) => setTimeout(resolve, 180)); tree = await e.pump();
  assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /任务成功内容/);
}));

test('retained completed/deleted/reassigned/distant Task cannot authorize completion or stale Sheet', () => runtime(async (e) => {
  e.app(); const original = structuredClone(e.m.taskRows[0]); let tree = await e.pump();
  for (const replacement of [[], [{ ...original, status: 'completed' }], [{ ...original, assigned_to_user_id: 'other' }], [{ ...original, due_on: '2030-01-01' }]]) {
    tree = await leaveHome(e, tree); const pending = deferred(), loader = e.m.tasks; e.m.tasks = () => pending.promise;
    button(tree, '首页').props.onClick(); tree = await e.pump();
    e.m.taskRows = replacement;
    button(taskSection(tree), '完成 任务成功内容').props.onClick();
    await taskButton(tree).props.onClick(); tree = await e.pump(); assert.equal(taskEditor(tree), undefined);
    e.m.tasks = loader; pending.resolve(await loader(spaces, 'me', new Date())); tree = await e.pump();
    assert.equal(e.calls.filter((c: any) => c[0] === 'task-mutation').length, 0);
    e.m.taskRows = [structuredClone(original)]; tree = await leaveHome(e, tree); button(tree, '首页').props.onClick(); tree = await e.pump();
  }
}));

test('Home keeps the full qualified Task result for expand and fresh replacement fills/reorders rows', () => runtime(async (e) => {
  e.app(); e.m.taskRows = Array.from({ length: 7 }, (_, n) => ({ ...e.m.taskRows[0], id: String(n), title: `qualified ${n}` }));
  let tree = await e.pump(); assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /qualified 6/);
  tree = await leaveHome(e, tree); const pending = deferred(), loader = e.m.tasks; e.m.tasks = () => pending.promise;
  button(tree, '首页').props.onClick(); tree = await e.pump(); button(taskSection(tree), '展开更多').props.onClick(); tree = e.render();
  assert.match(renderToStaticMarkup(taskSection(tree)), /qualified 6/);
  e.m.taskRows = [{ ...e.m.taskRows[6], due_on: '2027-02-25' }, { ...e.m.taskRows[3], due_on: '2027-02-27', title: 'changed due ordering' }, { ...e.m.taskRows[0], status: 'completed' }, { ...e.m.taskRows[1], assigned_to_user_id: 'other' }, { ...e.m.taskRows[2], due_on: '2030-01-01' }];
  pending.resolve(await loader(spaces, 'me', new Date())); tree = await e.pump();
  assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /qualified 0|qualified 1|qualified 2/);
  assert.match(renderToStaticMarkup(taskSection(tree)), /qualified 6.*changed due ordering/);
}));

test('Home Event/Task Realtime notification keeps presentation and rereads canonically; cleanup removes same channels', () => runtime(async (e) => {
  e.app(); let tree = await e.pump();
  const eventPending = deferred(), taskPending = deferred(), eventLoader = e.m.events, taskLoader = e.m.tasks;
  e.m.events = () => eventPending.promise; e.m.tasks = () => taskPending.promise;
  for (const channel of e.m.supabase.channels) channel.change({ new: { title: 'payload is not authority' } });
  tree = await e.pump(); assert.match(renderToStaticMarkup(eventSection(tree)), /日程成功内容/); assert.match(renderToStaticMarkup(taskSection(tree)), /任务成功内容/);
  assert.doesNotMatch(renderToStaticMarkup(tree), /payload is not authority/);
  await new Promise((resolve) => setTimeout(resolve, 180)); await e.pump();
  eventPending.resolve(await eventLoader()); taskPending.resolve(await taskLoader(spaces, 'me', new Date())); await e.pump();
  await leaveHome(e, e.render()); assert.equal(e.m.supabase.channels.length, 0);
  assert.ok(e.calls.some((c: any) => c[0] === 'remove-channel' && c[1].startsWith('home-events:')));
  assert.ok(e.calls.some((c: any) => c[0] === 'remove-channel' && c[1].startsWith('home-tasks:')));
}));

test('cold Home reads load, publish full feature-specific snapshots and fail with original retry', () => runtime(async (e) => {
  e.home(); let eventSnapshot: any, taskSnapshot: any;
  e.props.onEventsValidated = (data: any) => { eventSnapshot = data; }; e.props.onTasksValidated = (data: any) => { taskSnapshot = data; };
  let tree = e.render(); assert.match(renderToStaticMarkup(eventSection(tree)), /正在读取/); assert.match(renderToStaticMarkup(taskSection(tree)), /正在读取/);
  await e.pump(); assert.equal(eventSnapshot.items.length, 1); assert.equal(taskSnapshot.items.length, 1);
  assert.equal(eventSnapshot.items[0].source_event, undefined); assert.equal(eventSnapshot.items[0].source_event_id, 'event');
  assert.equal(taskSnapshot.scope.eligibleSpaces[0].id, 'shared');
  e.unmount(); e.m.eventFailure = true; e.m.taskFailure = true; tree = await e.pump();
  for (const section of [eventSection, taskSection]) { assert.match(renderToStaticMarkup(section(tree)), /测试失败.*重试/); assert.doesNotMatch(renderToStaticMarkup(section(tree)), /更新失败|成功内容/); }
}));

test('Home snapshots reject auth/member/role/day/range/module changes before render; unknown eligibility may retain', () => runtime(async (e) => {
  e.home(); let events: any, tasks: any;
  e.props.onEventsValidated = (data: any) => { events = data; }; e.props.onTasksValidated = (data: any) => { tasks = data; }; await e.pump();
  e.props.initialEvents = events; e.props.initialTasks = tasks;
  const eventsPending = deferred(), tasksPending = deferred(); e.m.events = () => eventsPending.promise; e.m.tasks = () => tasksPending.promise;
  for (const patch of [{ userId: 'other' }, { spaces: [personal] }, { spaces: [personal, { ...shared, membershipRole: 'owner' }] }]) {
    e.unmount(); Object.assign(e.props, { userId: 'me', spaces, tasksEntry: null }, patch);
    const tree = e.render(); assert.doesNotMatch(renderToStaticMarkup(eventSection(tree)), /日程成功内容/); assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /任务成功内容/);
  }
  e.unmount(); Object.assign(e.props, { userId: 'me', spaces, tasksEntry: { memberSpaces: spaces, eligibleSpaces: [] } });
  let tree = e.render(); assert.match(renderToStaticMarkup(eventSection(tree)), /日程成功内容/); assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /任务成功内容/);
  e.unmount(); e.props.tasksEntry = null; tree = e.render(); assert.match(renderToStaticMarkup(taskSection(tree)), /任务成功内容/);
  e.unmount(); e.props.initialEvents = { ...events, rangeKey: events.rangeKey + ':different-timezone' }; tree = e.render();
  assert.doesNotMatch(renderToStaticMarkup(eventSection(tree)), /日程成功内容/);
  e.unmount(); e.props.initialEvents = events; e.now(new Date(2027, 1, 28)); tree = e.render();
  assert.doesNotMatch(renderToStaticMarkup(eventSection(tree)), /日程成功内容/); assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /任务成功内容/);
}));

test('Home midnight and sign-out reject retained content and pending actions without publishing late replies', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); const events = deferred(), tasks = deferred(); e.m.events = () => events.promise; e.m.tasks = () => tasks.promise;
  tree = await leaveHome(e, tree); button(tree, '首页').props.onClick(); tree = await e.pump();
  eventButton(tree).props.onClick(); button(taskSection(tree), '完成 任务成功内容').props.onClick();
  e.now(new Date(2027, 1, 28)); for (const fn of [...e.timers]) fn();
  tree = e.render(); assert.doesNotMatch(renderToStaticMarkup(eventSection(tree)), /日程成功内容/); assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /任务成功内容/);
  await e.pump(); for (const fn of [...e.auth]) fn('SIGNED_OUT', null); tree = e.render();
  assert.doesNotMatch(renderToStaticMarkup(eventSection(tree)), /日程成功内容/); assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /任务成功内容/);
  events.resolve({ occurrences: e.m.eventRows, membersBySpaceId: {} }); tasks.resolve({ tasks: e.m.taskRows, enabledSpaceIds: ['shared'], membersBySpaceId: {} });
  tree = await e.pump(); assert.equal(eventEditor(tree), undefined); assert.equal(taskEditor(tree), undefined);
  assert.equal(e.calls.filter((c: any) => c[0] === 'task-mutation').length, 0);
}));

test('Home A1→B→A2 late reads never replace latest views or fulfill old actions', () => runtime(async (e) => {
  e.home(); const a1Events = deferred(), a1Tasks = deferred(); e.m.events = () => a1Events.promise; e.m.tasks = () => a1Tasks.promise;
  await e.pump(); const eventLoader = async () => ({ occurrences: [{ ...e.m.eventRows[0], title: 'A2 Event' }], membersBySpaceId: {} });
  const taskLoader = async () => ({ tasks: [{ ...e.m.taskRows[0], title: 'A2 Task' }], enabledSpaceIds: ['shared'], membersBySpaceId: {} });
  e.props.spaces = [personal]; e.m.events = async () => ({ occurrences: [], membersBySpaceId: {} }); e.m.taskIds = []; e.m.tasks = async () => ({ tasks: [], enabledSpaceIds: [], membersBySpaceId: {} }); await e.pump();
  e.props.spaces = spaces; e.m.taskIds = ['shared']; e.m.events = eventLoader; e.m.tasks = taskLoader; let tree = await e.pump();
  a1Events.resolve({ occurrences: e.m.eventRows, membersBySpaceId: {} }); a1Tasks.resolve({ tasks: e.m.taskRows, enabledSpaceIds: ['shared'], membersBySpaceId: {} });
  tree = await e.pump(); assert.match(renderToStaticMarkup(eventSection(tree)), /A2 Event/); assert.match(renderToStaticMarkup(taskSection(tree)), /A2 Task/);
  assert.doesNotMatch(renderToStaticMarkup(tree), /日程成功内容|任务成功内容/);
}));

test('Home quick completion waiting on auth is cancelled by unmount and membership change', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); const authPending = deferred(); e.m.supabase.auth.getUser = () => authPending.promise;
  button(taskSection(tree), '完成 任务成功内容').props.onClick(); await e.pump();
  tree = await leaveHome(e, tree); authPending.resolve({ data: { user: { id: 'me' } }, error: null }); await e.pump();
  assert.equal(e.calls.filter((c: any) => c[0] === 'task-mutation').length, 0);
}));

test('Home confirmed Task disable removes retained rows even when source read fails; ordinary unknown failure keeps them', () => runtime(async (e) => {
  e.home(); let snapshot: any; e.props.onTasksValidated = (data: any) => { snapshot = data; }; await e.pump(); e.props.initialTasks = snapshot;
  e.unmount(); e.m.taskIds = []; e.m.taskFailure = true; let tree = await e.pump();
  assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /任务成功内容/); assert.match(renderToStaticMarkup(taskSection(tree)), /任务测试失败/);
  e.unmount(); e.m.taskIds = ['shared']; tree = await e.pump(); assert.match(renderToStaticMarkup(taskSection(tree)), /任务成功内容.*更新失败|更新失败.*任务成功内容/);
}));

test('App warm Space gate works with only Event or only Task snapshot and no Important Dates success', () => runtime(async (e) => {
  e.m.homeFailure = true; e.app(); let tree = await e.pump();
  for (const feature of ['event', 'task']) {
    if (feature === 'task') { e.unmount(); e.m.eventFailure = true; tree = await e.pump(); }
    tree = await leaveHome(e, tree); const pending = deferred(); e.m.spaceRead = () => pending.promise;
    button(tree, '首页').props.onClick(); tree = e.render();
    assert.match(renderToStaticMarkup(feature === 'event' ? eventSection(tree) : taskSection(tree)), /成功内容/);
    pending.resolve(spaces); tree = await e.pump();
  }
}));

test('App Space/member loss, Task disable and leave/remove/delete invalidate Home feature slots', () => runtime(async (e) => {
  e.app(); let tree = await e.pump();
  const manage = async () => {
    button(tree, '我的').props.onClick(); tree = await e.pump();
    elements(tree).find((el) => el.type?.name === 'MyPage').props.onManageSpaces(); tree = await e.pump();
    return elements(tree).find((el) => el.type?.name === 'SpaceManagementPage');
  };
  (await manage()).props.onModuleChanged('tasks', shared.id, 'disabled');
  const pending = deferred(), loader = e.m.tasks; e.m.tasks = () => pending.promise;
  button(tree, '首页').props.onClick(); tree = e.render();
  assert.match(renderToStaticMarkup(eventSection(tree)), /日程成功内容/); assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /任务成功内容/);
  await e.pump(); pending.resolve(await loader(spaces, 'me', new Date())); e.m.tasks = loader; tree = await e.pump();
  for (const action of ['leave', 'remove', 'delete']) {
    await (await manage()).props.onLifecycleSettled(action);
    button(tree, '首页').props.onClick(); tree = e.render();
    assert.doesNotMatch(renderToStaticMarkup(eventSection(tree)), /日程成功内容/); assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /任务成功内容/);
    tree = await e.pump();
  }
  e.m.members = [personal]; e.m.eligible = [personal]; e.dispatch('focus'); tree = await e.pump();
  assert.doesNotMatch(renderToStaticMarkup(eventSection(tree)), /日程成功内容/); assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /任务成功内容/);
}));

test('warm A1→role B→A2 cancels pending retained Event/Task actions even when A1 returns last', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); tree = await leaveHome(e, tree);
  const a1Events = deferred(), a1Tasks = deferred(), eventLoader = e.m.events, taskLoader = e.m.tasks;
  e.m.events = () => a1Events.promise; e.m.tasks = () => a1Tasks.promise;
  button(tree, '首页').props.onClick(); tree = await e.pump(); eventButton(tree).props.onClick(); button(taskSection(tree), '完成 任务成功内容').props.onClick();
  const roleB = { ...shared, membershipRole: 'owner' }; e.m.members = [personal, roleB];
  e.m.events = async () => ({ occurrences: [], membersBySpaceId: {} }); e.m.tasks = async () => ({ tasks: [], enabledSpaceIds: ['shared'], membersBySpaceId: {} });
  e.dispatch('focus'); await e.pump(); e.m.members = spaces;
  e.m.events = async () => { const data = await eventLoader(); data.occurrences[0].title = 'A2 latest Event'; return data; };
  e.m.tasks = async (...args: any[]) => { const data = await taskLoader(...args); data.tasks[0].title = 'A2 latest Task'; return data; };
  e.dispatch('focus'); tree = await e.pump();
  a1Events.resolve(await eventLoader()); a1Tasks.resolve(await taskLoader(spaces, 'me', new Date())); tree = await e.pump();
  assert.match(renderToStaticMarkup(eventSection(tree)), /A2 latest Event/); assert.match(renderToStaticMarkup(taskSection(tree)), /A2 latest Task/);
  assert.equal(eventEditor(tree), undefined); assert.equal(taskEditor(tree), undefined); assert.equal(e.calls.filter((c: any) => c[0] === 'task-mutation').length, 0);
}));

test('Home Event/Task channel errors keep presentation, deny actions and reconnect to canonical reads', () => runtime(async (e) => {
  e.app(); let tree = await e.pump();
  const channels = e.m.supabase.channels.filter((c: any) => c.name.endsWith(':shared'));
  for (const c of channels) c.status('CHANNEL_ERROR'); tree = await e.pump();
  assert.match(renderToStaticMarkup(eventSection(tree)), /更新失败.*日程成功内容/); assert.match(renderToStaticMarkup(taskSection(tree)), /更新失败.*任务成功内容/);
  eventButton(tree).props.onClick(); button(taskSection(tree), '完成 任务成功内容').props.onClick(); await e.pump();
  assert.equal(eventEditor(e.render()), undefined); assert.equal(e.calls.filter((c: any) => c[0] === 'task-mutation').length, 0);
  for (const c of channels) c.status('SUBSCRIBED'); tree = await e.pump();
  assert.doesNotMatch(renderToStaticMarkup(eventSection(tree)), /更新失败/); assert.doesNotMatch(renderToStaticMarkup(taskSection(tree)), /更新失败/);
}));

test('Event click racing a Realtime invalidation waits for the next canonical occurrence', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); const pending = deferred(), loader = e.m.events; e.m.events = () => pending.promise;
  eventButton(tree).props.onClick(); // qualify initially sees the former fresh read.
  e.m.supabase.channels.find((c: any) => c.name === 'home-events:shared').change({});
  tree = await e.pump(); assert.equal(eventEditor(tree), undefined);
  await new Promise((resolve) => setTimeout(resolve, 180)); await e.pump();
  const fresh = await loader(); fresh.occurrences[0].source_event.title = 'post-notification source'; pending.resolve(fresh);
  tree = await e.pump(); assert.equal(eventEditor(tree).props.target.event.title, 'post-notification source');
}));

test('retained Task immediate completion before setup cannot act on a freshly disabled module', () => runtime(async (e) => {
  e.home(); let snapshot: any; e.props.onTasksValidated = (data: any) => { snapshot = data; }; await e.pump();
  e.unmount(); e.props.initialTasks = snapshot; e.m.taskIds = []; e.props.tasksEntry = null;
  const tree = e.render(); button(taskSection(tree), '完成 任务成功内容').props.onClick(); await e.pump();
  assert.equal(e.calls.filter((c: any) => c[0] === 'task-mutation').length, 0);
}));

test('Home Event A/B/C retained view becomes canonical B/C/D and ordinary click uses the fresh source', () => runtime(async (e) => {
  e.app(); const template = e.m.eventRows[0];
  const occurrence = (id: string, title = `日程 ${id}`) => ({ ...template, source_event_id: id, occurrence_id: id, title, source_event: { ...template.source_event, id, title } });
  e.m.eventRows = ['A', 'B', 'C'].map((id) => occurrence(id)); let tree = await e.pump(); tree = await leaveHome(e, tree);
  const pending = deferred(); let reads = 0; e.m.events = () => { reads += 1; return pending.promise; };
  button(tree, '首页').props.onClick(); tree = await e.pump();
  assert.match(renderToStaticMarkup(eventSection(tree)), /日程 A.*日程 B.*日程 C/);
  pending.resolve({ occurrences: ['B', 'C', 'D'].map((id) => occurrence(id)), membersBySpaceId: { shared: [{ space_id: 'shared', user_id: 'me' }] } });
  tree = await e.pump(); const html = renderToStaticMarkup(eventSection(tree)); assert.doesNotMatch(html, /日程 A/); assert.match(html, /日程 B.*日程 C.*日程 D/);
  elements(eventSection(tree)).find((el) => el.type === 'button' && text(el).startsWith('日程 B')).props.onClick(); tree = await e.pump();
  assert.equal(eventEditor(tree).props.target.kind, 'event'); assert.equal(eventEditor(tree).props.target.event.id, 'B'); assert.equal(reads, 1);
}));

test('Home Task open starts all three DB reads after first auth and publishes only after all plus final auth', () => runtime(async (e) => {
  e.app(); const tree = await e.pump();
  const original = e.m.supabase.from; const pending = { space_modules: deferred(), tasks: deferred(), space_members: deferred() };
  const started: string[] = []; let authReads = 0;
  e.m.supabase.auth.getUser = async () => { authReads++; return { data: { user: { id: 'me' } }, error: null }; };
  e.m.supabase.from = (table: keyof typeof pending) => {
    const q = original(table); const terminal = table === 'space_modules' ? 'range' : table === 'tasks' ? 'maybeSingle' : 'then';
    q[terminal] = (...args: any[]) => { started.push(table); return terminal === 'then' ? pending[table].promise.then(...args) : pending[table].promise; }; return q;
  };
  taskButton(tree).props.onClick(); await e.pump();
  assert.deepEqual(started.sort(), ['space_members', 'space_modules', 'tasks']); assert.equal(authReads, 1);
  pending.tasks.resolve({ data: { ...e.m.taskRows[0], title: 'fresh exact' }, error: null });
  pending.space_modules.resolve({ data: [{ space_id: 'shared', enabled: true }], count: 1, error: null });
  assert.equal(taskEditor(await e.pump()), undefined); assert.equal(authReads, 1);
  pending.space_members.resolve({ data: [{ space_id: 'shared', user_id: 'me', role: 'member', profiles: { display_name: '我' } }], error: null });
  assert.equal(taskEditor(await e.pump()).props.task.title, 'fresh exact'); assert.equal(authReads, 2);
}));


test('Home Important Date exact target opens while the full module list is still pending; list success does not reopen or replace draft', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); const list = deferred(); const target = deferred();
  e.m.canonical = () => list.promise; e.m.target = (_u: string, id: any) => { e.calls.push(['exact-target',id]); return target.promise; };
  button(items(tree)[0], '打开重要日 同名').props.onClick(); await e.pump(); assert.equal(sheet(e.render()), undefined);
  const fresh = { ...e.m.rows[0], id: 'a', space_id: shared.id, name: 'fresh target', reminder_kind: null };
  target.resolve({ status: 'ready', date: fresh, space: shared }); tree = await e.pump();
  assert.equal(sheet(tree).props.date, fresh); assert.equal(sheet(tree).props.canAct, true);
  assert.deepEqual(e.calls.find((c: any) => c[0] === 'exact-target')[1], { spaceId: shared.id, importantDateId: 'a' });
  list.resolve({ memberSpaces: spaces, eligibleSpaces: spaces, dates: e.m.rows }); tree = await e.pump(); assert.equal(sheet(tree).props.date, fresh);
  sheet(tree).props.onCancel(); tree = await e.pump(); assert.equal(sheet(tree), undefined);
}));

for (const failure of ['space_modules', 'tasks', 'space_members', 'auth-switch', 'disabled', 'missing', 'closed']) test(`Home Task parallel open rejects ${failure} without editor or mutation`, () => runtime(async (e) => {
  e.app(); const tree = await e.pump(); const original = e.m.supabase.from; let auth = 0;
  e.m.supabase.auth.getUser = async () => ({ data: { user: { id: failure === 'auth-switch' && ++auth > 1 ? 'other' : 'me' } }, error: null });
  e.m.supabase.from = (table: string) => {
    const q = original(table);
    if (table === failure) {
      if (table === 'space_members') q.then = (_yes: any, no: any) => Promise.reject(new Error('offline')).then(_yes, no);
      else q[table === 'tasks' ? 'maybeSingle' : 'range'] = async () => ({ data: null, count: null, error: new Error('offline') });
    }
    if (table === 'space_modules' && failure === 'disabled') q.range = async () => ({ data: [{ space_id: 'shared', enabled: false }], count: 1, error: null });
    if (table === 'tasks' && ['missing','closed'].includes(failure)) q.maybeSingle = async () => ({ data: failure === 'missing' ? null : { ...e.m.taskRows[0], status: 'completed' }, error: null });
    return q;
  };
  taskButton(tree).props.onClick(); await e.pump(); assert.equal(taskEditor(e.render()), undefined);
  assert.equal(e.calls.filter((c: any) => c[0] === 'task-mutation').length, 0);
}));

test('Home Task late A click cannot overwrite the fresh B editor', () => runtime(async (e) => {
  e.m.taskRows.push({ ...e.m.taskRows[0], id: 'b', title: 'Task B' }); e.app(); const tree = await e.pump();
  const a = deferred(), b = deferred(); const original = e.m.supabase.from;
  e.m.supabase.from = (table: string) => { const q = original(table); let id = ''; const eq = q.eq;
    q.eq = (k: string, v: any) => { if (k === 'id') id = v; return eq(k,v); };
    if (table === 'tasks') q.maybeSingle = () => (id === 'b' ? b : a).promise; return q; };
  taskButton(tree).props.onClick(); await tick();
  elements(taskSection(tree)).find((el) => el.type === 'button' && text(el).includes('Task B')).props.onClick(); await e.pump();
  b.resolve({ data: e.m.taskRows[1], error: null }); assert.equal(taskEditor(await e.pump()).props.task.id,'b');
  a.resolve({ data: e.m.taskRows[0], error: null }); assert.equal(taskEditor(await e.pump()).props.task.id,'b');
}));

test('full Important Dates list arriving first never supplies the handoff editor; target failure retries exact identity', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); const pending = deferred(); const original = e.m.target;
  e.m.target = () => pending.promise; button(items(tree)[0],'打开重要日 同名').props.onClick(); tree = await e.pump();
  assert.equal(sheet(tree),undefined); assert.ok(section(tree)); assert.equal(button(tree,'新建重要日'),undefined);
  pending.resolve({ status: 'ready',date:{ ...e.m.rows.find((r: any) => r.id === 'a'),name:'exact version'},space:shared });
  tree = await e.pump(); assert.equal(sheet(tree).props.date.name,'exact version');
  sheet(tree).props.onCancel(); tree = await e.pump();
  e.m.target = async () => { throw new Error('offline'); }; button(items(tree)[0],'打开重要日 同名').props.onClick(); tree = await e.pump();
  assert.equal(sheet(tree),undefined); e.m.target = original;
  button(elements(tree).find((el) => el.props.role === 'alert'),'重试').props.onClick(); assert.equal(sheet(await e.pump()).props.date.id,'a');
}));


test('Home single Important Date opens fresh Sheet without navigation or full module mount', () => runtime(async (e) => {
  e.app(); let tree = await e.pump();
  const fullReads = e.calls.filter((c: any) => c[0] === 'canonical').length; const navigations = e.m.navigationCalls; const mounts = e.m.pageMounts;
  button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump();
  assert.ok(section(tree), 'Home remains mounted'); assert.equal(e.m.navigationCalls, navigations); assert.equal(e.m.pageMounts, mounts);
  assert.ok(sheet(tree)); assert.equal(e.calls.filter((c: any) => c[0] === 'target').length, 1); assert.equal(sheet(tree).props.date, e.m.rows.find((r: any) => r.id === 'a'));
  assert.equal(elements(tree).some((el) => el.props['aria-label'] === '新建重要日'), false);
  assert.equal(e.calls.filter((c: any) => c[0] === 'canonical').length, fullReads);
  sheet(tree).props.onCancel(); tree = await e.pump();
  assert.ok(section(tree)); assert.equal(sheet(tree), undefined);
}));


test('Home Event / Task / Important Date clicks all open their own Sheet with zero navigation', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); const navigation = e.m.navigationCalls;
  eventButton(tree).props.onClick(); tree = await e.pump(); assert.ok(eventEditor(tree));
  assert.ok(section(tree)); assert.equal(e.m.navigationCalls, navigation);
  eventEditor(tree).props.onClose(); tree = await e.pump();
  taskButton(tree).props.onClick(); tree = await e.pump(); assert.ok(taskEditor(tree));
  assert.ok(section(tree)); assert.equal(e.m.navigationCalls, navigation);
  taskEditor(tree).props.onClose(); tree = await e.pump();
  button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump(); assert.ok(sheet(tree));
  assert.ok(section(tree)); assert.equal(e.m.navigationCalls, navigation); assert.equal(e.m.pageMounts, 0);
}));

test('Home direct target ignores pending Review/global availability and never starts full module list', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); const pendingList = deferred(); const review = deferred();
  e.m.canonical = () => { e.calls.push(['forbidden-full-list']); return pendingList.promise; };
  e.m.availabilityPending = true; e.m.reviewQualification = () => review.promise;
  const fresh = { ...e.m.rows.find((r: any) => r.id === 'a'), name: 'fresh Reminder authority',
    reminder_kind: 'all_day_same_day_08', time_zone: 'Pacific/Auckland', reminder_schedule_changed_at: '2026-10-04T01:02:03.123456Z',
    created_by: 'me', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-10-04T01:02:03Z' };
  e.m.target = async (_u: string, id: any) => { e.calls.push(['target', id]); return { status: 'ready', date: fresh, space: shared }; };
  button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump();
  assert.equal(sheet(tree).props.date, fresh); assert.equal(sheet(tree).props.canAct, true);
  assert.equal(e.m.pageMounts, 0); assert.equal(e.calls.some((c: any) => c[0] === 'forbidden-full-list'), false);
  const draft = { ...fresh, reminder_kind: null };
  await sheet(tree).props.onSubmit(draft, shared.id); tree = await e.pump();
  assert.equal(sheet(tree), undefined); assert.ok(section(tree));
  const update = e.calls.find((c: any) => c[0] === 'update'); assert.equal(update[3], fresh); assert.equal(update[4].reminder_kind, null);
  assert.equal(update[3].reminder_schedule_changed_at, fresh.reminder_schedule_changed_at); assert.equal(update[3].time_zone, 'Pacific/Auckland');
}));

for (const outcome of ['missing', 'ineligible', 'offline', 'identity-mismatch']) test(`Home direct ${outcome} stays Home and never opens stale/colliding Sheet`, () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); const old = e.m.target; const reads = e.calls.filter((c: any) => c[0] === 'home').length;
  e.m.target = async () => { if (outcome === 'offline') throw Error('network');
    return outcome === 'identity-mismatch' ? { status: 'ready', date: e.m.rows[0], space: shared } : { status: outcome }; };
  button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump();
  assert.ok(section(tree)); assert.equal(sheet(tree), undefined); assert.equal(e.m.navigationCalls, 0); assert.equal(e.m.pageMounts, 0);
  if (outcome === 'offline' || outcome === 'identity-mismatch') {
    e.m.target = old; button(elements(tree).find((el) => el.props.role === 'alert'), '重试').props.onClick();
    assert.equal(sheet(await e.pump()).props.date.id, 'a');
  } else assert.ok(e.calls.filter((c: any) => c[0] === 'home').length > reads);
}));

test('Home direct rapid A1→B→A2 tickets publish only A2, even when A1 returns last', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); const requests = [deferred(), deferred(), deferred()]; let n = 0;
  e.m.target = () => requests[n++].promise;
  const a = items(tree).find((el) => el.props['data-important-date-id'] === 'a');
  const b = items(tree).find((el) => el.props['data-important-date-id'] === 'b');
  button(a, '打开重要日 同名').props.onClick(); await e.pump();
  button(b, '打开重要日 同名').props.onClick(); await e.pump();
  button(a, '打开重要日 同名').props.onClick(); await e.pump();
  const aFresh = { ...e.m.rows.find((r: any) => r.id === 'a'), name: 'A2 canonical' };
  requests[2].resolve({ status: 'ready', date: aFresh, space: shared }); tree = await e.pump(); assert.equal(sheet(tree).props.date, aFresh);
  requests[1].resolve({ status: 'ready', date: e.m.rows[0], space: personal });
  requests[0].resolve({ status: 'ready', date: { ...aFresh, name: 'A1 stale' }, space: shared });
  assert.equal(sheet(await e.pump()).props.date, aFresh); assert.equal(n, 3);
  sheet(e.render()).props.onCancel(); assert.equal(sheet(await e.pump()), undefined);
}));

for (const boundary of ['cancel', 'unmount', 'sign-out', 'user-switch', 'membership-loss', 'module-disable', 'role-change']) test(`Home direct pending target rejects late result after ${boundary}`, () => runtime(async (e) => {
  const standalone = ['membership-loss', 'role-change'].includes(boundary);
  if (standalone) { e.home(); e.props.importantDatesEntry = { memberSpaces: spaces, eligibleSpaces: spaces }; } else e.app();
  let tree = await e.pump(); const late = deferred();
  e.m.target = () => late.promise; button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump();
  assert.ok(section(tree)); assert.equal(sheet(tree), undefined);
  if (boundary === 'cancel') button(tree, '取消打开重要日').props.onClick();
  if (boundary === 'unmount') button(tree, '日历').props.onClick();
  if (boundary === 'sign-out') for (const fn of [...e.auth]) fn('SIGNED_OUT', null);
  if (boundary === 'user-switch') { e.m.userId = 'other'; for (const fn of [...e.auth]) fn('SIGNED_IN', { user: { id: 'other' } }); }
  if (boundary === 'membership-loss') e.m.members = [personal];
  if (boundary === 'module-disable') e.m.eligible = [personal];
  if (boundary === 'role-change') { const next = { ...shared, membershipRole: 'owner' }; e.m.members = [personal, next]; e.m.eligible = [personal, next]; }
  if (standalone) { e.props.spaces = e.m.members; e.props.importantDatesEntry = { memberSpaces: e.m.members, eligibleSpaces: e.m.eligible }; }
  await e.pump(); late.resolve({ status: 'ready', date: e.m.rows.find((r: any) => r.id === 'a'), space: shared });
  tree = await e.pump(); assert.equal(sheet(tree), undefined); assert.equal(e.calls.filter((c: any) => c[0] === 'update' || c[0] === 'delete').length, 0);
}));

for (const loss of ['membership', 'module', 'role', 'sign-out', 'close']) test(`Home direct old save callback loses authority on ${loss}`, () => runtime(async (e) => {
  e.home(); e.props.importantDatesEntry = { memberSpaces: spaces, eligibleSpaces: spaces }; let tree = await e.pump(); button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump(); const stale = sheet(tree);
  if (loss === 'membership') e.m.members = [personal];
  if (loss === 'module') e.m.eligible = [personal];
  if (loss === 'role') { const next = { ...shared, membershipRole: 'owner' }; e.m.members = [personal,next]; e.m.eligible = [personal,next]; }
  if (loss === 'sign-out') for (const fn of [...e.auth]) fn('SIGNED_OUT', null);
  if (loss === 'close') stale.props.onCancel();
  e.props.spaces = e.m.members; e.props.importantDatesEntry = { memberSpaces: e.m.members, eligibleSpaces: e.m.eligible };
  await e.pump(); assert.equal(sheet(e.render()), undefined);
  await assert.rejects(stale.props.onSubmit({ ...stale.props.date, name: 'stale write' }, shared.id), /当前无法保存/);
  assert.equal(e.calls.some((c: any) => c[0] === 'update'), false);
}));


test('Home direct save/delete errors preserve Home rows, report failure and never claim success', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump();
  const old = sheet(tree); const pending = deferred(); const reads = e.calls.filter((c: any) => c[0] === 'home').length;
  e.m.home = () => { e.calls.push(['home']); return pending.promise; };
  e.m.update = async () => { throw Error('mutation offline'); };
  await assert.rejects(old.props.onSubmit({ ...old.props.date, name: 'unconfirmed' }, shared.id), /mutation offline/);
  tree = await e.pump(); assert.ok(sheet(tree)); assert.equal(items(tree).length, 3);
  assert.equal(e.calls.filter((c: any) => c[0] === 'home').length, reads + 1);
  assert.doesNotMatch(renderToStaticMarkup(section(tree)), /unconfirmed|正在读取/);
  old.props.onDelete(); tree = await e.pump(); e.m.remove = async () => { throw Error('delete offline'); };
  elements(tree).find((el) => el.type?.name === 'ImportantDateDeleteDialog').props.onConfirm(); tree = await e.pump();
  const dialog = elements(tree).find((el) => el.type?.name === 'ImportantDateDeleteDialog');
  assert.match(dialog.props.error, /删除未确认成功/); assert.equal(dialog.props.busy, false); assert.equal(items(tree).length, 3);
  dialog.props.onCancel(); assert.ok(section(await e.pump()));
}));

for (const write of ['save', 'delete']) test(`Home direct late ${write} result never closes or reconciles a newer target`, () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump();
  const late = deferred(); let operation: any;
  if (write === 'save') { e.m.update = () => late.promise; operation = sheet(tree).props.onSubmit(sheet(tree).props.date, shared.id); }
  else { sheet(tree).props.onDelete(); tree = await e.pump(); e.m.remove = () => late.promise;
    elements(tree).find((el) => el.type?.name === 'ImportantDateDeleteDialog').props.onConfirm(); }
  button(items(tree).find((el) => el.props['data-important-date-id'] === 'b'), '打开重要日 同名').props.onClick(); tree = await e.pump();
  assert.equal(sheet(tree).props.date.id, 'b'); const reads = e.calls.filter((c: any) => c[0] === 'home').length;
  late.resolve(undefined); await operation; tree = await e.pump();
  assert.equal(sheet(tree).props.date.id, 'b'); assert.equal(e.calls.filter((c: any) => c[0] === 'home').length, reads);
}));

test('Home direct transient pending→valid hint leaves the already qualified editor actionable with one read', () => runtime(async (e) => {
  e.home(); e.props.importantDatesEntry = null; let tree = await e.pump();
  button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump(); assert.ok(sheet(tree));
  const reads = e.calls.filter((c: any) => c[0] === 'target').length;
  e.props.importantDatesEntry = { memberSpaces: spaces, eligibleSpaces: spaces }; tree = await e.pump();
  await sheet(tree).props.onSubmit(sheet(tree).props.date, shared.id);
  assert.equal(e.calls.filter((c: any) => c[0] === 'target').length, reads); assert.ok(section(await e.pump()));
}));

test('Home direct changing targets masks an old target error before effects run', () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); e.m.target = async () => { throw Error('network'); };
  button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump();
  assert.match(renderToStaticMarkup(tree), /重要日目标读取失败/);
  e.m.target = () => new Promise(() => {});
  button(items(tree).find((el) => el.props['data-important-date-id'] === 'b'), '打开重要日 同名').props.onClick();
  assert.doesNotMatch(renderToStaticMarkup(e.render()), /重要日目标读取失败/);
}));

for (const kind of ['event', 'task']) test(`Home pending Important Date cannot cover a subsequently opened ${kind} Sheet`, () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); const pending = deferred(); e.m.target = () => pending.promise;
  button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump();
  (kind === 'event' ? eventButton(tree) : taskButton(tree)).props.onClick(); tree = await e.pump();
  assert.ok(kind === 'event' ? eventEditor(tree) : taskEditor(tree));
  pending.resolve({ status: 'ready', date: e.m.rows.find((r: any) => r.id === 'a'), space: shared }); tree = await e.pump();
  assert.equal(sheet(tree), undefined); assert.ok(kind === 'event' ? eventEditor(tree) : taskEditor(tree));
}));


for (const kind of ['event', 'task']) test(`Home pending ${kind} cannot cover a subsequently opened Important Date Sheet`, () => runtime(async (e) => {
  e.app(); let tree = await e.pump(); const pending = deferred();
  if (kind === 'event') { e.m.events = () => pending.promise; e.dispatch('focus'); tree = await e.pump(); }
  else e.m.exactTaskRead = () => pending.promise;
  (kind === 'event' ? eventButton(tree) : taskButton(tree)).props.onClick(); tree = await e.pump();
  button(items(tree)[0], '打开重要日 同名').props.onClick(); tree = await e.pump(); assert.equal(sheet(tree).props.date.id, 'a');
  pending.resolve(kind === 'event' ? { occurrences: e.m.eventRows, membersBySpaceId: { shared: [{ user_id: 'me', space_id: 'shared', profiles: { display_name: '我' } }] } } : { data: e.m.taskRows[0], error: null });
  tree = await e.pump(); assert.equal(sheet(tree).props.date.id, 'a');
  assert.equal(kind === 'event' ? eventEditor(tree) : taskEditor(tree), undefined);
}));
