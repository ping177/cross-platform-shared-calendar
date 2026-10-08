import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { createServer } from 'vite';
import { createSwipeClickGuard } from '../src/lib/mobile-swipe.ts';

const space = { id: 's', kind: 'personal', name: '我的空间', membershipRole: 'owner', created_by: 'me' };
const task = { id: 't', space_id: 's', title: '任务', status: 'open', created_by: 'me', assigned_to_user_id: null, due_on: null };
const date = { id: 'd', space_id: 's', name: '重要日', emoji: null, repeat_kind: 'annual', year: null, month: 10, day: 15, reminder_kind: null };
const list = { id: 'l', space_id: 's', name: '清单' };
const entry = { memberSpaces: [space], eligibleSpaces: [space] };
const nodes = (node: any): any[] => React.isValidElement(node) ? [node, ...React.Children.toArray((node.props as any).children).flatMap(nodes)] : [];

// Hook/data injection follows the project's existing Node + Vite runtime fixtures.
// No auth session, database, browser permission or network effects are executed.
async function runtime(run: (e: any) => Promise<void> | void) {
  let cursor = 0; const slots: any[] = [];
  const m: any = {
    useState(initial: any) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value: any) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial: any) { return slots[cursor++] ??= { current: initial }; },
    useEffect() { cursor++; }, useMemo(fn: any) { cursor++; return fn(); }, useCallback(fn: any) { cursor++; return fn; },
  };
  const data = { ...entry, grouped: { open: [task], completed: [] }, sourceSpacesById: { s: space }, membersBySpaceId: { s: [{ user_id: 'me', space_id: 's' }] } };
  m.tasks = { filter: { spaceId: 's' }, state: { status: 'ready', data }, canAct: true, chooseFilter() {}, refresh() {} };
  m.taskEditor = { create: null, editing: null, openingCreate: false, openingTask: false, busyTaskId: null };
  m.lists = { filter: { spaceId: 's' }, canAct: true, state: { status: 'ready', data: { ...entry, grouped: { active: [{ list, totalItems: 1, completedCount: 0 }], completed: [] } } }, refresh() {} };
  m.dates = { state: { data: { ...entry, dates: [date] }, refreshing: false }, sessionLost: false, filter: { spaceId: 's' }, today: { year: 2026, month: 10, day: 8 }, canAct: true };
  m.events = { status: 'success', authLost: false, presentation: { items: [], membersBySpaceId: {}, spacesById: {} }, membersBySpaceId: {}, isFresh: () => true };
  m.calendarDates = { items: [], state: { calendarComplete: true }, editor: { editor: null, deleting: false, busy: false, targetRead: { loading: false }, close() {} } };
  (globalThis as any).__gestureUi = m;
  const mocks: Record<string, string> = { useAggregateTasks: 'tasks', useTaskModuleEditor: 'taskEditor', useListsOverview: 'lists', useImportantDates: 'dates', useCalendarEvents: 'events', useCalendarImportantDates: 'calendarDates' };
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{
      name: 'gesture-ui-runtime', enforce: 'pre',
      resolveId(id, importer) {
        if (id === 'react' && (importer?.includes('/components/') || importer?.endsWith('/App.tsx'))) return '\0gesture-hooks';
        for (const name of Object.keys(mocks)) if (id.endsWith('/' + name)) return '\0gesture-' + name;
        if (/\/supabase(?:\.ts)?$/.test(id)) return '\0gesture-client';
      },
      load(id) {
        if (id === '\0gesture-hooks') return 'export const {useState,useRef,useEffect,useMemo,useCallback}=globalThis.__gestureUi;';
        if (id === '\0gesture-client') return 'export const supabase=null; export const isSupabaseConfigured=false;';
        for (const [name, value] of Object.entries(mocks)) if (id === '\0gesture-' + name) return `export const ${name}=()=>globalThis.__gestureUi.${value};`;
      },
    }] } as any);
  try {
    const app = await vite.ssrLoadModule('/src/App.tsx');
    const pages: any = { calendar: app.CurrentSpaceApp };
    for (const [name, file] of Object.entries({ tasks: 'TasksArea', review: 'ReviewHistoryPage', lists: 'ListsOverviewPage', dates: 'ImportantDatesPage' })) pages[name] = (await vite.ssrLoadModule(`/src/components/${file}.tsx`))[file];
    const guard = createSwipeClickGuard(); let modal = false; let external = false;
    const surface: any = { contains: () => !external, ownerDocument: { querySelector: () => modal ? {} : null } };
    function target(node?: any, hard = false) {
      const props = node?.props ?? {};
      return { closest(selector: string) {
        if (selector.includes('textarea')) return hard || props.disabled ? {} : null;
        if (['button', 'a', 'img'].includes(node?.type)) return { closest: () => 'data-swipe-start' in props ? {} : null };
        return null;
      } };
    }
    function render(name: string, props: any) {
      cursor = 0;
      let tree = pages[name]({ swipeClickGuard: guard, ...props });
      if (name === 'dates') tree = tree.type(tree.props);
      return tree;
    }
    function swipe(tree: any, dx = 80, from = target(), dy = 2) {
      tree.props.onPointerDownCapture();
      const event = (x: number, y: number, timeStamp: number) => ({ pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: x, clientY: y, timeStamp, target: from, currentTarget: surface });
      tree.props.onPointerDown(event(100, 100, 0)); tree.props.onPointerMove(event(100 + dx, 100 + dy, 100)); tree.props.onPointerUp(event(100 + dx, 100 + dy, 200));
    }
    await run({ m, app, vite, render, swipe, target, guard, clear() { slots.length = 0; }, modal(value: boolean) { modal = value; }, external(value: boolean) { external = value; } });
  } finally { await vite.close(); delete (globalThis as any).__gestureUi; }
}
const calendarProps = (changed: (date: Date) => void, mode = 'today') => ({ session: { user: { id: 'me' } }, spaces: [space], allSpaces: [space], calendarFilter: 'all', selectedDate: new Date(2026, 9, 15, 12), viewMode: mode, onSelectedDateChange: changed, onCalendarFilterChange() {}, onViewModeChange() {} });

for (const mode of ['today', 'week', 'month']) test(`actual Calendar ${mode} surface and existing buttons use identical periods`, () => runtime((e) => {
  const dates: Date[] = []; const props = calendarProps((d) => dates.push(d), mode);
  const tree = e.render('calendar', props); assert.equal(tree.props.style.touchAction, 'pan-y pinch-zoom');
  e.swipe(tree); e.swipe(tree, -80);
  const navigation = e.app.CalendarDateNavigation({ ...props, selectedDate: props.selectedDate, viewMode: mode });
  const previous = nodes(navigation).find((n) => n.props['aria-label'] === '上一段');
  const next = nodes(navigation).find((n) => n.props['aria-label'] === '下一段');
  previous.props.onClick(); next.props.onClick();
  assert.equal(dates[0].getTime(), dates[2].getTime()); assert.equal(dates[1].getTime(), dates[3].getTime());
}));

test('actual Calendar blocks selector Portal, Event/Important Date sheets, deletion, busy and opening', () => runtime(async (e) => {
  let changes = 0; const props = calendarProps(() => changes++);
  let tree = e.render('calendar', props);
  const filter = nodes(tree).find((n) => n.type.name === 'CalendarFilterPicker'); filter.props.onOpen();
  tree = e.render('calendar', props); assert.equal(tree.props.style, undefined); e.swipe(tree); assert.equal(changes, 0);
  filter.props.onClose(); tree = e.render('calendar', props); e.swipe(tree); assert.equal(changes, 1);
  for (const key of ['editor', 'deleting', 'busy']) {
    e.m.calendarDates.editor[key] = true; tree = e.render('calendar', props); e.swipe(tree); assert.equal(changes, 1); e.m.calendarDates.editor[key] = null;
  }
  e.m.calendarDates.editor.targetRead.loading = true; e.swipe(e.render('calendar', props)); assert.equal(changes, 1);
  e.m.calendarDates.editor.targetRead.loading = false; tree = e.render('calendar', props);
  e.modal(true); e.swipe(tree); e.modal(false); e.external(true); e.swipe(tree); e.external(false); assert.equal(changes, 1);
  const source = { id: 'event', space_id: 's', title: '日程', recurrence_rule: null };
  e.m.events.qualify = async () => ({ isCurrent: () => true, occurrence: { source_event: source } });
  e.m.events.membersBySpaceId = { s: [{ user_id: 'me' }] };
  const calendar = nodes(tree).find((n) => n.type.name === 'CalendarViews');
  calendar.props.onEdit({ source_event: source }); await new Promise((resolve) => setImmediate(resolve));
  tree = e.render('calendar', props); assert.ok(nodes(tree).find((n) => n.type.name === 'EventSheet'));
  e.swipe(tree); assert.equal(changes, 1);
  nodes(tree).find((n) => n.type.name === 'EventSheet').props.onClose();
  e.swipe(e.render('calendar', props)); assert.equal(changes, 2);
}));

for (const screen of ['tasks', 'completed']) test(`Tasks ${screen} gesture and back button preserve filter/state and original return`, () => runtime((e) => {
  const calls: string[] = []; const props = { userId: 'me', screen, onHubBack: () => calls.push('hub'), onScreenChange: (s: string) => calls.push(s) };
  const tree = e.render('tasks', props); const filter = e.m.tasks.filter, data = e.m.tasks.state.data;
  e.swipe(tree); nodes(tree).find((n) => n.type === 'button' && !n.props['aria-label']).props.onClick();
  assert.deepEqual(calls, [screen === 'completed' ? 'tasks' : 'hub', screen === 'completed' ? 'tasks' : 'hub']);
  assert.equal(e.m.tasks.filter, filter); assert.equal(e.m.tasks.state.data, data);
  for (const [key, value] of [['create', { ...entry, selectedId: 's', space, members: [], state: 'ready' }], ['editing', { task, space, members: [] }], ['openingCreate', true], ['openingTask', true], ['busyTaskId', 't']]) {
    e.m.taskEditor[key] = value; e.swipe(e.render('tasks', props)); assert.equal(calls.length, 2); e.m.taskEditor[key] = key.includes('opening') ? false : null;
  }
}));

for (const name of ['review', 'lists', 'dates']) test(`${name} list reuses existing return; cards tap normally, gestures do not open them`, () => runtime((e) => {
  let backs = 0; const props = { userId: 'me', entry, currentSpaceId: 's', onHubBack: () => backs++, onNoEligible() {}, onSpaceChange() {}, onOpenDetail() {}, initialSnapshot: { selectedSpaceId: 's', rows: [], totalCount: 0 } };
  let tree = e.render(name, props); e.swipe(tree); assert.equal(backs, 1);
  const back = nodes(tree).find((n) => n.type === 'button' && !n.props['aria-label']); back.props.onClick(); assert.equal(backs, 2);
  e.modal(true); e.swipe(tree); e.modal(false); assert.equal(backs, 2);
  const create = nodes(tree).find((n) => n.props['aria-label']?.startsWith('新建')); create.props.onClick();
  tree = e.render(name, props); assert.equal(tree.props.style, undefined); e.swipe(tree); assert.equal(backs, 2);
}));

test('date cell opts in; trailing click guard preserves cell selection and next tap', () => runtime((e) => {
  let selected = 0; const tree = e.app.CalendarViews({ expansion: { occurrences: [], errors: [] }, selectedDate: new Date(2026, 9, 15), viewMode: 'month', userId: 'me', membersBySpaceId: {}, spacesById: {}, onEdit() {}, onSelectDate: () => selected++ });
  const monthNode = nodes(tree).find((n) => n.type.name === 'MonthView'); const month = monthNode.type(monthNode.props); const cell = nodes(month).find((n) => n.type === 'button');
  assert.ok('data-swipe-start' in cell.props); cell.props.onClick(); assert.equal(selected, 1);
  let changes = 0; const page = e.render('calendar', calendarProps(() => changes++)); e.swipe(page, 80, e.target(cell)); assert.equal(changes, 1);
  let suppressed = false; e.guard.onClickCapture({ detail: 1, clientX: 180, clientY: 102, timeStamp: 210, nativeEvent: { pointerId: 1, pointerType: 'touch', isTrusted: true }, preventDefault() { suppressed = true; }, stopPropagation() {} });
  if (!suppressed) cell.props.onClick(); assert.equal(selected, 1);
  page.props.onPointerDownCapture(); cell.props.onClick(); assert.equal(selected, 2);
  e.swipe(page, 80, e.target(cell, true)); assert.equal(changes, 1);
  e.swipe(page, 80, e.target(), 90); assert.equal(changes, 1);
}));

test('all six display card types allow swipe while their normal tap still opens exactly once', () => runtime(async (e) => {
  const { TaskRows } = await e.vite.ssrLoadModule('/src/components/TasksArea.tsx');
  const { ReviewHistoryRows } = await e.vite.ssrLoadModule('/src/components/ReviewHistoryPage.tsx');
  const { ListsRows } = await e.vite.ssrLoadModule('/src/components/ListsOverviewPage.tsx');
  const { ImportantDatesContent } = await e.vite.ssrLoadModule('/src/components/ImportantDatesPage.tsx');
  const { CalendarImportantDateCard } = await e.vite.ssrLoadModule('/src/components/CalendarImportantDates.tsx');
  let opens = 0; const open = () => opens++;
  const trees = [
    TaskRows({ tasks: [task], sourceSpacesById: { s: space }, membersBySpaceId: { s: [] }, userId: 'me', completed: false, busyTaskId: null, openingTask: false, onOpen: open, onChangeStatus() {} }),
    ReviewHistoryRows({ rows: [{ round: { id: 'r', space_id: 's', review_date: '2026-10-15', round_no: 1 }, mine: '未填写', other: null }], onOpenDetail: open }),
    ListsRows({ rows: [{ list, totalItems: 1, completedCount: 0 }], spaces: [space], showSource: true, onOpen: open, onRename() {}, onDelete() {} }),
    ImportantDatesContent({ data: e.m.dates.state.data, filter: 'all', today: e.m.dates.today, pastExpanded: false, canAct: true, onOpen: open, onPastToggle() {} }),
    CalendarImportantDateCard({ item: { importantDateId: 'd', spaceId: 's', name: '重要日', repeatKind: 'annual', occurrenceDate: { year: 2026, month: 10, day: 15 } }, space, showSpaceLabel: true, onOpen: open }),
  ];
  const event = { id: 'event', space_id: 's', title: '日程', scope: 'personal', owner_user_id: 'me', all_day: false, recurrence_rule: null };
  const view = e.app.CalendarViews({ expansion: { occurrences: [{ source_event: event, source_event_id: 'event', occurrence_id: 'event:1', occurrence_starts_at: new Date(2026, 9, 15, 9).toISOString(), occurrence_ends_at: null }], errors: [] },
    selectedDate: new Date(2026, 9, 15), viewMode: 'today', userId: 'me', membersBySpaceId: { s: [] }, spacesById: { s: space }, onEdit: open });
  const day = nodes(view).find((n) => n.type.name === 'DaySection');
  const card = nodes(day.type(day.props)).find((n) => n.type.name === 'EventCard'); trees.push(card.type(card.props));
  let backs = 0; const page = e.render('tasks', { userId: 'me', screen: 'tasks', onHubBack: () => backs++, onScreenChange() {} });
  for (const [index, tree] of trees.entries()) {
    const button = nodes(tree).find((n) => 'data-swipe-start' in n.props); assert.ok(button, `display card ${index} must opt in`);
    button.props.onClick(); assert.equal(opens, index + 1);
    e.swipe(page, 80, e.target(button)); assert.equal(backs, index + 1);
    let suppressed = false; e.guard.onClickCapture({ detail: 1, timeStamp: 210, clientX: 180, clientY: 102, nativeEvent: { pointerId: 1, pointerType: 'touch', isTrusted: true }, preventDefault() { suppressed = true; }, stopPropagation() {} });
    if (!suppressed) button.props.onClick(); assert.equal(opens, index + 1);
  }
}));
