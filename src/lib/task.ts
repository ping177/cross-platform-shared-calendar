import { normalizeMemberDisplayName } from './member.ts';
import type { SpaceMember, Task } from '../types.ts';

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareTasks(left: Task, right: Task) {
  if (left.due_on === null || right.due_on === null) {
    if (left.due_on !== right.due_on) return left.due_on === null ? 1 : -1;
  } else {
    const dueOrder = compareText(left.due_on, right.due_on);
    if (dueOrder !== 0) return dueOrder;
  }

  return compareText(left.created_at, right.created_at) || compareText(left.id, right.id);
}

export function groupTasks(tasks: Task[]) {
  return {
    open: tasks.filter((task) => task.status === 'open').sort(compareTasks),
    completed: tasks.filter((task) => task.status === 'completed').sort(compareTasks),
  };
}

export function normalizeTaskTitle(value: string) {
  const title = value.trim();
  if (!title) throw new Error('标题不能为空。');
  if (Array.from(title).length > 200) throw new Error('标题不能超过 200 个字符。');
  return title;
}

export function formatTaskDueDate(dueOn: string | null) {
  if (dueOn === null) return null;
  const [, month, day] = dueOn.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

export function taskErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Task 操作失败，请稍后再试。';
}

function taskMemberLabel(member: SpaceMember, members: SpaceMember[], currentUserId: string) {
  const name = normalizeMemberDisplayName(member.profiles?.display_name);
  if (name) return name;
  if (member.user_id === currentUserId) return '我';
  return members.length === 2 ? '对方' : '成员';
}

export function taskAssignmentOptions(members: SpaceMember[], currentUserId: string) {
  return [
    { value: '', label: '共同' },
    ...members.map((member) => ({
      value: member.user_id,
      label: taskMemberLabel(member, members, currentUserId),
    })),
  ];
}

export function taskAssignmentLabel(assignedToUserId: string | null, members: SpaceMember[], currentUserId: string) {
  if (assignedToUserId === null) return '共同';
  const member = members.find((item) => item.user_id === assignedToUserId);
  return member ? taskMemberLabel(member, members, currentUserId) : '成员';
}

export function taskAssignmentFromValue(value: string, members: SpaceMember[]) {
  if (value === '') return null;
  if (!members.some((member) => member.user_id === value)) throw new Error('请选择当前空间成员。');
  return value;
}

export function canChangeTaskStatus(task: Task, currentUserId: string) {
  return task.assigned_to_user_id === null || task.assigned_to_user_id === currentUserId;
}

export type TaskEditableValues = Pick<Task, 'title' | 'assigned_to_user_id' | 'due_on'>;

export function taskEditableChanges(task: Task, values: TaskEditableValues): Partial<TaskEditableValues> {
  const changes: Partial<TaskEditableValues> = {};
  if (values.title !== task.title) changes.title = values.title;
  if (values.assigned_to_user_id !== task.assigned_to_user_id) changes.assigned_to_user_id = values.assigned_to_user_id;
  if (values.due_on !== task.due_on) changes.due_on = values.due_on;
  return changes;
}

export function taskRealtimeConfig(spaceId: string) {
  return {
    event: '*',
    schema: 'public',
    table: 'tasks',
    filter: `space_id=eq.${spaceId}`,
  } as const;
}
