import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { createServer } from 'vite';

const personal = { id: 'personal', kind: 'personal', created_by: 'me', name: '我的空间', membershipRole: 'owner' };
const shared = { id: 'shared', kind: 'shared', created_by: 'other', name: '我们的日历', membershipRole: 'member' };
const nodes = (tree: any): any[] => React.isValidElement(tree) ? [tree, ...React.Children.toArray((tree.props as any).children).flatMap(nodes)] : [];
async function runtime(run: (e: any) => Promise<void>) {
  let cursor = 0; const slots: any[] = [];
  const m: any = { listed: [personal, shared], user: 'me', reads: 0, fail: false, payloads: [],
    useState(initial: any) { const i = cursor++; slots[i] ??= typeof initial === 'function' ? initial() : initial; return [slots[i], (value: any) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial: any) { return slots[cursor++] ??= { current: initial }; }, useEffect() { cursor++; }, useMemo(fn: any) { cursor++; return fn(); }, useCallback(fn: any) { cursor++; return fn; },
    events: { status: 'success', authLost: false, presentation: null, membersBySpaceId: {}, isFresh: () => true, refresh() {} },
    dates: { items: [], state: { calendarComplete: true }, editor: { editor: null, deleting: false, busy: false, targetRead: { loading: false }, close() {} } },
    list: async () => { m.reads++; if (m.wait) await m.wait; if (m.fail) throw new Error('fixture failure'); return m.listed; },
    members: async (id: string) => m.invalidMembers ? [] : [{ space_id: id, user_id: 'me', role: 'owner' }, ...(id === 'shared' ? [{ space_id: id, user_id: 'other', role: 'member' }] : [])],
  };
  (globalThis as any).__calendarCreate = m;
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', appType: 'custom', ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] }, server: { middlewareMode: true, hmr: false }, plugins: [{
    name: 'calendar-create-fixture', enforce: 'pre', resolveId(id, importer) {
      if (id === 'react' && (importer?.includes('/components/') || importer?.endsWith('/App.tsx'))) return '\0create-hooks';
      if (/\/supabase(?:\.ts)?$/.test(id)) return '\0create-client';
      for (const name of ['useCalendarEvents', 'useCalendarImportantDates', 'current-spaces', 'space-members']) if (id.endsWith('/' + name) || id.endsWith('/' + name + '.ts')) return '\0create-' + name;
    }, load(id) {
      if (id === '\0create-hooks') return 'export const {useState,useRef,useEffect,useMemo,useCallback}=globalThis.__calendarCreate;';
      if (id === '\0create-client') return 'const m=globalThis.__calendarCreate; export const supabase={auth:{getUser:async()=>({data:{user:{id:m.user}},error:null})},from:()=>({insert:async(payload)=>{m.payloads.push(payload);if(m.saveWait)await m.saveWait;return {error:m.saveError?new Error(\"fixture save failure\"):null};}})};';
      if (id === '\0create-useCalendarEvents') return 'export const useCalendarEvents=()=>globalThis.__calendarCreate.events;';
      if (id === '\0create-useCalendarImportantDates') return 'export const useCalendarImportantDates=()=>globalThis.__calendarCreate.dates;';
      if (id === '\0create-current-spaces') return 'export const listCurrentSpaces=(...args)=>globalThis.__calendarCreate.list(...args);';
      if (id === '\0create-space-members') return 'export const readSpaceMembers=(...args)=>globalThis.__calendarCreate.members(...args);';
    },
  }] } as any);
  try {
    const { CurrentSpaceApp, EventSheet } = await vite.ssrLoadModule('/src/App.tsx'); const changes: any[] = [];
    const props: any = { session: { user: { id: 'me' } }, spaces: [personal, shared], allSpaces: [personal, shared], calendarFilter: 'all', selectedDate: new Date('2026-10-18T12:00:00'), viewMode: 'week', onCalendarFilterChange: (x: any) => changes.push(x), onSelectedDateChange: (x: any) => changes.push(x), onViewModeChange: (x: any) => changes.push(x) };
    const render = () => { cursor = 0; return CurrentSpaceApp(props); };
    const button = () => nodes(render()).find(n => n.type === 'button' && n.props['aria-label'] === '新建日程');
    const sheet = () => nodes(render()).find(n => n.type?.name === 'EventSheet');
    const picker = () => nodes(render()).find(n => n.type?.name === 'CalendarFilterPicker' && n.props.purpose === 'create');
    const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };
    const form = (formProps: any) => { slots.length = 0; return () => { cursor = 0; return EventSheet(formProps); }; };
    await run({ m, props, render, button, sheet, picker, changes, flush, form });
  } finally { await vite.close(); delete (globalThis as any).__calendarCreate; }
}

test('all and specific filters open an editable form immediately with Personal/current defaults', () => runtime(async e => {
  e.button().props.onClick(); assert.ok(e.sheet()); assert.equal(e.picker(), undefined); await e.flush();
  assert.equal(e.sheet().props.space.id, 'personal'); assert.equal(e.sheet().props.createTarget.selectedId, 'personal');
  e.sheet().props.createTarget.onSelect('shared'); await e.flush(); assert.equal(e.sheet().props.space.id, 'shared');
  e.sheet().props.onClose(); e.props.calendarFilter = { spaceId: 'shared' };
  e.button().props.onClick(); await e.flush(); assert.equal(e.sheet().props.createTarget.selectedId, 'shared');
  e.sheet().props.createTarget.onSelect('personal'); await e.flush(); assert.equal(e.sheet().props.space.id, 'personal');
  e.sheet().props.onClose(); assert.deepEqual(e.changes, []);
}));
test('single target, failed reads and no legal targets keep safe form state and retry', () => runtime(async e => {
  e.m.listed = [personal]; e.button().props.onClick(); await e.flush(); assert.equal(e.sheet().props.space.id, 'personal');
  e.m.listed = []; e.sheet().props.createTarget.onRetry(); await e.flush(); assert.equal(e.sheet().props.createTarget.state, 'error');
  assert.equal(await e.sheet().props.validateCreateTarget('me'), false);
  e.m.listed = [personal]; e.sheet().props.createTarget.onRetry(); await e.flush(); assert.equal(e.sheet().props.createTarget.state, 'ready');
  e.m.invalidMembers = true; e.sheet().props.createTarget.onRetry(); await e.flush(); assert.equal(e.sheet().props.createTarget.state, 'error');
  const renderForm = e.form(e.sheet().props);
  assert.equal(nodes(renderForm()).find(n => n.type === 'button' && n.props.form === 'event-sheet-form').props.disabled, true);
}));
test('cancel, scope change and same-tick plus ignore late target responses', () => runtime(async e => {
  let release = () => {}; e.m.wait = new Promise<void>(r => { release = r; });
  e.button().props.onClick(); e.button().props.onClick(); await e.flush(); assert.equal(e.m.reads, 1);
  e.sheet().props.onClose(); release(); await e.flush(); assert.equal(e.sheet(), undefined); assert.deepEqual(e.changes, []);
  e.m.wait = null; e.button().props.onClick(); await e.flush();
  e.props.selectedDate = new Date('2026-10-19T12:00:00'); e.render(); assert.equal(e.sheet(), undefined);
}));
test('save guard checks final target, removed membership, related member and account', () => runtime(async e => {
  e.button().props.onClick(); await e.flush(); e.sheet().props.createTarget.onSelect('shared'); await e.flush();
  const validate = e.sheet().props.validateCreateTarget;
  assert.equal(await validate('other'), true); assert.equal(await validate('outsider'), false);
  e.m.user = 'other'; assert.equal(await validate('me'), false); e.m.user = 'me';
  e.m.listed = []; assert.equal(await validate('me'), false);
}));
test('form preserves title when target changes and inserts final target with duplicate protection and retry', () => runtime(async e => {
  e.props.calendarFilter = { spaceId: 'shared' }; e.button().props.onClick(); await e.flush();
  const props = { ...e.sheet().props }; let closed = 0; props.onClose = () => closed++;
  const renderForm = e.form(props);
  const title = () => nodes(renderForm()).find(n => n.type === 'input' && n.props.type === undefined);
  title().props.onChange({ target: { value: '保留草稿' } });
  const dates = () => nodes(renderForm()).filter(n => n.type === 'input' && n.props.type === 'datetime-local');
  dates()[0].props.onChange({ target: { value: '2026-10-22T10:00' } });
  dates()[1].props.onChange({ target: { value: '2026-10-22T12:00' } });
  nodes(renderForm()).find(n => n.type === 'select').props.onChange({ target: { value: 'timed_30m_before' } });
  nodes(renderForm()).find(n => n.type === 'textarea').props.onChange({ target: { value: '描述保留' } });
  nodes(renderForm()).find(n => n.type?.name === 'RecurrenceControls').props.onFrequencyChange('weekly');
  let selected = ''; props.createTarget = { ...props.createTarget, onSelect: (id: string) => { selected = id; } };
  nodes(renderForm()).find(n => n.type?.name === 'CreateTargetSelector').props.control.onSelect('personal');
  assert.equal(selected, 'personal');
  props.space = personal; props.members = [{ space_id: 'personal', user_id: 'me', role: 'owner' }];
  props.createTarget = { ...props.createTarget, selectedId: 'personal' }; props.validateCreateTarget = async () => true;
  assert.equal(title().props.value, '保留草稿');
  assert.deepEqual(dates().map(n => n.props.value), ['2026-10-22T10:00', '2026-10-22T12:00']);
  assert.equal(nodes(renderForm()).find(n => n.type === 'textarea').props.value, '描述保留');
  assert.equal(nodes(renderForm()).find(n => n.type === 'select').props.value, 'timed_30m_before');
  assert.equal(nodes(renderForm()).find(n => n.type?.name === 'RecurrenceControls').props.recurrence.frequency, 'weekly');
  const submit = () => nodes(renderForm()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  submit(); const confirm = () => nodes(renderForm()).find(n => n.type === 'button' && n.props.children === '确认保存');
  let release = () => {}; e.m.saveWait = new Promise<void>(r => { release = r; }); e.m.saveError = true;
  const confirmation = confirm(); confirmation.props.onClick(); confirmation.props.onClick(); await e.flush();
  assert.equal(e.m.payloads.length, 1); assert.equal(e.m.payloads[0].space_id, 'personal');
  release(); await e.flush(); assert.equal(closed, 0); assert.equal(title().props.value, '保留草稿');
  e.m.saveWait = null; e.m.saveError = false; submit(); confirm().props.onClick(); await e.flush(); assert.equal(e.m.payloads.length, 2); assert.equal(closed, 1);
}));

test('no available Space keeps unique plus disabled with explanation', () => runtime(async e => {
  e.props.allSpaces = []; e.props.spaces = []; e.m.listed = [];
  assert.equal(e.button().props.disabled, true);
  assert.ok(nodes(e.render()).some(n => n.type === 'p' && String(n.props.children).includes('没有可用空间')));
  assert.equal(e.sheet(), undefined);
}));
test('rapid target switching rejects earlier member responses and preserves final selection', () => runtime(async e => {
  e.button().props.onClick(); await e.flush();
  let release = () => {}; e.m.wait = new Promise<void>(r => { release = r; });
  e.sheet().props.createTarget.onSelect('shared'); await e.flush();
  e.m.wait = null; e.sheet().props.createTarget.onSelect('personal'); await e.flush();
  release(); await e.flush(); assert.equal(e.sheet().props.space.id, 'personal');
  assert.equal(e.sheet().props.createTarget.selectedId, 'personal'); assert.equal(e.sheet().props.createTarget.state, 'ready');
}));
