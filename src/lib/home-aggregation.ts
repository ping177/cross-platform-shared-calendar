import { completeRows, type Page } from './aggregate-calendar.ts';
import { addDays, endOfDay, startOfDay } from './date.ts';
import { expandRecurringEvents } from './recurrence.ts';
import type { CalendarEvent, CalendarOccurrence, CalendarOccurrenceRange, CurrentSpace, EventOccurrenceException, SpaceMember, Task } from '../types.ts';

export type HomeEventQuery = 'starting' | 'overlap' | 'recurring';
export type HomeModuleRow = { space_id: string; enabled: boolean };

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function homeEventRange(today: Date): CalendarOccurrenceRange {
  return { start: startOfDay(today), end: endOfDay(addDays(today, 2)) };
}

export function visibleHomeEvents(events: CalendarEvent[], exceptions: EventOccurrenceException[], range: CalendarOccurrenceRange): CalendarOccurrence[] {
  const expansion = expandRecurringEvents(events, range, exceptions);
  if (expansion.errors.length) throw new Error('重复日程无法完整显示，请重试。');
  return expansion.occurrences.sort((left, right) => {
    const leftDay = localDate(new Date(left.occurrence_starts_at));
    const rightDay = localDate(new Date(right.occurrence_starts_at));
    return leftDay.localeCompare(rightDay)
      || Number(right.all_day) - Number(left.all_day)
      || left.occurrence_starts_at.localeCompare(right.occurrence_starts_at)
      || left.source_event.space_id.localeCompare(right.source_event.space_id)
      || left.occurrence_id.localeCompare(right.occurrence_id);
  });
}

export async function readHomeEvents(spaces: CurrentSpace[], range: CalendarOccurrenceRange, operations: {
  eventPage: (spaceId: string, kind: HomeEventQuery, start: number, end: number, range: CalendarOccurrenceRange) => Promise<Page<CalendarEvent>>;
  exceptionPage: (eventIds: string[], start: number, end: number) => Promise<Page<EventOccurrenceException>>;
  members: (spaceId: string) => Promise<SpaceMember[]>;
}) {
  const events: CalendarEvent[] = [];
  const membersBySpaceId: Record<string, SpaceMember[]> = {};
  for (const space of spaces) {
    const members = await operations.members(space.id);
    if (!members.some((member) => member.user_id) || members.some((member) => member.space_id !== space.id)) {
      throw new Error('空间成员资料不完整，请重试。');
    }
    membersBySpaceId[space.id] = members;
    for (const kind of ['starting', 'overlap', 'recurring'] as const) {
      events.push(...await completeRows(
        (start, end) => operations.eventPage(space.id, kind, start, end, range),
        (event) => event.id,
        (event) => event.space_id === space.id && (kind === 'recurring' ? event.recurrence_rule !== null : event.recurrence_rule === null),
      ));
    }
    if (events.some((event) => event.space_id === space.id && event.scope === 'personal' && !members.some((member) => member.user_id === event.owner_user_id))) {
      throw new Error('日程所属成员资料不完整，请重试。');
    }
  }
  if (new Set(events.map((event) => event.id)).size !== events.length) throw new Error('日程来源身份重复，请重试。');
  const exceptions: EventOccurrenceException[] = [];
  const recurringIds = events.filter((event) => event.recurrence_rule !== null).map((event) => event.id);
  for (let index = 0; index < recurringIds.length; index += 100) {
    const ids = recurringIds.slice(index, index + 100);
    const allowed = new Set(ids);
    exceptions.push(...await completeRows(
      (start, end) => operations.exceptionPage(ids, start, end),
      (exception) => `${exception.event_id}:${exception.occurrence_date}`,
      (exception) => allowed.has(exception.event_id),
    ));
  }
  return { occurrences: visibleHomeEvents(events, exceptions, range), membersBySpaceId };
}

export function visibleHomeTasks(tasks: Task[], userId: string, today: Date): Task[] {
  const lastDue = localDate(addDays(today, 7));
  return tasks.filter((task) => task.status === 'open'
    && (task.assigned_to_user_id === null || task.assigned_to_user_id === userId)
    && (task.due_on === null || task.due_on <= lastDue))
    .sort((left, right) => {
      if (left.due_on === null || right.due_on === null) {
        if (left.due_on !== right.due_on) return left.due_on === null ? 1 : -1;
      } else {
        const dueOrder = left.due_on.localeCompare(right.due_on);
        if (dueOrder) return dueOrder;
      }
      return left.created_at.localeCompare(right.created_at)
        || left.space_id.localeCompare(right.space_id)
        || left.id.localeCompare(right.id);
    });
}

export async function readHomeModules(spaces: CurrentSpace[], page: (start: number, end: number) => Promise<Page<HomeModuleRow>>) {
  if (!spaces.length) return [];
  const ids = new Set(spaces.map((space) => space.id));
  const rows = await completeRows(page, (row) => row.space_id, (row) => ids.has(row.space_id) && typeof row.enabled === 'boolean');
  return spaces.filter((space) => rows.some((row) => row.space_id === space.id && row.enabled));
}

export async function readHomeTasks(spaces: CurrentSpace[], userId: string, today: Date, operations: {
  modulePage: (start: number, end: number) => Promise<Page<HomeModuleRow>>;
  taskPage: (spaceId: string, start: number, end: number) => Promise<Page<Task>>;
  members: (spaceId: string) => Promise<SpaceMember[]>;
}) {
  const enabled = await readHomeModules(spaces, operations.modulePage);
  const all: Task[] = [];
  const membersBySpaceId: Record<string, SpaceMember[]> = {};
  for (const space of enabled) {
    const members = await operations.members(space.id);
    if (!members.some((member) => member.user_id === userId) || members.some((member) => member.space_id !== space.id)) {
      throw new Error('任务空间成员资料不完整，请重试。');
    }
    membersBySpaceId[space.id] = members;
    all.push(...await completeRows(
      (start, end) => operations.taskPage(space.id, start, end),
      (task) => task.id,
      (task) => task.space_id === space.id && task.status === 'open',
    ));
  }
  if (new Set(all.map((task) => task.id)).size !== all.length) throw new Error('任务来源身份重复，请重试。');
  return { tasks: visibleHomeTasks(all, userId, today), enabledSpaceIds: enabled.map((space) => space.id), membersBySpaceId };
}
