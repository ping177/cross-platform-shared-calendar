import { homeCreateTarget } from './global-create';
import { completeRows, type Page } from './aggregate-calendar';
import type { CurrentSpace, List, ListItemOverview } from '../types';

export type ListFilter = 'all' | { spaceId: string };
export type ListModuleRow = { space_id: string; enabled: boolean };
export type ListOverviewRow = { list: List; completedCount: number; totalItems: number };

export function eligibleListSpaces(spaces: CurrentSpace[], modules: ListModuleRow[]): CurrentSpace[] {
  const enabled = new Set(modules.filter((row) => row.enabled === true).map((row) => row.space_id));
  return spaces.filter((space) => (space.membershipRole === 'owner' || space.membershipRole === 'member') && enabled.has(space.id));
}

export function normalizeListFilter(filter: ListFilter, eligible: CurrentSpace[]): ListFilter {
  return filter === 'all' || eligible.some((space) => space.id === filter.spaceId) ? filter : 'all';
}

export function defaultListCreateTarget(memberSpaces: CurrentSpace[], userId: string): string | null {
  return homeCreateTarget(memberSpaces, userId);
}

export function canSaveListInSpace(spaceId: string | null, eligible: CurrentSpace[]): boolean {
  return Boolean(spaceId && eligible.some((space) => space.id === spaceId));
}

export function normalizeListName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error('请输入清单名称。');
  if (Array.from(name).length > 200) throw new Error('清单名称不能超过 200 个字符。');
  if (/[\p{Cc}\u2028\u2029]/u.test(name)) throw new Error('清单名称只能填写单行文字。');
  return name;
}

export function groupOverviewLists(lists: List[], items: ListItemOverview[]) {
  const byId = new Map<string, ListOverviewRow>();
  for (const list of lists) {
    if (byId.has(list.id) || !Number.isFinite(Date.parse(list.created_at))) throw new Error('清单数据身份校验失败，请重试。');
    byId.set(list.id, { list, completedCount: 0, totalItems: 0 });
  }
  const itemIds = new Set<string>();
  for (const item of items) {
    const row = byId.get(item.list_id);
    if (!row || itemIds.has(item.id) || row.list.space_id !== item.space_id || typeof item.completed !== 'boolean') {
      throw new Error('清单项目数据读取不一致，请重试。');
    }
    itemIds.add(item.id);
    row.totalItems += 1;
    if (item.completed) row.completedCount += 1;
  }
  const sorted = [...byId.values()].sort((a, b) => Date.parse(b.list.created_at) - Date.parse(a.list.created_at)
    || (a.list.id < b.list.id ? 1 : a.list.id > b.list.id ? -1 : 0));
  return {
    active: sorted.filter((row) => row.totalItems === 0 || row.completedCount !== row.totalItems),
    completed: sorted.filter((row) => row.totalItems > 0 && row.completedCount === row.totalItems),
  };
}

export async function readListEligibility(spaces: CurrentSpace[], modulePage: (start: number, end: number) => Promise<Page<ListModuleRow>>) {
  if (!spaces.length) return [];
  const memberIds = new Set(spaces.map((space) => space.id));
  const modules = await completeRows(async (start, end) => {
    const page = await modulePage(start, end);
    if (!page.error && page.data === null) throw new Error('清单模块数据读取不完整，请重试。');
    return page;
  }, (row) => row.space_id, (row) => memberIds.has(row.space_id) && typeof row.enabled === 'boolean', '清单模块');
  return eligibleListSpaces(spaces, modules);
}

export async function readListOverview(eligible: CurrentSpace[], operations: {
  listPage: (spaceId: string, start: number, end: number) => Promise<Page<List>>;
  itemPage: (spaceId: string, start: number, end: number) => Promise<Page<ListItemOverview>>;
}) {
  const lists: List[] = [];
  const items: ListItemOverview[] = [];
  for (const space of eligible) {
    lists.push(...await completeRows(async (start, end) => {
      const page = await operations.listPage(space.id, start, end);
      if (!page.error && page.data === null) throw new Error('清单数据读取不完整，请重试。');
      return page;
    },
      (row) => row.id, (row) => row.space_id === space.id, '清单'));
    items.push(...await completeRows(async (start, end) => {
      const page = await operations.itemPage(space.id, start, end);
      if (!page.error && page.data === null) throw new Error('清单项目数据读取不完整，请重试。');
      return page;
    },
      (row) => row.id, (row) => row.space_id === space.id, '清单项目'));
  }
  return groupOverviewLists(lists, items);
}

export function createListsRefreshSignal(refresh: () => void, delayMs = 150) {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    signal() {
      if (!active) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; if (active) refresh(); }, delayMs);
    },
    stop() {
      active = false;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

export function subscribeListsRealtimeScope<Channel>(spaceIds: string[], subscribe: (spaceId: string) => Channel, unsubscribe: (channel: Channel) => void) {
  const channels: Channel[] = [];
  try {
    for (const spaceId of spaceIds) channels.push(subscribe(spaceId));
  } catch (error) {
    for (const channel of channels) unsubscribe(channel);
    throw error;
  }
  return () => { for (const channel of channels) unsubscribe(channel); };
}
