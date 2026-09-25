import { completeRows, type Page } from './aggregate-calendar.ts';
import { homeCreateTarget } from './global-create.ts';
import { createRequestGuard } from './request-guard.ts';
import { groupTasks } from './task.ts';
import type { CurrentSpace, Space, Task } from '../types.ts';

export type TaskFilter = 'all' | { spaceId: string };
export type TaskModuleRow = { space_id: string; enabled: boolean };
type SourceSpace = Pick<Space, 'id' | 'name' | 'kind'>;

export function eligibleTaskSpaces(spaces: CurrentSpace[], moduleRows: TaskModuleRow[]): CurrentSpace[] {
  const enabled = new Set(moduleRows.filter((row) => row.enabled === true).map((row) => row.space_id));
  return spaces.filter((space) => (space.membershipRole === 'owner' || space.membershipRole === 'member') && enabled.has(space.id));
}

export function normalizeTaskFilter(filter: TaskFilter, spaces: CurrentSpace[]): TaskFilter {
  return filter === 'all' || spaces.some((space) => space.id === filter.spaceId) ? filter : 'all';
}

export function taskFilterSpaces(spaces: CurrentSpace[], filter: TaskFilter): CurrentSpace[] {
  const normalized = normalizeTaskFilter(filter, spaces);
  return normalized === 'all' ? spaces : spaces.filter((space) => space.id === normalized.spaceId);
}

export function defaultTaskCreateTarget(filter: TaskFilter, memberSpaces: CurrentSpace[], eligibleSpaces: CurrentSpace[], userId: string) {
  if (filter !== 'all' && eligibleSpaces.some((space) => space.id === filter.spaceId)) return filter.spaceId;
  return homeCreateTarget(memberSpaces, userId);
}

export function taskRealtimeSpaceIds(spaces: CurrentSpace[], filter: TaskFilter) {
  return taskFilterSpaces(spaces, filter).map((space) => space.id);
}

export function subscribeTaskRealtimeScope<Channel>(spaceIds: string[], subscribe: (spaceId: string, onChange: () => void) => Channel, unsubscribe: (channel: Channel) => void, onChange: () => void) {
  const channels: Channel[] = [];
  try {
    for (const spaceId of spaceIds) channels.push(subscribe(spaceId, onChange));
  } catch (error) {
    for (const channel of channels) unsubscribe(channel);
    throw error;
  }
  return () => { for (const channel of channels) unsubscribe(channel); };
}

export async function readTaskEligibility(spaces: CurrentSpace[], modulePage: (start: number, end: number) => Promise<Page<TaskModuleRow>>) {
  const spaceIds = new Set(spaces.map((space) => space.id));
  const moduleRows = spaces.length ? await completeRows(
    async (start, end) => {
      const page = await modulePage(start, end);
      if (!page.error && page.data == null) throw new Error('任务模块数据读取不完整，请重试。');
      return page;
    },
    (row) => row.space_id,
    (row) => spaceIds.has(row.space_id) && typeof row.enabled === 'boolean',
    '任务模块',
  ) : [];
  return eligibleTaskSpaces(spaces, moduleRows);
}

export async function readAggregateTasks(spaces: CurrentSpace[], filter: TaskFilter, operations: {
  modulePage: (start: number, end: number) => Promise<Page<TaskModuleRow>>;
  taskPage: (spaceId: string, start: number, end: number) => Promise<Page<Task>>;
}) {
  const eligibleSpaces = await readTaskEligibility(spaces, operations.modulePage);
  const validFilter = normalizeTaskFilter(filter, eligibleSpaces);
  const tasks: Task[] = [];
  const sourceSpacesById: Record<string, SourceSpace> = {};
  for (const space of taskFilterSpaces(eligibleSpaces, validFilter)) {
    sourceSpacesById[space.id] = { id: space.id, name: space.name, kind: space.kind };
    tasks.push(...await completeRows(
      (start, end) => operations.taskPage(space.id, start, end),
      (task) => task.id,
      (task) => task.space_id === space.id,
      '任务',
    ));
  }
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length) throw new Error('任务来源身份重复，请重试。');
  return { filter: validFilter, eligibleSpaces, grouped: groupTasks(tasks), sourceSpacesById };
}

export function createAggregateTaskLoader<T>(read: (userId: string, filter: TaskFilter) => Promise<T>) {
  const guard = createRequestGuard();
  return {
    async load(userId: string, filter: TaskFilter, publish: (result: { status: 'ready'; data: T } | { status: 'error'; error: unknown }) => void) {
      const request = guard.begin();
      let data: T;
      try {
        data = await read(userId, filter);
      } catch (error) {
        if (guard.isCurrent(request)) publish({ status: 'error', error });
        return;
      }
      if (guard.isCurrent(request)) publish({ status: 'ready', data });
    },
    invalidate: guard.invalidate,
  };
}
