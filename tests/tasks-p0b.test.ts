import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { createServer } from 'vite';
import { groupTasks } from '../src/lib/task.ts';

const a = { id: 'a', name: '空间 A', kind: 'shared', membershipRole: 'owner', created_by: 'me' };
const b = { ...a, id: 'b', name: '空间 B', membershipRole: 'member' };
const task = (id = 't', space_id = 'a', status = 'open', assigned_to_user_id: string | null = null) => ({
  id, space_id, title: id, status, assigned_to_user_id, due_on: null, created_by: 'me', created_at: '2026-10-05', updated_at: '2026-10-05',
});
const member = (space_id: string) => ({ space_id, user_id: 'me', role: 'owner', profiles: { display_name: '我' } });
const snapshot = (filter: any = { spaceId: 'a' }, rows: any[] = [task()]) => ({
  filter, memberSpaces: [a, b], eligibleSpaces: [a, b], grouped: groupTasks(rows as any),
  sourceSpacesById: { a, b }, membersBySpaceId: { a: [member('a')], b: [member('b')] },
});
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise((yes) => { resolve = yes; }); return { resolve, promise }; };
const elements = (node: any): any[] => React.isValidElement(node) ? [node, ...React.Children.toArray((node.props as any).children).flatMap(elements)] : [];
const text = (node: any): string => React.isValidElement(node) ? React.Children.toArray((node.props as any).children).map(text).join('') : typeof node === 'string' ? node : '';
const button = (tree: any, label: string) => elements(tree).find((el) => el.type === 'button' && (el.props['aria-label'] === label || text(el) === label));
const rows = (tree: any) => elements(tree).filter((el) => el.type === 'li').map((el) => el.props['data-task-id']);

// Real TasksArea, aggregate loader, eligibility reader and editor qualification.
// Only React scheduling and external I/O are injected, with explicit barriers.
async function runtime(run: (env: any) => Promise<void>) {
  let active: any;
  const mounts = new Map<string, any>(); const auth = new Set<any>(); const calls: any[] = [];
  const m: any = { userId: 'me', members: [a, b], enabled: ['a', 'b'], tasks: [task()],
    useState(initial: any) { const i = active.cursor++; if (!(i in active.slots)) active.slots[i] = typeof initial === 'function' ? initial() : initial;
      const mount = active; return [mount.slots[i], (value: any) => { mount.slots[i] = typeof value === 'function' ? value(mount.slots[i]) : value; }]; },
    useRef(value: any) { return active.slots[active.cursor++] ??= { current: value }; },
    useCallback(fn: any, deps: any[]) { const i = active.cursor++; if (!active.slots[i] || deps.some((v, n) => v !== active.slots[i].deps[n])) active.slots[i] = { fn, deps }; return active.slots[i].fn; },
    useEffect(fn: any, deps: any[]) { const i = active.cursor++; if (!active.slots[i] || deps.some((v, n) => v !== active.slots[i][n])) { active.slots[i] = deps; active.effects.push({ i, fn }); } },
  };
  m.supabase = {
    auth: { getUser: async () => { calls.push(['auth']); return { data: { user: { id: m.userId } }, error: null }; },
      onAuthStateChange(fn: any) { auth.add(fn); return { data: { subscription: { unsubscribe: () => auth.delete(fn) } } }; } },
    from(table: string) {
      const filters: any = {}; let mutation: any;
      const matches = () => m.tasks.filter((t: any) => Object.entries(filters).every(([k, v]) => t[k] === v));
      const query: any = {
        select: () => query, eq: (k: string, v: any) => { filters[k] = v; return query; }, order: () => query,
        update: (value: any) => { mutation = value; return query; },
        range: async () => {
          if (table === 'space_modules') { calls.push(['modules']); const data = m.members.map((s: any) => ({ space_id: s.id, enabled: m.enabled.includes(s.id) })); return { data, count: data.length, error: null }; }
          assert.equal(table, 'tasks'); calls.push(['list', filters.space_id]);
          if (m.listRead) return m.listRead(filters.space_id);
          const data = structuredClone(matches()); return { data, count: data.length, error: null };
        },
        maybeSingle: async () => { assert.equal(table, 'tasks'); calls.push(['exact', { ...filters }]);
          if (m.exactRead) return m.exactRead({ ...filters });
          return { data: structuredClone(matches()[0] ?? null), error: null }; },
        then: (yes: any, no: any) => {
          assert.equal(table, 'tasks'); assert.ok(mutation); calls.push(['update', { ...filters }, mutation]);
          const data = matches(); for (const row of data) Object.assign(row, mutation);
          return Promise.resolve({ data: data.map((row: any) => ({ id: row.id })), error: null }).then(yes, no);
        },
      }; return query;
    },
    channels: [] as any[], channel(name: string) { const channel: any = { name,
      on: (_e: any, config: any, changed: any) => { channel.config = config; channel.change = changed; return channel; },
      subscribe: (fn: any) => { channel.status = fn; fn('SUBSCRIBED'); return channel; } };
      m.supabase.channels.push(channel); return channel; },
    removeChannel(channel: any) { calls.push(['remove', channel.name]); m.supabase.channels = m.supabase.channels.filter((c: any) => c !== channel); },
  };
  (globalThis as any).__tasksP0b = m;
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{
      name: 'tasks-p0b-fixture', enforce: 'pre',
      resolveId(id, importer) {
        if (id === 'react' && importer?.includes('/components/')) return '\0task-hooks';
        if (/\/supabase(?:\.ts)?$/.test(id)) return '\0task-client';
        if (/\/current-spaces(?:\.ts)?$/.test(id)) return '\0task-spaces';
        if (/\/space-members(?:\.ts)?$/.test(id)) return '\0task-members';
      },
      load(id) { const prefix = 'const m=globalThis.__tasksP0b;';
        if (id === '\0task-hooks') return prefix + 'export const {useState,useRef,useEffect,useCallback}=m;';
        if (id === '\0task-client') return prefix + 'export const supabase=m.supabase;';
        if (id === '\0task-spaces') return prefix + 'export const listCurrentSpaces=async()=>m.members;';
        if (id === '\0task-members') return prefix + 'export const readSpaceMembers=async(id)=>m.membersRead?m.membersRead(id):m.members.some(s=>s.id===id)?[{space_id:id,user_id:"me",role:"owner",profiles:{display_name:"我"}}]:[];';
      },
    }] } as any);
  const stop = (mount: any) => { for (const fn of mount.cleanups.values()) fn(); };
  try {
    const { TasksArea } = await vite.ssrLoadModule('/src/components/TasksArea.tsx');
    const props: any = { screen: 'tasks', userId: 'me', entry: { memberSpaces: [a, b], eligibleSpaces: [a, b] },
      initialData: snapshot(), onScreenChange: (screen: string) => { props.screen = screen; }, onHubBack() {}, onValidated: (data: any) => calls.push(['validated', data]), onInvalidateEligibility: () => calls.push(['invalidate']) };
    const execute = (key: string, fn: any, arg: any) => {
      if (!mounts.has(key)) mounts.set(key, { slots: [], cleanups: new Map(), effects: [], cursor: 0 });
      active = mounts.get(key); active.cursor = 0; return fn(arg);
    };
    const render = () => {
      const expand = (node: any, path: string): any => {
        if (!React.isValidElement(node)) return node;
        if (typeof node.type === 'function' && ['TaskRows', 'TaskFilterPicker'].includes(node.type.name)) return expand(execute(path, node.type, node.props), path);
        return React.cloneElement(node, undefined, ...React.Children.toArray((node.props as any).children).map((child, i) => expand(child, path + ':' + i)));
      };
      return expand(execute('root', TasksArea, props), 'root');
    };
    const pump = async () => { for (let i = 0; i < 6; i++) { render(); for (const mount of mounts.values()) for (const { i, fn } of mount.effects.splice(0)) {
      mount.cleanups.get(i)?.(); const cleanup = fn(); if (cleanup) mount.cleanups.set(i, cleanup); else mount.cleanups.delete(i);
    } await new Promise((resolve) => setTimeout(resolve, 0)); } return render(); };
    const choose = (id: string) => elements(render()).find((el) => el.type === 'select').props.onChange({ target: { value: id } });
    const updates = () => calls.filter(([name]) => name === 'update');
    const session = (id: string | null) => { m.userId = id; for (const fn of auth) fn(id ? 'SIGNED_IN' : 'SIGNED_OUT', id ? { user: { id } } : null); };
    const unmount = () => { for (const mount of mounts.values()) stop(mount); mounts.clear(); };
    const flush = async () => { for (let i = 0; i < 4; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };
    await run({ m, props, calls, render, pump, choose, updates, session, unmount, flush });
  } finally { for (const mount of mounts.values()) stop(mount); await vite.close(); delete (globalThis as any).__tasksP0b; }
}

test('new filter first read failure leaves loading, exposes retry for that filter, and recovers', async () => runtime(async ({ m, calls, choose, pump, render }) => {
  await pump(); m.listRead = async () => ({ data: null, count: null, error: new Error('读取失败，请重试。') }); choose('b');
  const failed = await pump(); assert.doesNotMatch(text(failed), /正在读取任务/); assert.match(text(failed), /读取失败/);
  assert.deepEqual(rows(failed), []); assert.equal(elements(failed).find((el) => el.type === 'select').props.value, 'b');
  m.listRead = undefined; m.tasks = [task('b-fresh', 'b')]; const before = calls.length;
  await button(render(), '重试').props.onClick(); assert.deepEqual(rows(await pump()), ['b-fresh']);
  assert.ok(calls.slice(before).some((c: any) => c[0] === 'list' && c[1] === 'b'));
  assert.ok(!calls.slice(before).some((c: any) => c[0] === 'list' && c[1] === 'a'));
}));

test('safe current-filter presentation survives failed refresh and retry', async () => runtime(async ({ m, pump, render }) => {
  await pump(); m.listRead = async () => ({ data: null, count: null, error: new Error('更新失败，请重试。') });
  m.supabase.channels[0].change(); const failed = await pump(); assert.deepEqual(rows(failed), ['t']);
  assert.match(text(failed), /更新失败/); assert.doesNotMatch(text(failed), /正在读取任务/);
  m.listRead = undefined; m.tasks = [task('replacement')]; await button(render(), '重试').props.onClick();
  const fresh = await pump(); assert.deepEqual(rows(fresh), ['replacement']); assert.doesNotMatch(text(fresh), /更新失败/);
}));

test('A1 → B → A2 rejects both late success and late filter error', async () => runtime(async ({ m, pump, choose, render }) => {
  await pump(); const a1 = deferred(), b1 = deferred(), a2 = deferred(); let aCalls = 0;
  m.listRead = (id: string) => id === 'a' ? (++aCalls === 1 ? a1.promise : a2.promise) : b1.promise;
  m.supabase.channels[0].change(); await pump(); choose('b'); await pump(); choose('a'); await pump();
  a2.resolve({ data: [task('current-a2')], count: 1, error: null }); await pump();
  a1.resolve({ data: [task('obsolete-a1')], count: 1, error: null }); b1.resolve({ data: null, count: null, error: new Error('旧 B 失败') });
  const current = await pump(); assert.deepEqual(rows(current), ['current-a2']); assert.doesNotMatch(text(current), /旧 B/);
  assert.equal(elements(render()).find((el) => el.type === 'select').props.value, 'a');
}));

test('returning to still-valid last filter retains its presentation on failure without caching other filters', async () => runtime(async ({ m, pump, choose }) => {
  await pump(); const pendingB = deferred(); m.listRead = (id: string) => id === 'b' ? pendingB.promise : Promise.resolve({ data: null, count: null, error: new Error('A 更新失败') });
  choose('b'); await pump(); choose('a'); const failed = await pump();
  assert.deepEqual(rows(failed), ['t']); assert.match(text(failed), /A 更新失败/); assert.doesNotMatch(text(failed), /正在读取任务/);
  pendingB.resolve({ data: [], count: 0, error: null }); await pump();
}));

for (const [label, displayed, freshStatus, action, expected] of [
  ['complete fresh open', 'open', 'open', '完成 t', 'completed'],
  ['stale completed cannot complete', 'open', 'completed', '完成 t', null],
  ['reopen fresh completed', 'completed', 'completed', '重新打开 t', 'open'],
  ['stale open cannot reopen', 'completed', 'open', '重新打开 t', null],
] as const) test(label, async () => runtime(async ({ m, props, pump, render, calls, updates }) => {
  m.tasks = [task('t', 'a', displayed)]; props.initialData = snapshot({ spaceId: 'a' }, m.tasks);
  props.screen = displayed === 'completed' ? 'completed' : 'tasks'; await pump();
  m.tasks = [task('t', 'a', freshStatus)]; await button(render(), action).props.onClick(); const final = await pump();
  assert.equal(updates().length, expected ? 1 : 0); assert.ok(calls.some((c: any) => c[0] === 'exact'));
  if (expected) { assert.equal(m.tasks[0].status, expected); assert.deepEqual(updates()[0][1], { space_id: 'a', id: 't', status: freshStatus }); }
  else { assert.match(text(final), /任务已变化|状态已变化/); assert.deepEqual(rows(final), []); }
}));

for (const loss of ['deleted', 'disabled', 'membership', 'member records', 'reassigned', 'auth'] as const)
  test('fresh quick qualification refuses ' + loss, async () => runtime(async ({ m, pump, render, updates, calls }) => {
    await pump();
    if (loss === 'deleted') m.tasks = [];
    if (loss === 'disabled') m.enabled = ['b'];
    if (loss === 'membership') m.members = [b];
    if (loss === 'member records') m.membersRead = async () => [];
    if (loss === 'reassigned') m.tasks[0].assigned_to_user_id = 'other';
    if (loss === 'auth') m.userId = 'other';
    await button(render(), '完成 t').props.onClick(); const final = await pump(); assert.equal(updates().length, 0);
    assert.ok(calls.some((c: any) => c[0] === 'invalidate')); assert.ok(elements(final).some((el) => el.props.role === 'alert'));
  }));

for (const change of ['filter', 'A→B→A filter', 'batched A→B→A filter', 'scope', 'role', 'module', 'user prop', 'auth A→B→A', 'logout', 'unmount'] as const)
  test('late exact request cannot quick-mutate after ' + change, async () => runtime(async ({ m, props, pump, render, choose, session, unmount, updates, flush }) => {
    await pump(); const exact = deferred(); m.exactRead = () => exact.promise;
    const action = button(render(), '完成 t').props.onClick(); await pump();
    if (change === 'filter') { choose('b'); await pump(); }
    if (change === 'A→B→A filter') { choose('b'); await pump(); choose('a'); await pump(); }
    if (change === 'batched A→B→A filter') { choose('b'); choose('a'); await pump(); }
    if (change === 'scope') { props.entry = { memberSpaces: [b], eligibleSpaces: [b] }; await pump(); }
    if (change === 'role') { const changedA = { ...a, membershipRole: 'member' }; props.entry = { memberSpaces: [changedA, b], eligibleSpaces: [changedA, b] }; await pump(); }
    if (change === 'module') { props.entry = { memberSpaces: [a, b], eligibleSpaces: [b] }; await pump(); }
    if (change === 'user prop') { props.userId = 'other'; m.userId = 'other'; await pump(); }
    if (change === 'auth A→B→A') { session('other'); session('me'); }
    if (change === 'logout') session(null);
    if (change === 'unmount') unmount();
    exact.resolve({ data: task(), error: null }); await action; await flush(); assert.equal(updates().length, 0);
  }));

test('openTask shares the fresh exact qualification and never initializes Sheet with retained payload', async () => runtime(async ({ m, pump, render, calls }) => {
  await pump(); m.tasks[0].title = 'canonical title'; await button(render(), '打开任务 t，空间 A').props.onClick();
  const tree = await pump(); const sheet = elements(tree).find((el) => el.type?.name === 'TaskSheet');
  assert.equal(sheet.props.task.title, 'canonical title'); assert.equal(calls.filter((c: any) => c[0] === 'exact').length, 1);
}));

test('conditional quick update rejects a status change between exact read and mutation', async () => runtime(async ({ m, pump, render, updates }) => {
  await pump(); m.membersRead = async () => { m.tasks[0].status = 'completed'; return [member('a')]; };
  await button(render(), '完成 t').props.onClick(); const final = await pump();
  assert.equal(updates().length, 1); assert.equal(updates()[0][1].status, 'open'); assert.equal(m.tasks[0].status, 'completed');
  assert.match(text(final), /任务已变化/);
}));

test('confirmed scope/module loss hides retained rows, fresh read replaces rather than publishing partial data', async () => runtime(async ({ props, pump, render }) => {
  await pump(); props.entry = { memberSpaces: [a, b], eligibleSpaces: [b] };
  assert.deepEqual(rows(render()), []); const fresh = await pump(); assert.deepEqual(rows(fresh), []);
  assert.equal(elements(fresh).find((el) => el.type === 'select').props.value, 'all');
}));

test('Realtime refresh keeps original one-Space channels and all unmount cleanups', async () => runtime(async ({ m, pump, choose, unmount, calls }) => {
  await pump(); assert.deepEqual(m.supabase.channels.map((c: any) => c.config.filter), ['space_id=eq.a']);
  choose('b'); await pump(); assert.deepEqual(m.supabase.channels.map((c: any) => c.config.filter), ['space_id=eq.b']);
  unmount(); assert.equal(m.supabase.channels.length, 0); assert.ok(calls.some((c: any) => c[0] === 'remove'));
}));

test('cold initial failure has error/retry and never publishes a failed snapshot', async () => runtime(async ({ m, props, pump, render, calls }) => {
  props.initialData = undefined; m.listRead = async () => ({ data: null, count: null, error: new Error('首次任务读取失败') });
  const failed = await pump(); assert.match(text(failed), /首次任务读取失败/); assert.doesNotMatch(text(failed), /正在读取任务/);
  assert.ok(button(failed, '重试')); assert.ok(!calls.some((c: any) => c[0] === 'validated'));
  m.listRead = undefined; await button(render(), '重试').props.onClick(); assert.deepEqual(rows(await pump()), ['t']);
}));

test('retained quick action waits for exact qualification and synchronous duplicate clicks issue one update', async () => runtime(async ({ m, pump, render, updates, calls }) => {
  const exact = deferred(); m.exactRead = () => exact.promise; await pump();
  const click = button(render(), '完成 t').props.onClick; const first = click(), second = click(); await pump();
  assert.deepEqual(rows(render()), ['t']); assert.equal(updates().length, 0);
  assert.equal(calls.filter((c: any) => c[0] === 'exact').length, 1);
  exact.resolve({ data: task(), error: null }); await Promise.all([first, second]); await pump(); assert.equal(updates().length, 1);
}));

test('unknown eligibility during quick qualification is not confirmed scope loss', async () => runtime(async ({ m, props, pump, render, updates, flush }) => {
  await pump(); const exact = deferred(); m.exactRead = () => exact.promise;
  const pending = button(render(), '完成 t').props.onClick(); await pump(); props.entry = null; props.entryPending = true; await pump();
  exact.resolve({ data: task(), error: null }); await pending; await flush(); assert.equal(updates().length, 1);
}));

test('mismatched canonical identity refuses quick mutation', async () => runtime(async ({ m, pump, render, updates }) => {
  await pump(); m.exactRead = async () => ({ data: task('other', 'b'), error: null });
  await button(render(), '完成 t').props.onClick(); assert.match(text(await pump()), /任务已变化/); assert.equal(updates().length, 0);
}));

test('cancelled open qualification cannot publish stale Sheet or leave new-filter rows disabled', async () => runtime(async ({ m, pump, choose, render }) => {
  await pump(); const exact = deferred(); m.exactRead = () => exact.promise;
  const opening = button(render(), '打开任务 t，空间 A').props.onClick(); await pump(); choose('b'); m.tasks = [task('new-b', 'b')]; await pump();
  exact.resolve({ data: task(), error: null }); await opening; const tree = await pump();
  assert.ok(!elements(tree).some((el) => el.type?.name === 'TaskSheet'));
  assert.equal(button(tree, '打开任务 new-b，空间 B').props.disabled, false);
}));
