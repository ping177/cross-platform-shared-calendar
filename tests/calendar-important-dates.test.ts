import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const personal = { id: 'personal', name: '私人', kind: 'personal', membershipRole: 'owner' };
const shared = { ...personal, id: 'shared', name: '旅行空间', kind: 'shared', membershipRole: 'member' };
const day = new Date(2026, 9, 10);
const occurrence = (spaceId = shared.id, importantDateId = 'important') => ({ spaceId, importantDateId,
  occurrenceDate: { year: 2026, month: 10, day: 10 }, name: '同名重要日', emoji: '❤️' });
const noop = () => undefined;
const tick = () => new Promise((resolve) => setTimeout(resolve, 1));
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise((yes) => { resolve = yes; }); return { resolve, promise }; };
const nodes = (node: any): any[] => React.isValidElement(node) ? [node, ...React.Children.toArray((node.props as any).children).flatMap(nodes)] : [];
const button = (tree: any, label: string) => nodes(tree).find((el) => el.type === 'button' && (el.props['aria-label'] === label || el.props.children === label));
const sheet = (tree: any) => nodes(tree).find((el) => el.type?.name === 'ImportantDateSheet');
const row = (id = 'important', space_id = shared.id, fields = {}) => ({ id, space_id, name: '同名重要日', emoji: '❤️', repeat_kind: 'none', year: 2026, month: 10, day: 10,
  reminder_kind: 'all_day_same_day_08', time_zone: 'Asia/Shanghai', reminder_schedule_changed_at: '2026-10-01T00:00:00.123456Z', ...fields });

// Real Calendar, projection, target and editor handlers; only canonical I/O is
// injected. No authenticated browser, network, RPC or persistent data is used.
async function runtime(run: (env: any) => Promise<void>) {
  const previous = { window: (globalThis as any).window, document: (globalThis as any).document };
  let latest: any, latestEvents: any; let cursor = 0; const slots: any[] = []; const effects: any[] = []; const cleanups = new Map();
  const listeners = new Map<string, Set<any>>(); const auth = new Set<any>(); const calls: any[] = []; const timers = new Set<any>();
  const surface = { visibilityState: 'visible', addEventListener(key: string, fn: any) { if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key)!.add(fn); }, removeEventListener(key: string, fn: any) { listeners.get(key)?.delete(fn); } };
  const m: any = { timeZone: 'Asia/Shanghai', rows: [row()], members: [personal, shared], eligible: [personal, shared], userId: 'me', eventFailure: false, dateFailure: false,
    timer: (fn: any) => { timers.add(fn); return fn; }, clearTimer: (fn: any) => timers.delete(fn),
    useState(initial: any) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value: any) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(value: any) { return slots[cursor++] ??= { current: value }; },
    useCallback(fn: any, deps: any[]) { const i = cursor++; if (!slots[i] || deps.length !== slots[i].deps.length || deps.some((v, n) => v !== slots[i].deps[n])) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn: any, deps: any[]) { const i = cursor++; if (!slots[i] || deps.length !== slots[i].length || deps.some((v, n) => v !== slots[i][n])) { slots[i] = deps; effects.push({ i, fn }); } },
    events: async () => { calls.push(['events']); if (m.eventFailure) throw new Error('日程读取失败'); return { events: [{ id: 'event', space_id: shared.id, scope: 'shared', owner_user_id: null,
      recurrence_rule: null, title: '普通日程', starts_at: new Date(2026, 9, 10, 12).toISOString(), ends_at: null, all_day: false }], exceptions: [], membersBySpaceId: { personal: [{ user_id: 'me', space_id: personal.id }], shared: [{ user_id: 'me', space_id: shared.id }] } }; },
    dates: async (_user: any, ids: any, range: any, _client: any, _spaces: any, qualify: any) => {
      calls.push(['projection', [...ids], range]); const scope = { memberSpaces: m.members, eligibleSpaces: m.eligible }; qualify?.(scope);
      if (m.dateFailure) throw new Error('重要日读取失败');
      return { ...scope, dates: m.rows.filter((r: any) => ids.includes(r.space_id) && m.eligible.some((s: any) => s.id === r.space_id)) };
    },
    target: async (_user: any, { spaceId, importantDateId: id }: any) => {
      calls.push(['target', spaceId, id]); const date = m.rows.find((r: any) => r.space_id === spaceId && r.id === id);
      const space = m.eligible.find((s: any) => s.id === spaceId);
      return date && space ? { status: 'ready', date, space } : { status: 'missing' };
    },
    update: async (_client: any, _user: any, date: any, draft: any) => { calls.push(['update', date]); m.rows = m.rows.map((r: any) => r.space_id === date.space_id && r.id === date.id ? { ...r, ...draft } : r); },
    delete: async (_client: any, _user: any, date: any) => { calls.push(['delete', date]); m.rows = m.rows.filter((r: any) => r.space_id !== date.space_id || r.id !== date.id); },
  };
  m.useMemo = (fn: any, deps: any[]) => {
    const i = cursor++;
    if (!slots[i] || deps.length !== slots[i].deps.length || deps.some((v, n) => v !== slots[i].deps[n])) slots[i] = { value: fn(), deps };
    return slots[i].value;
  };
  const channels: any[] = [];
  m.supabase = { auth: { onAuthStateChange(fn: any) { auth.add(fn); return { data: { subscription: { unsubscribe: () => auth.delete(fn) } } }; } },
    channel(name: string) { calls.push(['channel', name]); const c: any = { on(_e: any, config: any, fn: any) { c.changed = fn; c.config = config; return c; }, subscribe(fn: any) { c.status = fn; fn('SUBSCRIBED'); return c; } }; channels.push(c); return c; },
    removeChannel(c: any) { channels.splice(channels.indexOf(c), 1); }, from() { throw new Error('Unexpected database call'); }, rpc() { throw new Error('No RPC allowed'); } };
  (globalThis as any).__calendarDates = m;
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{
      name: 'calendar-important-date-runtime', enforce: 'pre',
      resolveId(id, importer) {
        if (id === 'react' && (importer?.includes('/components/') || importer?.endsWith('/App.tsx'))) return '\0calendar-hooks';
        if (/\/supabase(?:\.ts)?$/.test(id)) return '\0calendar-client';
      },
      load(id) { if (id === '\0calendar-hooks') return 'export const {useState,useRef,useEffect,useCallback,useMemo}=globalThis.__calendarDates;';
        if (id === '\0calendar-client') return 'export const supabase=globalThis.__calendarDates.supabase;'; },
      transform(code, id) {
        if (id.endsWith('/useImportantDateProjection.ts') || id.endsWith('/calendar-event-view.ts')) return code.replace('Intl.DateTimeFormat().resolvedOptions().timeZone', 'globalThis.__calendarDates.timeZone');
        if (id.endsWith('/calendar-refresh.ts')) return code.replace(/setTimeout\(/g, 'globalThis.__calendarDates.timer(').replace(/clearTimeout\(/g, 'globalThis.__calendarDates.clearTimer(');
        if (id.endsWith('/important-dates-data.ts')) {
          for (const [name, mock] of Object.entries({ loadCalendarImportantDates: 'dates', readImportantDateTarget: 'target', updateImportantDate: 'update', deleteImportantDate: 'delete' }))
            code = code.replace(`export async function ${name}(`, `async function original${name}(`) + `\nexport const ${name}=(...args)=>globalThis.__calendarDates.${mock}(...args);`;
          return code;
        }
        if (id.endsWith('/aggregate-calendar.ts')) return code.replace('export async function readAggregateCalendar(', 'async function originalReadAggregateCalendar(') + '\nexport const readAggregateCalendar=(...args)=>globalThis.__calendarDates.events(...args);';
      },
    }] } as any);
  const unmount = () => { for (const fn of cleanups.values()) fn(); cleanups.clear(); slots.length = 0; effects.length = 0; };
  try {
    const { CurrentSpaceApp } = await vite.ssrLoadModule('/src/App.tsx');
    (globalThis as any).window = surface; (globalThis as any).document = surface;
    const props: any = { session: { user: { id: 'me' } }, spaces: [personal, shared], allSpaces: [personal, shared], importantDatesEntry: { memberSpaces: m.members, eligibleSpaces: m.eligible },
      onCalendarEventsValidated: (data: any) => { latestEvents = data; }, onCalendarEventsInvalidate: () => { latestEvents = undefined; },
      onCalendarImportantDatesValidated: (data: any) => { latest = data; }, onCalendarImportantDatesInvalidate: () => { latest = undefined; },
      calendarFilter: 'all', onCalendarFilterChange: noop, selectedDate: day, onSelectedDateChange: noop, viewMode: 'week', onViewModeChange: noop };
    const expand = (node: any): any => {
      if (!React.isValidElement(node)) return node;
      if (typeof node.type === 'function' && ['CalendarViews', 'MonthView', 'DaySection', 'CalendarImportantDateCard', 'CalendarImportantDateStatus', 'CalendarImportantDateSheets'].includes(node.type.name)) return expand(node.type(node.props));
      return React.cloneElement(node, undefined, ...React.Children.toArray((node.props as any).children).map(expand));
    };
    const render = () => { cursor = 0; return expand(CurrentSpaceApp(props)); };
    const pump = async () => { for (let i = 0; i < 6; i++) { render(); for (const { i, fn } of effects.splice(0)) { cleanups.get(i)?.(); const cleanup = fn(); if (cleanup) cleanups.set(i, cleanup); else cleanups.delete(i); } for (const fn of [...timers]) { timers.delete(fn); fn(); } await tick(); } return render(); };
    const dispatch = (key: string) => { for (const fn of [...listeners.get(key) ?? []]) fn(); };
    await run({ m, props, calls, render, pump, unmount, channels, auth, surface, dispatch, latest: () => latest,
      latestEvents: () => latestEvents, restoreEvents: () => { props.initialCalendarEvents = latestEvents; unmount(); },
      restore: () => { props.initialCalendarImportantDates = latest; unmount(); } });
  } finally { unmount(); await vite.close(); delete (globalThis as any).__calendarDates;
    (globalThis as any).window = previous.window; (globalThis as any).document = previous.document; }
}

test('real Calendar opens exact canonical Important Date Sheet in place, closes without date/view/filter changes', () => runtime(async (e) => {
  let tree = await e.pump(); assert.ok(button(tree, '打开重要日 同名重要日'));
  assert.match(renderToStaticMarkup(tree), /普通日程/);
  e.m.rows[0] = { ...e.m.rows[0], name: 'canonical new name' };
  button(tree, '打开重要日 同名重要日').props.onClick(); tree = await e.pump();
  assert.ok(sheet(tree)); assert.equal(sheet(tree).props.date, e.m.rows[0]);
  assert.equal(sheet(tree).props.date.reminder_kind, 'all_day_same_day_08');
  assert.equal(sheet(tree).props.date.time_zone, 'Asia/Shanghai');
  assert.equal(sheet(tree).props.date.reminder_schedule_changed_at, '2026-10-01T00:00:00.123456Z');
  assert.equal(nodes(tree).some((el) => el.type?.name === 'EventSheet'), false);
  sheet(tree).props.onCancel(); assert.equal(sheet(await e.pump()), undefined);
  assert.equal(e.props.selectedDate, day); assert.equal(e.props.viewMode, 'week'); assert.equal(e.props.calendarFilter, 'all');
  assert.deepEqual(e.calls.filter((c: any) => c[0] === 'target'), [['target', shared.id, 'important']]);
}));

test('Important Date failure/retry and unresolved refresh leave Events usable; Event failure leaves Important Dates usable', () => runtime(async (e) => {
  e.m.dateFailure = true; let tree = await e.pump();
  assert.match(renderToStaticMarkup(tree), /普通日程/); assert.match(renderToStaticMarkup(tree), /重要日读取失败/);
  const eventReads = e.calls.filter((c: any) => c[0] === 'events').length;
  e.m.dateFailure = false; const retry = nodes(tree).find((el) => el.type === 'button' && el.props.children === '重试重要日');
  retry.props.onClick(); tree = await e.pump(); assert.ok(button(tree, '打开重要日 同名重要日'));
  assert.equal(e.calls.filter((c: any) => c[0] === 'events').length, eventReads);
  const pending = deferred(); const original = e.m.dates; e.m.dates = () => pending.promise;
  e.dispatch('focus'); tree = await e.pump(); assert.match(renderToStaticMarkup(tree), /普通日程/);
  pending.resolve(await original('me', ['personal', 'shared'], {}, null, null)); await e.pump();
  e.unmount(); e.m.dates = original; e.m.eventFailure = true; tree = await e.pump();
  assert.match(renderToStaticMarkup(tree), /日程读取失败/); assert.ok(button(tree, '打开重要日 同名重要日'));
  button(tree, '打开重要日 同名重要日').props.onClick(); assert.ok(sheet(await e.pump()));
}));

test('Calendar save/delete reconcile bounded sources and never patch occurrences from mutation payload', () => runtime(async (e) => {
  let tree = await e.pump(); button(tree, '打开重要日 同名重要日').props.onClick(); tree = await e.pump();
  // Oct 10 -> Oct 15: outside this visible week; month then discovers Oct 15.
  await sheet(tree).props.onSubmit({ ...e.m.rows[0], day: 15 }, shared.id); tree = await e.pump();
  assert.equal(sheet(tree), undefined); assert.equal(button(tree, '打开重要日 同名重要日'), undefined);
  assert.ok(e.calls.filter((c: any) => c[0] === 'projection').length >= 2);
  e.props.viewMode = 'month'; e.props.selectedDate = new Date(2026, 9, 15); tree = await e.pump();
  assert.ok(button(tree, '打开重要日 同名重要日'));
  button(tree, '打开重要日 同名重要日').props.onClick(); tree = await e.pump(); sheet(tree).props.onDelete(); tree = await e.pump();
  const dialog = nodes(tree).find((el) => el.type?.name === 'ImportantDateDeleteDialog'); assert.ok(dialog);
  await dialog.props.onConfirm(); tree = await e.pump(); assert.equal(button(tree, '打开重要日 同名重要日'), undefined);
  assert.equal(e.m.rows.length, 0); assert.equal(e.props.viewMode, 'month'); assert.equal(e.props.selectedDate.getDate(), 15);
  assert.equal(e.props.calendarFilter, 'all'); assert.match(renderToStaticMarkup(tree), /日历/);
}));

test('annual edits and repeat/start-year changes derive again from canonical result', () => runtime(async (e) => {
  e.props.viewMode = 'month'; e.m.rows = [row('important', shared.id, { repeat_kind: 'annual', year: 2024 })];
  let tree = await e.pump(); button(tree, '打开重要日 同名重要日').props.onClick(); tree = await e.pump();
  await sheet(tree).props.onSubmit({ ...e.m.rows[0], day: 15 }, shared.id); tree = await e.pump();
  assert.match(renderToStaticMarkup(tree), /2026-10-15，0 个日程，1 个重要日/);
  assert.match(renderToStaticMarkup(tree), /2026-10-10，1 个日程，0 个重要日/);
  e.props.selectedDate = new Date(2026, 9, 15); tree = await e.pump(); button(tree, '打开重要日 同名重要日').props.onClick(); tree = await e.pump();
  await sheet(tree).props.onSubmit({ ...e.m.rows[0], year: 2028 }, shared.id); tree = await e.pump();
  assert.equal(button(tree, '打开重要日 同名重要日'), undefined);
  e.props.selectedDate = new Date(2028, 9, 15); tree = await e.pump(); button(tree, '打开重要日 同名重要日').props.onClick(); tree = await e.pump();
  await sheet(tree).props.onSubmit({ ...e.m.rows[0], repeat_kind: 'none', year: 2029 }, shared.id); tree = await e.pump();
  assert.equal(button(tree, '打开重要日 同名重要日'), undefined);
}));

test('all/single Space display, disabled/re-enabled modules and removed membership keep ownership intact', () => runtime(async (e) => {
  e.m.rows = [row('same', personal.id), row('same', shared.id)]; let tree = await e.pump();
  assert.equal(nodes(tree).filter((el) => el.props['data-important-date-id']).length, 2);
  e.props.spaces = [personal]; e.props.calendarFilter = { spaceId: personal.id }; tree = await e.pump();
  assert.equal(nodes(tree).filter((el) => el.props['data-important-date-id']).length, 1);
  button(tree, '打开重要日 同名重要日').props.onClick(); tree = await e.pump();
  assert.equal(sheet(tree).props.date.space_id, personal.id); sheet(tree).props.onCancel();
  e.m.eligible = [shared]; e.props.importantDatesEntry = { memberSpaces: e.m.members, eligibleSpaces: e.m.eligible };
  assert.equal(button(e.render(), '打开重要日 同名重要日'), undefined);
  tree = await e.pump(); assert.equal(button(tree, '打开重要日 同名重要日'), undefined); assert.equal(e.m.rows.length, 2);
  e.m.eligible = e.m.members; e.props.importantDatesEntry = { memberSpaces: e.m.members, eligibleSpaces: e.m.eligible }; tree = await e.pump();
  assert.ok(button(tree, '打开重要日 同名重要日'));
  e.m.members = [shared]; e.m.eligible = [shared]; e.props.allSpaces = e.m.members; e.props.importantDatesEntry = { memberSpaces: e.m.members, eligibleSpaces: e.m.eligible };
  tree = await e.pump(); assert.equal(button(tree, '打开重要日 同名重要日'), undefined); assert.equal(e.m.rows.length, 2);
}));

test('same date/name/Emoji in different Spaces opens each exact identity; no Event dispatch', () => runtime(async (e) => {
  e.m.rows = [row('same', shared.id), row('same', personal.id)]; let tree = await e.pump();
  const cards = nodes(tree).filter((el) => el.props['data-important-date-id']);
  assert.deepEqual(cards.map((el) => el.props['data-space-id']), ['personal', 'shared']);
  for (const card of cards) {
    card.props.onClick(); tree = await e.pump(); assert.equal(sheet(tree).props.date.space_id, card.props['data-space-id']);
    sheet(tree).props.onCancel(); await e.pump();
  }
  assert.deepEqual(e.calls.filter((c: any) => c[0] === 'target').map((c: any) => c.slice(1)), [['personal', 'same'], ['shared', 'same']]);
  const eventCard = nodes(tree).find((el) => el.type?.name === 'EventCard'); assert.ok(eventCard);
  eventCard.props.onEdit(eventCard.props.occurrence); tree = await e.pump();
  assert.equal(sheet(tree), undefined); assert.equal(nodes(tree).find((el) => el.type?.name === 'EventSheet').props.target.event.id, 'event');
}));

test('pending target A1 -> B -> A2 rejects A1 and Event click cancels a late target', () => runtime(async (e) => {
  e.m.rows = [row('a'), row('b', personal.id)]; let tree = await e.pump();
  const cards = nodes(tree).filter((el) => el.props['data-important-date-id']);
  const a = cards.find((el) => el.props['data-important-date-id'] === 'a'); const b = cards.find((el) => el.props['data-important-date-id'] === 'b');
  const first = deferred(); const original = e.m.target; let count = 0;
  e.m.target = (...args: any[]) => ++count === 1 ? first.promise : original(...args);
  a.props.onClick(); tree = await e.pump(); assert.equal(sheet(tree), undefined);
  assert.ok(button(tree, '取消打开重要日')); b.props.onClick(); await e.pump(); a.props.onClick(); tree = await e.pump();
  assert.equal(sheet(tree).props.date.id, 'a'); const requestSheet = sheet(tree);
  first.resolve({ status: 'ready', date: row('a', shared.id, { name: 'obsolete' }), space: shared }); tree = await e.pump();
  assert.equal(sheet(tree).props.date.name, '同名重要日'); assert.equal(sheet(tree).key, requestSheet.key);
  sheet(tree).props.onCancel(); tree = await e.pump(); const late = deferred(); e.m.target = () => late.promise;
  a.props.onClick(); tree = await e.pump(); const eventCard = nodes(tree).find((el) => el.type?.name === 'EventCard');
  eventCard.props.onEdit(eventCard.props.occurrence); await e.pump(); late.resolve(await original('me', { spaceId: shared.id, importantDateId: 'a' })); tree = await e.pump();
  assert.equal(sheet(tree), undefined); assert.ok(nodes(tree).find((el) => el.type?.name === 'EventSheet'));
}));

test('deleted or disabled exact target cannot initialize Sheet from occurrence', () => runtime(async (e) => {
  let tree = await e.pump(); const card = button(tree, '打开重要日 同名重要日'); e.m.rows = [];
  card.props.onClick(); tree = await e.pump(); assert.equal(sheet(tree), undefined);
  assert.match(renderToStaticMarkup(tree), /已删除或当前不可访问/);
  e.m.rows = [row()]; e.dispatch('focus'); tree = await e.pump(); e.m.eligible = [];
  button(tree, '打开重要日 同名重要日').props.onClick(); tree = await e.pump();
  assert.equal(sheet(tree), undefined); assert.equal(button(tree, '打开重要日 同名重要日'), undefined);
}));

test('focus/visible/online reconcile only Important Dates; original Event Realtime and cleanup remain', () => runtime(async (e) => {
  await e.pump(); const events = e.calls.filter((c: any) => c[0] === 'events').length;
  for (const key of ['focus', 'online', 'visibilitychange']) { const before = e.calls.filter((c: any) => c[0] === 'projection').length; e.dispatch(key); await e.pump(); assert.ok(e.calls.filter((c: any) => c[0] === 'projection').length > before); }
  assert.equal(e.calls.filter((c: any) => c[0] === 'events').length, events);
  e.surface.visibilityState = 'hidden'; const before = e.calls.length; e.dispatch('visibilitychange'); await e.pump(); assert.equal(e.calls.length, before);
  assert.deepEqual(e.calls.filter((c: any) => c[0] === 'channel').map((c: any) => c[1]), ['calendar-events:personal', 'calendar-events:shared']);
  assert.ok(e.channels.every((c: any) => c.config.table === 'events'));
  const dateReads = e.calls.filter((c: any) => c[0] === 'projection').length;
  e.channels[0].changed(); await e.pump(); assert.ok(e.calls.filter((c: any) => c[0] === 'events').length > events);
  assert.equal(e.calls.filter((c: any) => c[0] === 'projection').length, dateReads);
  e.unmount(); assert.equal(e.channels.length, 0); assert.equal(e.auth.size, 0);
}));

test('Calendar range/view changes send exact local civil 1/7/42-day bounds, including historical and cross-year cells', () => runtime(async (e) => {
  for (const [view, selected, start, end] of [
    ['today', new Date(2027, 1, 28, 23, 50), [2027, 2, 28], [2027, 2, 28]],
    ['week', new Date(2026, 11, 31), [2026, 12, 28], [2027, 1, 3]],
    ['month', new Date(2025, 1, 10), [2025, 1, 27], [2025, 3, 9]],
    ['month', new Date(2028, 11, 10), [2028, 11, 27], [2029, 1, 7]],
  ] as any[]) {
    e.props.viewMode = view; e.props.selectedDate = selected; await e.pump();
    const read = e.calls.filter((c: any) => c[0] === 'projection').at(-1);
    const civil = (v: number[]) => ({ year: v[0], month: v[1], day: v[2] });
    assert.deepEqual(read[2], { start: civil(start), end: civil(end) });
  }
}));

test('real Calendar browsing derives historical/future non-repeat, annual cross-year, anchor and Feb29 without duplicates', () => runtime(async (e) => {
  e.m.rows = [row('leap', shared.id, { repeat_kind: 'annual', year: 2024, month: 2, day: 29 }),
    row('past', shared.id, { year: 2025, month: 2, day: 28 }), row('anchor', shared.id, { repeat_kind: 'annual', year: 2028, month: 5, day: 20 }),
    row('future', shared.id, { year: 2029, month: 5, day: 20 }),
    row('dec', shared.id, { repeat_kind: 'annual', year: null, month: 12, day: 31 }), row('jan', personal.id, { repeat_kind: 'annual', year: null, month: 1, day: 1 })];
  e.props.viewMode = 'today';
  for (const [date, ids] of [
    [new Date(2025, 1, 28), ['leap', 'past']], [new Date(2024, 1, 29), ['leap']], [new Date(2028, 1, 29), ['leap']],
    [new Date(2027, 4, 20), []], [new Date(2028, 4, 20), ['anchor']], [new Date(2029, 4, 20), ['anchor', 'future']],
  ] as any[]) {
    e.props.selectedDate = date; const tree = await e.pump();
    assert.deepEqual(nodes(tree).filter((el) => el.props['data-important-date-id']).map((el) => el.props['data-important-date-id']), ids);
  }
  e.props.viewMode = 'week'; e.props.selectedDate = new Date(2026, 11, 31); const tree = await e.pump();
  assert.deepEqual(nodes(tree).filter((el) => el.props['data-important-date-id']).map((el) => el.props['data-important-date-id']), ['dec', 'jan']);
}));

test('range A1 -> B -> A2 and filter changes reject late projection without clearing Event content', () => runtime(async (e) => {
  const first = deferred(); const original = e.m.dates; let count = 0; e.m.dates = (...args: any[]) => ++count === 1 ? first.promise : original(...args);
  await e.pump(); e.props.selectedDate = new Date(2026, 10, 10); await e.pump(); e.props.selectedDate = day;
  let tree = await e.pump(); assert.ok(button(tree, '打开重要日 同名重要日'));
  first.resolve({ memberSpaces: e.m.members, eligibleSpaces: e.m.eligible, dates: [row('obsolete', shared.id, { name: 'obsolete' })] });
  tree = await e.pump(); assert.doesNotMatch(renderToStaticMarkup(tree), /obsolete/);
  assert.equal(e.latest().items[0].importantDateId, 'important');
  assert.match(renderToStaticMarkup(tree), /普通日程/);
  const late = deferred(); e.m.dates = () => late.promise; e.dispatch('online'); await e.pump();
  e.props.spaces = [personal]; e.props.calendarFilter = { spaceId: personal.id }; e.m.dates = original;
  assert.equal(button(e.render(), '打开重要日 同名重要日'), undefined); await e.pump();
  late.resolve({ memberSpaces: e.m.members, eligibleSpaces: e.m.eligible, dates: [row()] });
  assert.equal(button(await e.pump(), '打开重要日 同名重要日'), undefined);
}));

for (const loss of ['logout', 'user-change', 'membership', 'role', 'module', 'unmount']) {
  test(`pending exact Calendar target cannot open after ${loss}`, () => runtime(async (e) => {
    let tree = await e.pump(); const late = deferred(); e.m.target = () => late.promise;
    button(tree, '打开重要日 同名重要日').props.onClick(); await e.pump();
    if (loss === 'logout' || loss === 'user-change') for (const fn of [...e.auth]) fn(loss === 'logout' ? 'SIGNED_OUT' : 'SIGNED_IN', loss === 'logout' ? null : { user: { id: 'other' } });
    if (loss === 'membership') { e.props.allSpaces = [personal]; e.m.members = [personal]; e.m.eligible = [personal]; }
    if (loss === 'role') { const newRole = { ...shared, membershipRole: 'owner' }; e.props.allSpaces = [personal, newRole]; e.m.members = e.props.allSpaces; e.m.eligible = e.m.members; }
    if (loss === 'module') e.m.eligible = [personal];
    if (['membership', 'role', 'module'].includes(loss)) e.props.importantDatesEntry = { memberSpaces: e.m.members, eligibleSpaces: e.m.eligible };
    if (loss === 'unmount') { e.unmount(); const reads = e.calls.length; late.resolve({ status: 'ready', date: row(), space: shared }); await tick(); assert.equal(e.calls.length, reads); return; }
    assert.equal(sheet(e.render()), undefined); await e.pump();
    late.resolve({ status: 'ready', date: row(), space: shared }); tree = await e.pump(); assert.equal(sheet(tree), undefined);
  }));
}

test('old Calendar save callback loses authority after confirmed module loss and target cancel', () => runtime(async (e) => {
  let tree = await e.pump(); button(tree, '打开重要日 同名重要日').props.onClick(); tree = await e.pump();
  const save = sheet(tree).props.onSubmit; e.m.eligible = [personal]; e.props.importantDatesEntry = { memberSpaces: e.m.members, eligibleSpaces: e.m.eligible }; e.render();
  await assert.rejects(save({ ...row(), name: 'unsafe' }, shared.id), /当前无法保存/);
  assert.equal(e.calls.filter((c: any) => c[0] === 'update').length, 0);
  await e.pump(); e.m.eligible = e.m.members; e.props.importantDatesEntry = { memberSpaces: e.m.members, eligibleSpaces: e.m.eligible }; tree = await e.pump();
  button(tree, '打开重要日 同名重要日').props.onClick(); tree = await e.pump(); const canceledSave = sheet(tree).props.onSubmit;
  sheet(tree).props.onCancel(); await assert.rejects(canceledSave({ ...row(), name: 'unsafe' }, shared.id), /当前无法保存/);
  assert.equal(e.calls.filter((c: any) => c[0] === 'update').length, 0);
}));

test('Calendar day/week/month render Important Dates separately from Events with source and type labels', async () => {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false } });
  try {
    const { CalendarViews } = await vite.ssrLoadModule('/src/App.tsx');
    for (const viewMode of ['today', 'week', 'month']) {
      const html = renderToStaticMarkup(React.createElement(CalendarViews, { expansion: { occurrences: [], errors: [] },
        membersBySpaceId: {}, spacesById: { personal, shared }, showSpaceLabel: true, selectedDate: day, viewMode,
        userId: 'me', onEdit: noop, onSelectDate: noop, importantDates: [occurrence(), occurrence('personal')], onOpenImportantDate: noop }));
      assert.match(html, /同名重要日/);
      assert.match(html, /重要日 · 共同/);
      assert.match(html, /重要日 · 我的/);
      assert.match(html, /旅行空间/);
      assert.match(html, /我的空间/);
      assert.equal((html.match(/data-important-date-id=/g) ?? []).length, 2);
      if (viewMode === 'month') {
        assert.match(html, /2 个重要日/);
        assert.equal((html.match(/aria-label="\d{4}-\d+-\d+/g) ?? []).length, 42);
      }
    }
  } finally { await vite.close(); }
});


test('Calendar validated view survives unmount and is immediately visible during warm canonical reconciliation', () => runtime(async (e) => {
  assert.match(renderToStaticMarkup(e.render()), /正在读取重要日/);
  await e.pump(); assert.equal(e.latest().items.length, 1);
  assert.equal('dates' in e.latest(), false); assert.equal('reminder_kind' in e.latest().items[0], false);
  e.restore(); const pending = deferred(); const loader = e.m.dates; e.m.dates = () => pending.promise;
  assert.ok(button(e.render(), '打开重要日 同名重要日'));
  let tree = await e.pump(); assert.ok(button(tree, '打开重要日 同名重要日'));
  assert.doesNotMatch(renderToStaticMarkup(tree), /正在读取重要日/);
  e.m.rows = [row('fresh', shared.id, { name: 'fresh replacement' })];
  pending.resolve(await loader('me', [personal.id, shared.id], {}, null, null)); tree = await e.pump();
  assert.ok(button(tree, '打开重要日 fresh replacement')); assert.equal(e.latest().items[0].importantDateId, 'fresh');
}));

test('Day -> Week -> Month retains only visible intersection, never writes partial coverage, and keeps Events', () => runtime(async (e) => {
  e.props.viewMode = 'today'; await e.pump(); const daySnapshot = e.latest();
  const loader = e.m.dates, pending = deferred(); e.m.dates = () => pending.promise;
  e.props.viewMode = 'week'; let tree = await e.pump();
  assert.ok(button(tree, '打开重要日 同名重要日')); assert.match(renderToStaticMarkup(tree), /普通日程/);
  assert.match(renderToStaticMarkup(tree), /当前范围尚未完整确认/); assert.equal(e.latest(), daySnapshot);
  e.m.rows.push(row('new-week', shared.id, { day: 11, name: 'new week item' }));
  pending.resolve(await loader('me', [personal.id, shared.id], {}, null, null)); tree = await e.pump();
  assert.ok(button(tree, '打开重要日 new week item')); assert.equal(e.latest().view, 'week');
  const weekSnapshot = e.latest(), month = deferred(); e.m.dates = () => month.promise;
  e.props.viewMode = 'month'; tree = await e.pump();
  assert.equal(e.latest(), weekSnapshot); assert.ok(button(tree, '打开重要日 同名重要日'));
  assert.match(renderToStaticMarkup(tree), /重要日更新中/);
  assert.doesNotMatch(renderToStaticMarkup(tree), /0 个重要日/);
  month.resolve(await loader('me', [personal.id, shared.id], {}, null, null)); tree = await e.pump();
  assert.equal(e.latest().view, 'month'); assert.match(renderToStaticMarkup(tree), /0 个重要日/);
}));

test('disjoint month transition and retained empty range remain incomplete until fresh empty/nonempty success', () => runtime(async (e) => {
  e.props.viewMode = 'month'; await e.pump();
  const old = e.latest(), pending = deferred(), loader = e.m.dates; e.m.dates = () => pending.promise;
  e.props.selectedDate = new Date(2026, 11, 10); let tree = await e.pump();
  assert.equal(button(tree, '打开重要日 同名重要日'), undefined); assert.equal(e.latest(), old);
  assert.match(renderToStaticMarkup(tree), /当前范围尚未完整确认/); assert.doesNotMatch(renderToStaticMarkup(tree), /0 个重要日/);
  pending.resolve(await loader('me', [personal.id, shared.id], {}, null, null)); tree = await e.pump();
  assert.match(renderToStaticMarkup(tree), /0 个重要日/); assert.deepEqual(e.latest().items, []);
  e.restore(); const next = deferred(); e.m.dates = () => next.promise;
  tree = await e.pump(); assert.doesNotMatch(renderToStaticMarkup(tree), /正在读取重要日/);
  assert.match(renderToStaticMarkup(tree), /0 个重要日/);
  e.props.selectedDate = new Date(2027, 0, 10); tree = await e.pump();
  assert.doesNotMatch(renderToStaticMarkup(tree), /0 个重要日/);
  next.resolve({ memberSpaces: e.m.members, eligibleSpaces: e.m.eligible, dates: [row('jan', shared.id, { year: 2027, month: 1 })] });
  tree = await e.pump(); assert.match(renderToStaticMarkup(tree), /1 个重要日/);
}));

for (const changedRange of [false, true]) test(`retained ${changedRange ? 'intersection' : 'same range'} survives refresh error and recovers on retry`, () => runtime(async (e) => {
  await e.pump(); const old = e.latest(); e.m.dateFailure = true;
  if (changedRange) e.props.viewMode = 'month'; else e.dispatch('focus');
  let tree = await e.pump(); assert.ok(button(tree, '打开重要日 同名重要日'));
  assert.match(renderToStaticMarkup(tree), /重要日更新失败/); assert.equal(e.latest(), old);
  assert.match(renderToStaticMarkup(tree), /普通日程/);
  if (changedRange) { assert.match(renderToStaticMarkup(tree), /当前范围尚未完整确认/); assert.doesNotMatch(renderToStaticMarkup(tree), /0 个重要日/); }
  e.m.dateFailure = false; button(tree, '重试重要日').props.onClick(); tree = await e.pump();
  assert.doesNotMatch(renderToStaticMarkup(tree), /更新失败/); assert.notEqual(e.latest(), old);
}));

test('retained click always reads exact fresh object while projection reconciliation is pending', () => runtime(async (e) => {
  await e.pump(); e.restore(); const pending = deferred(); e.m.dates = () => pending.promise;
  let tree = await e.pump(); e.m.rows[0] = { ...e.m.rows[0], name: 'fresh exact target' };
  button(tree, '打开重要日 同名重要日').props.onClick(); tree = await e.pump();
  assert.equal(sheet(tree).props.date.name, 'fresh exact target'); assert.equal(e.calls.filter((c: any) => c[0] === 'target').length, 1);
  sheet(tree).props.onCancel(); await e.pump(); e.m.rows = [];
  button(e.render(), '打开重要日 同名重要日').props.onClick(); tree = await e.pump();
  assert.equal(sheet(tree), undefined); assert.match(renderToStaticMarkup(tree), /已删除或当前不可访问/);
}));

for (const boundary of ['membership', 'role', 'module', 'filter', 'timezone', 'user', 'logout']) test(`Calendar retained presentation rejects ${boundary} boundary`, () => runtime(async (e) => {
  await e.pump(); e.restore(); const pending = deferred(); e.m.dates = () => pending.promise;
  if (boundary === 'membership') { e.props.allSpaces = [personal]; e.m.members = [personal]; }
  if (boundary === 'role') e.props.allSpaces = [personal, { ...shared, membershipRole: 'owner' }];
  if (boundary === 'module') e.props.importantDatesEntry = { memberSpaces: e.m.members, eligibleSpaces: [personal] };
  if (boundary === 'filter') { e.props.calendarFilter = { spaceId: personal.id }; e.props.spaces = [personal]; }
  if (boundary === 'timezone') e.m.timeZone = 'America/New_York';
  if (boundary === 'user') e.props.session = { user: { id: 'other' } };
  let tree = await e.pump();
  if (boundary === 'logout') { for (const fn of [...e.auth]) fn('SIGNED_OUT', null); tree = e.render(); }
  assert.equal(button(tree, '打开重要日 同名重要日'), undefined);
  assert.equal(e.latest(), undefined);
}));

test('confirmed scope loss during retained refresh removes old rows even if source read fails', () => runtime(async (e) => {
  await e.pump(); const pending = deferred(); e.m.dates = async (...args: any[]) => {
    args.at(-1)({ memberSpaces: [personal], eligibleSpaces: [personal] }); await pending.promise; throw Error('offline');
  };
  e.dispatch('focus'); let tree = await e.pump(); assert.equal(button(tree, '打开重要日 同名重要日'), undefined);
  assert.equal(e.latest(), undefined); pending.resolve(null); tree = await e.pump();
  assert.match(renderToStaticMarkup(tree), /读取失败/); assert.equal(button(tree, '打开重要日 同名重要日'), undefined);
}));

test('Calendar same actual range does not reread for a new selectedDate object', () => runtime(async (e) => {
  await e.pump(); const count = e.calls.filter((c: any) => c[0] === 'projection').length;
  e.props.selectedDate = new Date(2026, 9, 11); await e.pump();
  assert.equal(e.calls.filter((c: any) => c[0] === 'projection').length, count);
}));


test('Calendar date edit and delete retain old presentation until canonical snapshot replacement', () => runtime(async (e) => {
  e.props.viewMode = 'month'; let tree = await e.pump(); const old = e.latest();
  button(tree, '打开重要日 同名重要日').props.onClick(); tree = await e.pump();
  const loader = e.m.dates, pending = deferred(); e.m.dates = () => pending.promise;
  await sheet(tree).props.onSubmit({ ...e.m.rows[0], day: 15, repeat_kind: 'annual', year: 2024 }, shared.id); tree = await e.pump();
  assert.equal(sheet(tree), undefined); assert.equal(e.latest(), old);
  assert.ok(button(tree, '打开重要日 同名重要日')); assert.match(renderToStaticMarkup(tree), /2026-10-10，1 个日程，1 个重要日/);
  pending.resolve(await loader('me', ['personal', 'shared'], {}, null, null)); tree = await e.pump();
  assert.equal(e.latest().items[0].occurrenceDate.day, 15); assert.equal(e.latest().items.length, 1);
  e.props.selectedDate = new Date(2026, 9, 15); tree = await e.pump();
  button(tree, '打开重要日 同名重要日').props.onClick(); tree = await e.pump(); sheet(tree).props.onDelete(); tree = await e.pump();
  const deleting = deferred(), before = e.latest(); e.m.dates = () => deleting.promise;
  await nodes(tree).find((el) => el.type?.name === 'ImportantDateDeleteDialog').props.onConfirm(); tree = await e.pump();
  assert.equal(e.latest(), before); assert.ok(button(tree, '打开重要日 同名重要日'));
  deleting.resolve(await loader('me', ['personal', 'shared'], {}, null, null)); tree = await e.pump();
  assert.deepEqual(e.latest().items, []); assert.equal(button(tree, '打开重要日 同名重要日'), undefined);
}));

test('unknown module hint retains previous safe view without claiming new scope authority', () => runtime(async (e) => {
  await e.pump(); const old = e.latest(); const pending = deferred(); e.m.dates = () => pending.promise;
  e.props.importantDatesEntry = null; const tree = await e.pump();
  assert.ok(button(tree, '打开重要日 同名重要日')); assert.equal(e.latest(), old);
  assert.doesNotMatch(renderToStaticMarkup(tree), /正在读取重要日/);
}));

const eventCard = (tree: any, title = '普通日程') => nodes(tree).find((el) => el.type?.name === 'EventCard' && el.props.occurrence.title === title);
const eventSheet = (tree: any) => nodes(tree).find((el) => el.type?.name === 'EventSheet');

test('Calendar Event cold success publishes presentation-only slot; warm first render keeps Events before canonical read', () => runtime(async (e) => {
  assert.match(renderToStaticMarkup(e.render()), /正在读取日程/);
  await e.pump(); const snapshot = e.latestEvents(); assert.ok(snapshot);
  const source = snapshot.items[0].source_event;
  assert.deepEqual(Object.keys(source).sort(), ['id', 'owner_user_id', 'scope', 'space_id']);
  assert.equal(snapshot.events, undefined); assert.equal(snapshot.exceptions, undefined);
  e.restoreEvents(); const pending = deferred(); e.m.events = () => pending.promise;
  let tree = e.render(); assert.ok(eventCard(tree)); assert.doesNotMatch(renderToStaticMarkup(tree), /正在读取日程/);
  tree = await e.pump(); assert.ok(eventCard(tree)); assert.equal(eventSheet(tree), undefined);
}));

for (const outcome of ['success', 'error']) test(`Calendar Event mounted refresh preserves content on ${outcome} and retry recovers`, () => runtime(async (e) => {
  await e.pump(); const original = e.m.events, pending = deferred(); e.m.events = () => pending.promise;
  e.channels[0].changed(); let tree = await e.pump();
  assert.ok(eventCard(tree)); assert.doesNotMatch(renderToStaticMarkup(tree), /正在读取日程/);
  if (outcome === 'success') {
    const fresh = await original(); fresh.events[0].title = 'fresh event'; pending.resolve(fresh);
    tree = await e.pump(); assert.ok(eventCard(tree, 'fresh event')); assert.equal(eventCard(tree), undefined);
  } else {
    // Reuse the ongoing read: no new query subsystem or source payload patch.
    e.m.events = async () => { throw Error('refresh failed'); }; pending.resolve(Promise.reject(Error('refresh failed')));
    tree = await e.pump(); assert.ok(eventCard(tree)); assert.match(renderToStaticMarkup(tree), /refresh failed/);
    const retry = button(tree, '重试'); assert.ok(retry); e.m.events = original; retry.props.onClick();
    tree = await e.pump(); assert.ok(eventCard(tree)); assert.doesNotMatch(renderToStaticMarkup(tree), /refresh failed/);
  }
}));

for (const outcome of ['edit', 'delete', 'outside-range', 'membership-loss', 'recurrence']) test(`retained Calendar Event click waits for fresh ${outcome} qualification`, () => runtime(async (e) => {
  await e.pump(); const original = e.m.events; e.restoreEvents(); const pending = deferred(); e.m.events = () => pending.promise;
  let tree = await e.pump(); const card = eventCard(tree); assert.ok(card);
  card.props.onEdit(card.props.occurrence); tree = await e.pump(); assert.equal(eventSheet(tree), undefined);
  const fresh = await original();
  if (outcome === 'delete') fresh.events = [];
  if (outcome === 'outside-range') fresh.events[0].starts_at = new Date(2027, 0, 1).toISOString();
  if (outcome === 'membership-loss') fresh.membersBySpaceId.shared = [{ user_id: 'other', space_id: shared.id }];
  if (outcome === 'edit') fresh.events[0].title = 'fresh authority';
  if (outcome === 'recurrence') fresh.events[0].recurrence_rule = { version: 1, frequency: 'daily', interval: 1, time_zone: 'Asia/Shanghai' };
  pending.resolve(fresh); tree = await e.pump();
  if (outcome === 'edit') { assert.equal(eventSheet(tree).props.target.event, fresh.events[0]); assert.equal(eventSheet(tree).props.target.event.title, 'fresh authority'); }
  else if (outcome === 'recurrence') { assert.equal(eventSheet(tree).props.target.kind, 'occurrence'); assert.equal(eventSheet(tree).props.target.event, fresh.events[0]); }
  else assert.equal(eventSheet(tree), undefined);
  if (['delete', 'outside-range', 'membership-loss'].includes(outcome)) assert.equal(eventCard(tree), undefined);
}));

for (const boundary of ['user', 'logout', 'membership', 'role', 'filter', 'view', 'range', 'timezone']) test(`Calendar Event retained view rejects ${boundary}`, () => runtime(async (e) => {
  await e.pump(); e.restoreEvents(); const pending = deferred(); e.m.events = () => pending.promise;
  if (boundary === 'user') e.props.session = { user: { id: 'other' } };
  if (boundary === 'membership') e.props.allSpaces = [personal];
  if (boundary === 'role') e.props.allSpaces = [personal, { ...shared, membershipRole: 'owner' }];
  if (boundary === 'filter') { e.props.spaces = [personal]; e.props.calendarFilter = { spaceId: personal.id }; }
  if (boundary === 'view') e.props.viewMode = 'today';
  if (boundary === 'range') e.props.selectedDate = new Date(2026, 10, 10);
  if (boundary === 'timezone') e.m.timeZone = 'America/New_York';
  let tree = await e.pump();
  if (boundary === 'logout') { for (const fn of [...e.auth]) fn('SIGNED_OUT', null); tree = e.render(); }
  assert.equal(eventCard(tree), undefined);
}));

test('Calendar Event pending click loses authority on unmount; Realtime and channel cleanup stay single-scope', () => runtime(async (e) => {
  await e.pump(); e.restoreEvents(); const pending = deferred(), original = e.m.events; e.m.events = () => pending.promise;
  const tree = await e.pump(), card = eventCard(tree); card.props.onEdit(card.props.occurrence);
  assert.equal(e.channels.length, 2); assert.ok(e.channels.every((c: any) => c.config.table === 'events'));
  e.unmount(); assert.equal(e.channels.length, 0); pending.resolve(await original()); await tick();
  assert.equal(eventSheet(e.render()), undefined);
}));

for (const change of ['delete', 'edit', 'recurrence-exception']) test(`Calendar Event mutation refresh ${change} replaces only after complete canonical result`, () => runtime(async (e) => {
  let tree = await e.pump(); const card = eventCard(tree); card.props.onEdit(card.props.occurrence); tree = await e.pump();
  assert.ok(eventSheet(tree)); const editor = eventSheet(tree), original = e.m.events, pending = deferred(); e.m.events = () => pending.promise;
  editor.props.onClose(); editor.props.onSaved(); tree = await e.pump(); assert.ok(eventCard(tree)); assert.equal(eventSheet(tree), undefined);
  const fresh = await original();
  if (change === 'delete') fresh.events = [];
  if (change === 'edit') fresh.events[0].title = 'edited canonical';
  if (change === 'recurrence-exception') {
    fresh.events[0].recurrence_rule = { version: 1, frequency: 'daily', interval: 1, time_zone: 'Asia/Shanghai' };
    fresh.exceptions = [{ id: 'exception', event_id: 'event', occurrence_date: '2026-10-10', exception_type: 'deleted', override_data: {} }];
  }
  pending.resolve(fresh); tree = await e.pump();
  if (change === 'recurrence-exception') {
    assert.equal(nodes(tree).some((el) => el.type?.name === 'EventCard' && el.props.occurrence.occurrence_date === '2026-10-10'), false);
    assert.ok(eventCard(tree)); // Later recurring occurrences remain intact.
  } else assert.equal(eventCard(tree), undefined);
  if (change === 'edit') assert.ok(eventCard(tree, 'edited canonical'));
  assert.equal(e.props.selectedDate, day); assert.equal(e.props.viewMode, 'week'); assert.equal(e.props.calendarFilter, 'all');
}));

test('Calendar Event empty validated result warms without loading; cold error remains retryable', () => runtime(async (e) => {
  const original = e.m.events; e.m.events = async () => { const data = await original(); data.events = []; return data; };
  await e.pump(); assert.equal(e.latestEvents().items.length, 0);
  e.restoreEvents(); e.m.eventFailure = true; e.m.events = original;
  let tree = e.render(); assert.doesNotMatch(renderToStaticMarkup(tree), /正在读取日程/);
  tree = await e.pump(); assert.ok(button(tree, '重试')); assert.equal(e.latestEvents().items.length, 0);
  e.props.initialCalendarEvents = undefined; e.unmount(); tree = await e.pump();
  assert.match(renderToStaticMarkup(tree), /日程读取失败/); assert.ok(button(tree, '重试'));
}));

test('Calendar Event reconnect retains view but denies stale click until current canonical result', () => runtime(async (e) => {
  let tree = await e.pump(); e.channels[0].status('CHANNEL_ERROR'); tree = await e.pump();
  const card = eventCard(tree); assert.ok(card); card.props.onEdit(card.props.occurrence); tree = await e.pump(); assert.equal(eventSheet(tree), undefined);
  const pending = deferred(), original = e.m.events; e.m.events = () => pending.promise;
  e.channels[0].status('SUBSCRIBED'); tree = await e.pump(); assert.ok(eventCard(tree));
  eventCard(tree).props.onEdit(eventCard(tree).props.occurrence); await e.pump();
  const fresh = await original(); fresh.events[0].title = 'reconnected canonical'; pending.resolve(fresh);
  tree = await e.pump(); assert.equal(eventSheet(tree).props.target.event, fresh.events[0]);
}));

test('Calendar Event dirty A1 read cannot publish or authorize click; final A2 reconciliation wins', () => runtime(async (e) => {
  await e.pump(); const original = e.m.events, first = deferred(), second = deferred();
  let reads = 0; e.m.events = () => ++reads === 1 ? first.promise : second.promise;
  e.channels[0].changed(); let tree = await e.pump(); eventCard(tree).props.onEdit(eventCard(tree).props.occurrence);
  e.channels[0].changed(); const stale = await original(); stale.events[0].title = 'stale A1'; first.resolve(stale);
  tree = await e.pump(); assert.ok(eventCard(tree)); assert.equal(eventCard(tree, 'stale A1'), undefined); assert.equal(eventSheet(tree), undefined);
  const fresh = await original(); fresh.events[0].title = 'fresh A2'; second.resolve(fresh);
  tree = await e.pump(); assert.equal(eventSheet(tree).props.target.event, fresh.events[0]); assert.equal(reads, 2);
}));

test('Calendar Event scope A1→B→A2 rejects late A1 and pending original action', () => runtime(async (e) => {
  await e.pump(); const original = e.m.events; e.restoreEvents(); const first = deferred(), latest = deferred();
  let reads = 0; e.m.events = () => ++reads === 1 ? first.promise : latest.promise;
  let tree = await e.pump(); eventCard(tree).props.onEdit(eventCard(tree).props.occurrence);
  e.props.allSpaces = [personal, { ...shared, membershipRole: 'owner' }]; await e.pump();
  e.props.allSpaces = [personal, shared]; await e.pump();
  const fresh = await original(); fresh.events[0].title = 'final A2'; latest.resolve(fresh); tree = await e.pump();
  assert.ok(eventCard(tree, 'final A2')); assert.equal(eventSheet(tree), undefined);
  const stale = await original(); stale.events[0].title = 'late A1'; first.resolve(stale); tree = await e.pump();
  assert.ok(eventCard(tree, 'final A2')); assert.equal(eventSheet(tree), undefined);
}));

for (const boundary of ['logout', 'scope']) test(`Calendar Event pending warm click rejects late completion after ${boundary}`, () => runtime(async (e) => {
  await e.pump(); e.restoreEvents(); const pending = deferred(), original = e.m.events; e.m.events = () => pending.promise;
  let tree = await e.pump(); eventCard(tree).props.onEdit(eventCard(tree).props.occurrence); await e.pump();
  if (boundary === 'logout') for (const fn of [...e.auth]) fn('SIGNED_OUT', null);
  else e.props.allSpaces = [personal];
  await e.pump(); pending.resolve(await original()); tree = await e.pump(); assert.equal(eventSheet(tree), undefined);
}));

test('Calendar Event Feb29 remains SKIP while Important Date Feb29 fallback and retention stay independent', () => runtime(async (e) => {
  e.props.selectedDate = new Date(2027, 1, 28); e.props.viewMode = 'month';
  e.m.rows = [row('leap-important', shared.id, { repeat_kind: 'annual', year: null, month: 2, day: 29 })];
  const original = e.m.events;
  e.m.events = async () => { const data = await original(); data.events[0].starts_at = '2024-02-29T04:00:00.000Z';
    data.events[0].recurrence_rule = { version: 1, frequency: 'yearly', interval: 1, month: 2, day: 29, time_zone: 'Asia/Shanghai' }; return data; };
  let tree = await e.pump(); assert.match(renderToStaticMarkup(tree), /2027-2-28，0 个日程，1 个重要日/);
  assert.equal(e.latestEvents().items.length, 0); assert.ok(button(tree, '打开重要日 同名重要日'));
  e.props.initialCalendarEvents = e.latestEvents(); e.restore(); const events = deferred(), dates = deferred();
  e.m.events = () => events.promise; e.m.dates = () => dates.promise;
  tree = e.render(); assert.ok(button(tree, '打开重要日 同名重要日')); assert.doesNotMatch(renderToStaticMarkup(tree), /正在读取日程|正在读取重要日/);
}));
