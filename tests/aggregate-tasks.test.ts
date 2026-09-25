import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAggregateTaskLoader,
  defaultTaskCreateTarget,
  eligibleTaskSpaces,
  normalizeTaskFilter,
  readAggregateTasks,
  subscribeTaskRealtimeScope,
  taskFilterSpaces,
  taskRealtimeSpaceIds,
  type TaskFilter,
} from '../src/lib/aggregate-tasks.ts';
import type { CurrentSpace, Task } from '../src/types.ts';

const personal = { id: 'personal', name: 'My very long personal space name', kind: 'personal', created_by: 'me', membershipRole: 'owner' } as CurrentSpace;
const shared = { id: 'shared', name: 'Same name', kind: 'shared', membershipRole: 'member' } as CurrentSpace;
const secondShared = { id: 'second-shared', name: 'Same name', kind: 'shared', membershipRole: 'owner' } as CurrentSpace;
const task = (id: string, space_id: string, due_on: string | null, status: Task['status'] = 'open', assigned_to_user_id: string | null = null, created_at = '2026-09-20T00:00:00Z') => ({
  id, space_id, due_on, status, assigned_to_user_id, created_at, updated_at: created_at, title: id, created_by: 'me',
}) as Task;

test('eligible Tasks Spaces require current membership and an explicit enabled module row', () => {
  const spaces = [personal, shared, secondShared];
  assert.deepEqual(eligibleTaskSpaces(spaces, [
    { space_id: personal.id, enabled: true },
    { space_id: shared.id, enabled: false },
  ]).map((space) => space.id), [personal.id]);
  assert.deepEqual(eligibleTaskSpaces(spaces, [
    { space_id: personal.id, enabled: false },
    { space_id: shared.id, enabled: true },
    { space_id: secondShared.id, enabled: false },
  ]).map((space) => space.id), [shared.id]);
  assert.deepEqual(eligibleTaskSpaces(spaces, []), []);
  assert.deepEqual(eligibleTaskSpaces([personal, { ...shared, membershipRole: undefined } as unknown as CurrentSpace], [
    { space_id: personal.id, enabled: true }, { space_id: shared.id, enabled: true },
  ]).map((space) => space.id), [personal.id]);
});

test('taskFilter defaults to all, retains one eligible Space, and corrects lost eligibility independently', () => {
  const eligible = [personal, shared];
  const selectedSpaceId = shared.id;
  const calendarFilter = { spaceId: shared.id };
  const defaultFilter: TaskFilter = 'all';
  assert.equal(normalizeTaskFilter(defaultFilter, eligible), 'all');
  assert.deepEqual(normalizeTaskFilter({ spaceId: personal.id }, eligible), { spaceId: personal.id });
  assert.deepEqual(taskFilterSpaces(eligible, { spaceId: shared.id }), [shared]);
  assert.equal(normalizeTaskFilter({ spaceId: 'former' }, eligible), 'all');
  assert.equal(normalizeTaskFilter({ spaceId: shared.id }, [personal]), 'all', 'module disable or membership loss resets the filter');
  assert.equal(normalizeTaskFilter({ spaceId: shared.id }, []), 'all');
  assert.deepEqual(taskFilterSpaces(eligible, { spaceId: 'former' }), eligible);
  assert.equal(selectedSpaceId, shared.id);
  assert.deepEqual(calendarFilter, { spaceId: shared.id });
});

test('Task create defaults to Personal for all, including when Personal Tasks is disabled', () => {
  assert.equal(defaultTaskCreateTarget('all', [personal, shared], [shared], 'me'), personal.id);
  assert.equal(defaultTaskCreateTarget({ spaceId: shared.id }, [personal, shared], [shared], 'me'), shared.id);
  assert.equal(defaultTaskCreateTarget('all', [shared], [shared], 'me'), null);
});

test('Task Realtime scope follows eligible all or one-Space filter and cleans obsolete channels', () => {
  assert.deepEqual(taskRealtimeSpaceIds([personal, shared], 'all'), [personal.id, shared.id]);
  assert.deepEqual(taskRealtimeSpaceIds([personal, shared], { spaceId: shared.id }), [shared.id]);
  const active = new Map<string, () => void>();
  const changed: string[] = [];
  const subscribe = (id: string, onChange: () => void) => { active.set(id, onChange); return id; };
  const unsubscribe = (id: string) => { active.delete(id); };
  const allCleanup = subscribeTaskRealtimeScope(taskRealtimeSpaceIds([personal, shared], 'all'), subscribe, unsubscribe, () => changed.push('reread'));
  assert.deepEqual([...active.keys()], [personal.id, shared.id]);
  active.get(shared.id)?.();
  assert.deepEqual(changed, ['reread']);
  allCleanup();
  assert.deepEqual([...active.keys()], []);
  const singleCleanup = subscribeTaskRealtimeScope(taskRealtimeSpaceIds([personal, shared], { spaceId: shared.id }), subscribe, unsubscribe, () => changed.push('reread'));
  assert.deepEqual([...active.keys()], [shared.id]);
  singleCleanup();
  assert.deepEqual([...active.keys()], []);
});

test('aggregate Tasks reads every Space and page, including completed, distant, and other-assignee Tasks', async () => {
  const personalRows = Array.from({ length: 501 }, (_, index) => task(`p${String(index).padStart(3, '0')}`, personal.id, index === 0 ? '2026-09-20' : null));
  const sharedRows = [
    task('other-assignee', shared.id, '2027-12-01', 'open', 'other'),
    task('completed', shared.id, null, 'completed'),
  ];
  const reads: Array<{ spaceId: string; start: number; end: number }> = [];
  const result = await readAggregateTasks([personal, shared], 'all', {
    modulePage: async () => ({ data: [{ space_id: personal.id, enabled: true }, { space_id: shared.id, enabled: true }], count: 2, error: null }),
    taskPage: async (spaceId, start, end) => {
      reads.push({ spaceId, start, end });
      const rows = spaceId === personal.id ? personalRows : sharedRows;
      return { data: rows.slice(start, end + 1), count: rows.length, error: null };
    },
  });
  assert.equal(result.grouped.open.length, 502);
  assert.deepEqual(result.grouped.completed.map((item) => item.id), ['completed']);
  assert.ok(result.grouped.open.some((item) => item.id === 'other-assignee'));
  assert.deepEqual(reads, [
    { spaceId: personal.id, start: 0, end: 499 },
    { spaceId: personal.id, start: 500, end: 999 },
    { spaceId: shared.id, start: 0, end: 499 },
  ]);
});

test('eligible module rows paginate beyond 500 Spaces without dropping later Spaces', async () => {
  const spaces = Array.from({ length: 501 }, (_, index) => ({ ...shared, id: `space-${String(index).padStart(3, '0')}` }));
  const modules = spaces.map((space) => ({ space_id: space.id, enabled: true }));
  const moduleStarts: number[] = [];
  const result = await readAggregateTasks(spaces, 'all', {
    modulePage: async (start, end) => {
      moduleStarts.push(start);
      return { data: modules.slice(start, end + 1), count: modules.length, error: null };
    },
    taskPage: async (spaceId) => ({ data: [task(`task-${spaceId}`, spaceId, null)], count: 1, error: null }),
  });
  assert.deepEqual(moduleStarts, [0, 500]);
  assert.equal(result.eligibleSpaces.length, 501);
  assert.equal(result.grouped.open.length, 501);
  assert.equal(result.grouped.open.at(-1)?.space_id, spaces[500].id);
});

test('single taskFilter applies to open and completed; empty eligibility makes no Task request', async () => {
  const reads: string[] = [];
  const operations = {
    modulePage: async () => ({ data: [{ space_id: personal.id, enabled: true }, { space_id: shared.id, enabled: true }], count: 2, error: null }),
    taskPage: async (spaceId: string) => {
      reads.push(spaceId);
      return { data: [task(`${spaceId}-open`, spaceId, null), task(`${spaceId}-done`, spaceId, null, 'completed')], count: 2, error: null };
    },
  };
  const single = await readAggregateTasks([personal, shared], { spaceId: shared.id }, operations);
  assert.deepEqual(single.grouped.open.map((item) => item.id), ['shared-open']);
  assert.deepEqual(single.grouped.completed.map((item) => item.id), ['shared-done']);
  assert.deepEqual(reads, [shared.id]);
  const empty = await readAggregateTasks([personal], { spaceId: personal.id }, {
    modulePage: async () => ({ data: [{ space_id: personal.id, enabled: false }], count: 1, error: null }),
    taskPage: operations.taskPage,
  });
  assert.deepEqual(empty.grouped, { open: [], completed: [] });
  assert.equal(empty.filter, 'all');
  assert.deepEqual(reads, [shared.id]);
});

test('aggregate Tasks keep canonical due, created_at and id ordering across Spaces', async () => {
  const rows = [
    task('undated', personal.id, null),
    task('future', shared.id, '2026-10-01'),
    task('equal-z', shared.id, '2026-09-25', 'open', null, '2026-09-20T00:00:00Z'),
    task('today', shared.id, '2026-09-25', 'open', null, '2026-09-19T00:00:00Z'),
    task('equal-a', personal.id, '2026-09-25', 'open', null, '2026-09-20T00:00:00Z'),
    task('overdue', personal.id, '2026-09-24'),
    task('done-b', shared.id, '2026-09-25', 'completed'),
    task('done-a', personal.id, '2026-09-24', 'completed'),
  ];
  const result = await readAggregateTasks([personal, shared], 'all', {
    modulePage: async () => ({ data: [personal, shared].map((space) => ({ space_id: space.id, enabled: true })), count: 2, error: null }),
    taskPage: async (spaceId) => {
      const data = rows.filter((item) => item.space_id === spaceId);
      return { data, count: data.length, error: null };
    },
  });
  assert.deepEqual(result.grouped.open.map((item) => item.id), ['overdue', 'today', 'equal-a', 'equal-z', 'future', 'undated']);
  assert.deepEqual(result.grouped.completed.map((item) => item.id), ['done-a', 'done-b']);
});

test('source identity uses canonical Space ID even when display names are long or duplicated', async () => {
  const result = await readAggregateTasks([personal, shared, secondShared], 'all', {
    modulePage: async () => ({ data: [personal, shared, secondShared].map((space) => ({ space_id: space.id, enabled: true })), count: 3, error: null }),
    taskPage: async (spaceId) => ({ data: [task(`task-${spaceId}`, spaceId, null)], count: 1, error: null }),
  });
  assert.equal(result.sourceSpacesById[personal.id].name, personal.name);
  assert.equal(result.sourceSpacesById[shared.id].name, result.sourceSpacesById[secondShared.id].name);
  assert.notEqual(result.sourceSpacesById[shared.id].id, result.sourceSpacesById[secondShared.id].id);
  for (const item of result.grouped.open) assert.equal(result.sourceSpacesById[item.space_id].id, item.space_id);
});

test('module errors, duplicate Tasks, wrong-Space rows and incomplete pagination fail the whole read', async () => {
  const enabled = async () => ({ data: [{ space_id: personal.id, enabled: true }, { space_id: shared.id, enabled: true }], count: 2, error: null });
  const personalEnabled = async () => ({ data: [{ space_id: personal.id, enabled: true }], count: 1, error: null });
  let taskReads = 0;
  await assert.rejects(readAggregateTasks([personal, shared], 'all', {
    modulePage: async () => ({ data: null, count: null, error: new Error('module unavailable') }),
    taskPage: async () => { taskReads += 1; return { data: [], count: 0, error: null }; },
  }), /module unavailable/);
  assert.equal(taskReads, 0);
  await assert.rejects(readAggregateTasks([personal, shared], 'all', {
    modulePage: enabled,
    taskPage: async (spaceId) => ({ data: [task('duplicate', spaceId, null)], count: 1, error: null }),
  }), /身份重复/);
  await assert.rejects(readAggregateTasks([personal], 'all', {
    modulePage: personalEnabled,
    taskPage: async () => ({ data: [task('wrong', shared.id, null)], count: 1, error: null }),
  }), /任务数据身份校验失败/);
  await assert.rejects(readAggregateTasks([personal], 'all', {
    modulePage: personalEnabled,
    taskPage: async (spaceId, start) => ({ data: start ? [] : [task('first', spaceId, null)], count: 2, error: null }),
  }), /任务数据读取不完整/);
});

test('a null successful module page fails instead of treating every Space as disabled', async () => {
  let taskReads = 0;
  await assert.rejects(readAggregateTasks([personal], 'all', {
    modulePage: async () => ({ data: null, count: 0, error: null }),
    taskPage: async () => { taskReads += 1; return { data: [], count: 0, error: null }; },
  }), /任务模块/);
  assert.equal(taskReads, 0);

  const empty = await readAggregateTasks([personal], 'all', {
    modulePage: async () => ({ data: [], count: 0, error: null }),
    taskPage: async () => { taskReads += 1; return { data: [], count: 0, error: null }; },
  });
  assert.deepEqual(empty.eligibleSpaces, []);
  assert.equal(taskReads, 0);
});

test('older aggregate responses cannot publish after filter, user, eligibility or lifecycle changes', async () => {
  const pending: Array<(value: string) => void> = [];
  const published: string[] = [];
  const loader = createAggregateTaskLoader(async (_userId, _filter) => new Promise<string>((resolve) => { pending.push(resolve); }));
  const publish = (result: { status: 'ready'; data: string } | { status: 'error'; error: unknown }) => published.push(result.status === 'ready' ? result.data : 'error');
  const first = loader.load('user-a', 'all', publish);
  const second = loader.load('user-a', { spaceId: shared.id }, publish);
  pending[1]('filtered');
  await second;
  pending[0]('old all');
  await first;
  assert.deepEqual(published, ['filtered']);
  const oldUser = loader.load('user-a', 'all', publish);
  const newUser = loader.load('user-b', 'all', publish);
  pending[2]('old user');
  pending[3]('new user');
  await Promise.all([oldUser, newUser]);
  assert.deepEqual(published, ['filtered', 'new user']);
  const oldEligibility = loader.load('user-b', 'all', publish);
  const refreshedEligibility = loader.load('user-b', 'all', publish);
  pending[4]('old eligible set');
  pending[5]('new eligible set');
  await Promise.all([oldEligibility, refreshedEligibility]);
  assert.deepEqual(published, ['filtered', 'new user', 'new eligible set']);
  const unmounted = loader.load('user-b', 'all', publish);
  loader.invalidate();
  pending[6]('after unmount');
  await unmounted;
  assert.deepEqual(published, ['filtered', 'new user', 'new eligible set']);
});

test('current read errors are explicit and stale read errors cannot replace a newer result', async () => {
  const pending: Array<{ resolve: (value: string) => void; reject: (error: Error) => void }> = [];
  const published: string[] = [];
  const loader = createAggregateTaskLoader(() => new Promise<string>((resolve, reject) => { pending.push({ resolve, reject }); }));
  const publish = (result: { status: 'ready'; data: string } | { status: 'error'; error: unknown }) => {
    published.push(result.status === 'ready' ? result.data : (result.error as Error).message);
  };
  const failed = loader.load('user-a', 'all', publish);
  pending[0].reject(new Error('module state unknown'));
  await failed;
  assert.deepEqual(published, ['module state unknown']);
  const stale = loader.load('user-a', 'all', publish);
  const fresh = loader.load('user-a', { spaceId: shared.id }, publish);
  pending[2].resolve('fresh');
  await fresh;
  pending[1].reject(new Error('stale failure'));
  await stale;
  assert.deepEqual(published, ['module state unknown', 'fresh']);
});
