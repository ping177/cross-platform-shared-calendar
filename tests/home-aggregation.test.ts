import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { homeEventRange, readHomeEvents, readHomeTasks, visibleHomeEvents, visibleHomeTasks } from '../src/lib/home-aggregation.ts';
import type { CalendarEvent, CurrentSpace, EventOccurrenceException, SpaceMember, Task } from '../src/types.ts';

const personal = { id: 'personal', name: '我的空间', kind: 'personal', membershipRole: 'owner' } as CurrentSpace;
const shared = { id: 'shared', name: '我们的日历', kind: 'shared', membershipRole: 'member' } as CurrentSpace;
const member = (space_id: string) => ({ space_id, user_id: 'me', profiles: { display_name: '我' } }) as SpaceMember;
const event = (id: string, space_id: string, starts_at: string, all_day = false, recurring = false) => ({
  id, space_id, starts_at, ends_at: null, all_day, title: id, description: null, scope: 'shared', owner_user_id: null,
  recurrence_rule: recurring ? { version: 1, frequency: 'daily', interval: 1, time_zone: 'Asia/Shanghai' } : null,
  recurrence_until: null,
}) as CalendarEvent;
const task = (id: string, space_id: string, due_on: string | null, assigned_to_user_id: string | null = null, status: Task['status'] = 'open') => ({
  id, space_id, due_on, assigned_to_user_id, status, title: id, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
}) as Task;

test('Home covers three local calendar days and sorts same-day all-day before timed with stable ties', () => {
  const range = homeEventRange(new Date(2026, 8, 24, 23, 30));
  assert.equal(range.start.getDate(), 24);
  assert.equal(range.end.getDate(), 26);
  assert.equal(range.end.getHours(), 23);
  const items = [
    event('timed', shared.id, new Date(2026, 8, 24, 9).toISOString()),
    event('all', personal.id, new Date(2026, 8, 24, 10).toISOString(), true),
    event('outside', shared.id, new Date(2026, 8, 27).toISOString()),
  ];
  const result = visibleHomeEvents(items, [], range);
  assert.deepEqual(result.map((item) => item.source_event_id), ['all', 'timed']);
  assert.equal(result[0].source_event.space_id, personal.id);
});

test('Home Event read includes old recurring sources and exceptions moved into its window', async () => {
  const range = homeEventRange(new Date(2026, 8, 24, 12));
  const old = event('old', shared.id, new Date(2020, 0, 1, 9).toISOString(), false, true);
  const ordinary = event('personal', personal.id, new Date(2026, 8, 25, 9).toISOString());
  const exception = { id: 'override', event_id: old.id, occurrence_date: '2026-09-20', exception_type: 'override', override_data: { starts_at: new Date(2026, 8, 26, 10).toISOString() } } as EventOccurrenceException;
  const result = await readHomeEvents([personal, shared], range, {
    eventPage: async (spaceId, kind) => ({ data: kind === 'recurring' && spaceId === shared.id ? [old] : kind === 'starting' && spaceId === personal.id ? [ordinary] : [], count: kind === 'recurring' && spaceId === shared.id || kind === 'starting' && spaceId === personal.id ? 1 : 0, error: null }),
    exceptionPage: async () => ({ data: [exception], count: 1, error: null }),
    members: async (spaceId) => [member(spaceId)],
  });
  assert.ok(result.occurrences.some((item) => item.source_event_id === old.id && item.occurrence_date === '2026-09-20'));
  assert.ok(result.occurrences.some((item) => item.source_event_id === ordinary.id));
  assert.equal(result.membersBySpaceId[shared.id][0].space_id, shared.id);
});

test('Home projection retains only-this deletion and this-and-future source identity', () => {
  const range = homeEventRange(new Date(2026, 8, 24, 12));
  const old = { ...event('old', shared.id, new Date(2026, 8, 23, 9).toISOString(), false, true), recurrence_until: new Date(2026, 8, 25, 9).toISOString() };
  const child = { ...event('child', shared.id, new Date(2026, 8, 25, 9).toISOString(), false, true), series_id: old.id, parent_event_id: old.id } as CalendarEvent;
  const exceptions = [{ id: 'deleted', event_id: old.id, occurrence_date: '2026-09-24', exception_type: 'deleted', override_data: null }] as EventOccurrenceException[];
  const result = visibleHomeEvents([old, child], exceptions, range);
  assert.ok(!result.some((item) => item.source_event_id === old.id && item.occurrence_date === '2026-09-24'));
  assert.ok(result.some((item) => item.source_event_id === child.id && item.occurrence_date === '2026-09-25'));
});

test('Home Event read rejects a later Space failure instead of returning first Space rows', async () => {
  await assert.rejects(readHomeEvents([personal, shared], homeEventRange(new Date(2026, 8, 24)), {
    eventPage: async (spaceId, kind) => spaceId === personal.id
      ? { data: kind === 'starting' ? [event('first', personal.id, new Date(2026, 8, 24).toISOString())] : [], count: kind === 'starting' ? 1 : 0, error: null }
      : { data: [], count: null, error: new Error('second Space unavailable') },
    exceptionPage: async () => ({ data: [], count: 0, error: null }),
    members: async (spaceId) => [member(spaceId)],
  }));
});

test('Home Task candidates include overdue, today, seven future days and undated; exclude other assignee and completed', () => {
  const today = new Date(2026, 8, 24, 12);
  const result = visibleHomeTasks([
    task('undated', shared.id, null), task('other', shared.id, '2026-09-23', 'other'),
    task('late', personal.id, '2026-09-23'), task('today', shared.id, '2026-09-24', 'me'),
    task('edge', shared.id, '2026-10-01'), task('outside', shared.id, '2026-10-02'),
    task('done', shared.id, '2026-09-24', null, 'completed'),
  ], 'me', today);
  assert.deepEqual(result.map((item) => item.id), ['late', 'today', 'edge', 'undated']);
});

test('Home Task module gate excludes disabled or absent Space and rejects incomplete reads', async () => {
  const modules = [{ space_id: personal.id, enabled: true }];
  const result = await readHomeTasks([personal, shared], 'me', new Date(2026, 8, 24), {
    modulePage: async () => ({ data: modules, count: 1, error: null }),
    taskPage: async (spaceId) => ({ data: [task('one', spaceId, null)], count: 1, error: null }),
    members: async (spaceId) => [member(spaceId)],
  });
  assert.deepEqual(result.enabledSpaceIds, [personal.id]);
  assert.deepEqual(result.tasks.map((item) => item.space_id), [personal.id]);
  await assert.rejects(readHomeTasks([personal, shared], 'me', new Date(2026, 8, 24), {
    modulePage: async () => ({ data: modules, count: 1, error: null }),
    taskPage: async () => ({ data: [], count: null, error: new Error('failed') }),
    members: async (spaceId) => [member(spaceId)],
  }));
  let taskRead = false;
  await assert.rejects(readHomeTasks([personal, shared], 'me', new Date(2026, 8, 24), {
    modulePage: async () => ({ data: [], count: null, error: new Error('module unavailable') }),
    taskPage: async () => { taskRead = true; return { data: [], count: 0, error: null }; },
    members: async (spaceId) => [member(spaceId)],
  }));
  assert.equal(taskRead, false);
});

test('Home sections distinguish loading, empty and errors and expand only current candidates', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { HomeSection } = await vite.ssrLoadModule('/src/components/HomePage.tsx');
    const items = Array.from({ length: 7 }, (_, index) => React.createElement('span', { key: index }, `对象${index}`));
    const props = { title: '近期日程', status: 'success', error: '', items, expanded: false, empty: '暂无', onToggle: () => undefined, onRetry: () => undefined };
    const collapsed = renderToStaticMarkup(React.createElement(HomeSection, props));
    assert.match(collapsed, /对象4.*展开更多/);
    assert.doesNotMatch(collapsed, /对象5/);
    const expanded = renderToStaticMarkup(React.createElement(HomeSection, { ...props, expanded: true }));
    assert.match(expanded, /对象6.*收起/);
    const failed = renderToStaticMarkup(React.createElement(HomeSection, { ...props, status: 'error', error: '读取失败' }));
    assert.match(failed, /读取失败.*重试/);
    assert.doesNotMatch(failed, /对象0|暂无/);
    const empty = renderToStaticMarkup(React.createElement(HomeSection, { ...props, items: [] }));
    assert.match(empty, /暂无/);
    const loading = renderToStaticMarkup(React.createElement(HomeSection, { ...props, status: 'loading' }));
    assert.match(loading, /正在读取/);
    const independent = failed + renderToStaticMarkup(React.createElement(HomeSection, { ...props, title: '需要处理的任务' }));
    assert.match(independent, /读取失败/);
    assert.match(independent, /对象0/);
  } finally { await vite.close(); }
});

test('Home independent Space/member/source reads start together while required failure remains all-or-nothing', async () => {
  let release!: () => void; const barrier = new Promise<void>((yes) => { release = yes; }); const calls: string[] = [];
  const read = readHomeEvents([personal, shared], homeEventRange(new Date(2026, 8, 24)), {
    members: async (spaceId) => { calls.push(`members:${spaceId}`); await barrier; return [member(spaceId)]; },
    eventPage: async (spaceId, kind) => { calls.push(`${kind}:${spaceId}`); await barrier; return { data: [], count: 0, error: null }; },
    exceptionPage: async () => { throw new Error('No recurring sources'); },
  });
  try { assert.equal(calls.length, 8); } finally { release(); }
  assert.deepEqual((await read).occurrences, []);
});

test('Home Task setup qualification precedes parallel eligible Space/member/task reads', async () => {
  let release!: () => void; const barrier = new Promise<void>((yes) => { release = yes; }); const calls: string[] = [];
  const read = readHomeTasks([personal, shared], 'me', new Date(2026, 8, 24), {
    modulePage: async () => { calls.push('modules'); return { data: [personal, shared].map((space) => ({ space_id: space.id, enabled: true })), count: 2, error: null }; },
    members: async (id) => { calls.push(`members:${id}`); await barrier; return [member(id)]; },
    taskPage: async (id) => { calls.push(`tasks:${id}`); await barrier; return { data: [task(id, id, null)], count: 1, error: null }; },
  });
  for (let n = 0; n < 6; n++) await Promise.resolve();
  try { assert.equal(calls[0], 'modules'); assert.equal(calls.length, 5); } finally { release(); }
  assert.equal((await read).tasks.length, 2);
});

test('parallel Home readers retain sequential complete pagination and all recurring exception pages', async () => {
  const today = new Date(2026, 8, 24); const starts = today.toISOString(); const calls: any[] = [];
  const recurring = event('series', shared.id, starts, false, true);
  const once = Array.from({ length: 501 }, (_, n) => event(`once-${n}`, shared.id, starts));
  const exceptions = Array.from({ length: 501 }, (_, n) => ({ id: `ex-${n}`, event_id: recurring.id, occurrence_date: new Date(2020, 0, n + 1).toISOString().slice(0, 10), exception_type: 'deleted', override_data: null } as EventOccurrenceException));
  const result = await readHomeEvents([shared], homeEventRange(today), {
    members: async (id) => [member(id)],
    eventPage: async (_id, kind, start, end) => { calls.push([kind, start]); const rows = kind === 'starting' ? once : kind === 'recurring' ? [recurring] : []; return { data: rows.slice(start, end + 1), count: rows.length, error: null }; },
    exceptionPage: async (_ids, start, end) => { calls.push(['exceptions', start]); return { data: exceptions.slice(start, end + 1), count: exceptions.length, error: null }; },
  });
  assert.deepEqual(calls.filter(([kind]) => kind === 'starting'), [['starting', 0], ['starting', 500]]);
  assert.deepEqual(calls.filter(([kind]) => kind === 'exceptions'), [['exceptions', 0], ['exceptions', 500]]);
  assert.equal(result.occurrences.filter((item) => item.source_event_id.startsWith('once-')).length, 501);
  assert.ok(calls.findIndex(([kind]) => kind === 'exceptions') > calls.findIndex(([kind, start]) => kind === 'starting' && start === 500));
  const tasks = Array.from({ length: 501 }, (_, n) => task(`task-${n}`, shared.id, null)); const taskPages: number[] = [];
  const loaded = await readHomeTasks([shared], 'me', today, {
    modulePage: async () => ({ data: [{ space_id: shared.id, enabled: true }], count: 1, error: null }),
    members: async (id) => [member(id)],
    taskPage: async (_id, start, end) => { taskPages.push(start); return { data: tasks.slice(start, end + 1), count: tasks.length, error: null }; },
  });
  assert.deepEqual(taskPages, [0, 500]); assert.equal(loaded.tasks.length, 501);
});

test('confirmed Task eligibility is published before source failure without partial presentation result', async () => {
  let confirmed: CurrentSpace[] | undefined;
  await assert.rejects(readHomeTasks([personal, shared], 'me', new Date(2026, 8, 24), {
    modulePage: async () => ({ data: [{ space_id: personal.id, enabled: true }, { space_id: shared.id, enabled: false }], count: 2, error: null }),
    onEligible: (spaces) => { confirmed = spaces; }, members: async (id) => [member(id)],
    taskPage: async () => ({ data: [], count: null, error: new Error('source offline') }),
  }), /source offline/);
  assert.deepEqual(confirmed, [personal]);
});
