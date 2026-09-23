import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupTasks,
  formatTaskDueDate,
  normalizeTaskTitle,
  taskAssignmentFromValue,
  taskAssignmentLabel,
  taskAssignmentOptions,
  canChangeTaskStatus,
  taskEditableChanges,
  taskRealtimeConfig,
} from '../src/lib/task.ts';
import type { SpaceMember, Task } from '../src/types.ts';

const baseTask: Task = {
  id: 'task-1',
  space_id: 'space-1',
  created_by: 'user-1',
  assigned_to_user_id: null,
  title: 'Example',
  status: 'open',
  due_on: null,
  created_at: '2026-09-20T08:00:00Z',
  updated_at: '2026-09-20T08:00:00Z',
};

const members: SpaceMember[] = [
  { space_id: 'space-1', user_id: 'user-1', role: 'owner', joined_at: '2026-09-01T00:00:00Z', profiles: { display_name: null } },
  { space_id: 'space-1', user_id: 'user-2', role: 'member', joined_at: '2026-09-02T00:00:00Z', profiles: { display_name: null } },
];

test('groups open and completed tasks with due dates first and deterministic ties', () => {
  const tasks: Task[] = [
    { ...baseTask, id: 'undated-later', due_on: null, created_at: '2026-09-21T08:00:00Z' },
    { ...baseTask, id: 'dated-z', due_on: '2026-09-25', created_at: '2026-09-20T08:00:00Z' },
    { ...baseTask, id: 'completed', status: 'completed', due_on: '2026-09-24' },
    { ...baseTask, id: 'dated-b', due_on: '2026-09-25', created_at: '2026-09-19T08:00:00Z' },
    { ...baseTask, id: 'undated-first', due_on: null, created_at: '2026-09-20T08:00:00Z' },
    { ...baseTask, id: 'dated-a', due_on: '2026-09-25', created_at: '2026-09-19T08:00:00Z' },
    { ...baseTask, id: 'earliest', due_on: '2026-09-23' },
  ];

  const result = groupTasks(tasks);
  assert.deepEqual(result.open.map((task) => task.id), [
    'earliest', 'dated-a', 'dated-b', 'dated-z', 'undated-first', 'undated-later',
  ]);
  assert.deepEqual(result.completed.map((task) => task.id), ['completed']);
  assert.equal(tasks[0].id, 'undated-later', 'grouping must not mutate canonical input');
});

test('completed tasks use the same stable order without inventing completion time', () => {
  const tasks: Task[] = [
    { ...baseTask, id: 'later', status: 'completed', due_on: null, created_at: '2026-09-21T08:00:00Z' },
    { ...baseTask, id: 'earlier', status: 'completed', due_on: '2026-09-18' },
  ];
  assert.deepEqual(groupTasks(tasks).completed.map((task) => task.id), ['earlier', 'later']);
});

test('trims valid titles and rejects blank or overlong titles', () => {
  assert.equal(normalizeTaskTitle('  买洗衣液  '), '买洗衣液');
  assert.throws(() => normalizeTaskTitle(' \n '), /标题/);
  assert.throws(() => normalizeTaskTitle('a'.repeat(201)), /200/);
  assert.equal(normalizeTaskTitle('😀'.repeat(200)), '😀'.repeat(200));
});

test('assignment maps Shared to null and members to their IDs', () => {
  assert.equal(taskAssignmentFromValue('', members), null);
  assert.equal(taskAssignmentFromValue('user-2', members), 'user-2');
  assert.throws(() => taskAssignmentFromValue('former-member', members), /成员/);
});

test('status controls belong to any member for Shared and only the assignee for assigned Tasks', () => {
  assert.equal(canChangeTaskStatus(baseTask, 'user-1'), true);
  assert.equal(canChangeTaskStatus(baseTask, 'user-2'), true);
  const assigned = { ...baseTask, assigned_to_user_id: 'user-2' };
  assert.equal(canChangeTaskStatus(assigned, 'user-1'), false);
  assert.equal(canChangeTaskStatus(assigned, 'user-2'), true);
  assert.equal(canChangeTaskStatus({ ...assigned, status: 'completed' }, 'user-1'), false);
});

test('member labels prefer display_name and use contextual fallbacks only for real members', () => {
  const named = [{ ...members[0], profiles: { display_name: 'Ping' } }, members[1]];
  assert.deepEqual(taskAssignmentOptions(named, 'user-1'), [
    { value: '', label: '共同' },
    { value: 'user-1', label: 'Ping' },
    { value: 'user-2', label: '对方' },
  ]);
  assert.equal(taskAssignmentLabel(null, named, 'user-1'), '共同');
  assert.equal(taskAssignmentLabel('user-2', members, 'user-1'), '对方');
  assert.equal(taskAssignmentLabel('user-1', members, 'user-1'), '我');
  assert.deepEqual(taskAssignmentOptions([members[0]], 'user-1'), [
    { value: '', label: '共同' },
    { value: 'user-1', label: '我' },
  ]);
  assert.equal(taskAssignmentOptions(members, 'user-2')[1].label, '对方');
  assert.equal(taskAssignmentOptions(members, 'user-2')[2].label, '我');
});

test('Realtime listens only to current Space task changes', () => {
  assert.deepEqual(taskRealtimeConfig('space-1'), {
    event: '*',
    schema: 'public',
    table: 'tasks',
    filter: 'space_id=eq.space-1',
  });
});

test('date-only due labels do not shift with browser timezone', () => {
  assert.equal(formatTaskDueDate('2026-09-25'), '9月25日');
  assert.equal(formatTaskDueDate(null), null);
});

test('editing one field leaves concurrent changes to other fields untouched', () => {
  assert.deepEqual(taskEditableChanges(baseTask, {
    title: 'Renamed',
    assigned_to_user_id: null,
    due_on: null,
  }), { title: 'Renamed' });
  assert.deepEqual(taskEditableChanges(baseTask, {
    title: baseTask.title,
    assigned_to_user_id: 'user-2',
    due_on: '2026-09-25',
  }), { assigned_to_user_id: 'user-2', due_on: '2026-09-25' });
  assert.deepEqual(taskEditableChanges(baseTask, {
    title: baseTask.title,
    assigned_to_user_id: null,
    due_on: null,
  }), {});
});
