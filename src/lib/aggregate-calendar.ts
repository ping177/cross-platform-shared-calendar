import type { CalendarEvent, CurrentSpace, EventOccurrenceException, Space, SpaceMember } from '../types.ts';

export type CalendarFilter = 'all' | { spaceId: string };
export type Page<T> = { data: T[] | null; count: number | null; error: Error | null };

const pageSize = 500;
const exceptionIdBatchSize = 100;

export function validCalendarFilter(filter: CalendarFilter, spaces: CurrentSpace[]): CalendarFilter {
  return filter === 'all' || spaces.some((space) => space.id === filter.spaceId) ? filter : 'all';
}

export function calendarSpaces(spaces: CurrentSpace[], filter: CalendarFilter): CurrentSpace[] {
  const valid = validCalendarFilter(filter, spaces);
  return valid === 'all' ? spaces : spaces.filter((space) => space.id === valid.spaceId);
}

export function spaceLabel(space: Pick<Space, 'kind' | 'name'>) {
  return space.kind === 'personal' ? '我的空间' : `共享空间 · ${space.name}`;
}

export async function completeRows<T>(
  page: (start: number, end: number) => Promise<Page<T>>,
  identity: (row: T) => string,
  belongs?: (row: T) => boolean,
): Promise<T[]> {
  const result: T[] = [];
  const seen = new Set<string>();
  let expected: number | null = null;
  for (let start = 0; ;) {
    const { data, count, error } = await page(start, start + pageSize - 1);
    if (error) throw error;
    if (count === null || !Number.isSafeInteger(count) || count < 0) throw new Error('无法确认日历数据是否完整。');
    if (expected === null) expected = count;
    if (count !== expected) throw new Error('日历数据在读取期间发生变化，请重试。');
    const batch = data ?? [];
    if (batch.length > pageSize) throw new Error('日历分页结果超出预期。');
    for (const row of batch) {
      const id = identity(row);
      if (!id || seen.has(id) || (belongs && !belongs(row))) throw new Error('日历数据身份校验失败，请重试。');
      seen.add(id);
      result.push(row);
    }
    if (result.length === expected) return result;
    if (batch.length === 0 || result.length > expected) throw new Error('日历数据读取不完整，请重试。');
    start += batch.length;
  }
}

export type AggregateCalendarData = {
  events: CalendarEvent[];
  exceptions: EventOccurrenceException[];
  membersBySpaceId: Record<string, SpaceMember[]>;
};

export async function readAggregateCalendar(spaces: CurrentSpace[], operations: {
  eventPage: (spaceId: string, start: number, end: number) => Promise<Page<CalendarEvent>>;
  exceptionPage: (eventIds: string[], start: number, end: number) => Promise<Page<EventOccurrenceException>>;
  members: (spaceId: string) => Promise<SpaceMember[]>;
}): Promise<AggregateCalendarData> {
  const events: CalendarEvent[] = [];
  const membersBySpaceId: Record<string, SpaceMember[]> = {};
  for (const space of spaces) {
    const members = await operations.members(space.id);
    if (!members.length || members.some((member) => member.space_id !== space.id)) throw new Error('空间成员资料不完整，请重试。');
    membersBySpaceId[space.id] = members;
    const sourceEvents = await completeRows(
      (start, end) => operations.eventPage(space.id, start, end),
      (event) => event.id,
      (event) => event.space_id === space.id,
    );
    if (sourceEvents.some((event) => event.scope === 'personal' && !members.some((member) => member.user_id === event.owner_user_id))) {
      throw new Error('日程所属成员资料不完整，请重试。');
    }
    events.push(...sourceEvents);
  }
  if (new Set(events.map((event) => event.id)).size !== events.length) {
    throw new Error('日历来源事件身份重复，请重试。');
  }

  const exceptions: EventOccurrenceException[] = [];
  const recurringIds = events.filter((event) => event.recurrence_rule !== null).map((event) => event.id);
  for (let index = 0; index < recurringIds.length; index += exceptionIdBatchSize) {
    const ids = recurringIds.slice(index, index + exceptionIdBatchSize);
    const idSet = new Set(ids);
    exceptions.push(...await completeRows(
      (start, end) => operations.exceptionPage(ids, start, end),
      (exception) => `${exception.event_id}:${exception.occurrence_date}`,
      (exception) => idSet.has(exception.event_id),
    ));
  }
  return { events, exceptions, membersBySpaceId };
}
