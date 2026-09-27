import type { List, ListItem, ListSection } from '../types';

export const ungroupedKey = 'ungrouped';
export type DetailRegion = { active: ListItem[]; completed: ListItem[]; completedCount: number; total: number };
export type ListDetailUiState = {
  quickDrafts: Record<string, string>;
  foldOpen: Record<string, boolean>;
  collapsed: Record<string, boolean>;
  sectionCreateDraft: string | null;
  editing: { kind: 'section' | 'item'; id: string; draft: string } | null;
  recovered: string[];
};

export function initialListDetailUiState(): ListDetailUiState {
  return { quickDrafts: {}, foldOpen: {}, collapsed: {}, sectionCreateDraft: null, editing: null, recovered: [] };
}

export function normalizeDetailText(value: string, label: string): string {
  const text = value.trim();
  if (!text) throw new Error(`请输入${label}。`);
  if (Array.from(text).length > 200) throw new Error(`${label}不能超过 200 个字符。`);
  if (/[\p{Cc}\u2028\u2029]/u.test(text)) throw new Error(`${label}只能填写单行文字。`);
  return text;
}

function canonicalOrder<T extends { id: string; sort_order: number }>(rows: T[]): T[] {
  for (const row of rows) {
    if (!Number.isSafeInteger(row.sort_order) || row.sort_order < 1) throw new Error('清单顺序数据无效，请重试。');
  }
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}

function region(items: ListItem[], displayOrder?: string[]): DetailRegion {
  const sorted = canonicalOrder(items);
  if (displayOrder) {
    const position = new Map(displayOrder.map((id, index) => [id, index]));
    sorted.sort((a, b) => (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  }
  const active = sorted.filter((item) => !item.completed);
  const completed = sorted.filter((item) => item.completed);
  return { active, completed, completedCount: completed.length, total: sorted.length };
}

export function deriveListDetail(listId: string, spaceId: string, sections: ListSection[], items: ListItem[], projectedUngroupedOrder?: string[]) {
  const sectionIds = new Set<string>();
  for (const section of sections) {
    if (section.list_id !== listId || sectionIds.has(section.id) || typeof section.name !== 'string') throw new Error('清单分组数据不一致，请重试。');
    sectionIds.add(section.id);
  }
  const itemIds = new Set<string>();
  for (const item of items) {
    if (item.list_id !== listId || item.space_id !== spaceId || itemIds.has(item.id)
      || (item.section_id !== null && !sectionIds.has(item.section_id))
      || typeof item.content !== 'string' || typeof item.completed !== 'boolean') {
      throw new Error('清单项目数据不一致，请重试。');
    }
    itemIds.add(item.id);
  }
  return {
    ungrouped: region(items.filter((item) => item.section_id === null), projectedUngroupedOrder),
    sections: canonicalOrder(sections).map((section) => ({
      section,
      region: region(items.filter((item) => item.section_id === section.id)),
    })),
  };
}

export function reconcileListDetailUiState(state: ListDetailUiState, sections: ListSection[], items: ListItem[]): ListDetailUiState {
  const sectionIds = new Set(sections.map((section) => section.id));
  const itemIds = new Set(items.map((item) => item.id));
  const quickDrafts: Record<string, string> = {};
  const recovered = [...state.recovered];
  for (const [key, value] of Object.entries(state.quickDrafts)) {
    if (key === ungroupedKey || sectionIds.has(key)) quickDrafts[key] = value;
    else if (value.trim()) recovered.push(value);
  }
  return {
    ...state,
    quickDrafts,
    foldOpen: Object.fromEntries(Object.entries(state.foldOpen).filter(([key]) => key === ungroupedKey || sectionIds.has(key))),
    collapsed: Object.fromEntries(Object.entries(state.collapsed).filter(([key]) => sectionIds.has(key))),
    editing: state.editing && (state.editing.kind === 'section' ? sectionIds.has(state.editing.id) : itemIds.has(state.editing.id)) ? state.editing : null,
    recovered,
  };
}

export function settleQuickAddDraft(state: ListDetailUiState, key: string, submitted: string, succeeded: boolean): ListDetailUiState {
  if (!succeeded || state.quickDrafts[key] !== submitted) return state;
  return { ...state, quickDrafts: { ...state.quickDrafts, [key]: '' } };
}

type ConfirmedDetailChange =
  | { kind: 'list'; row: List }
  | { kind: 'section'; row: ListSection }
  | { kind: 'item'; row: ListItem }
  | { kind: 'item-delete'; id: string }
  | { kind: 'section-delete'; id: string; preserveItems: boolean };

export function applyConfirmedDetailChange<T extends { list: List; sections: ListSection[]; items: ListItem[]; projectedUngroupedOrder?: string[] }>(data: T, change: ConfirmedDetailChange): T {
  if (change.kind === 'list') return { ...data, list: change.row };
  if (change.kind === 'section') {
    return { ...data, sections: [...data.sections.filter((section) => section.id !== change.row.id), change.row] };
  }
  if (change.kind === 'section-delete') {
    const sections = data.sections.filter((section) => section.id !== change.id);
    if (!change.preserveItems) return { ...data, sections, items: data.items.filter((item) => item.section_id !== change.id) };
    const ungrouped = canonicalOrder(data.items.filter((item) => item.section_id === null));
    const moved = canonicalOrder(data.items.filter((item) => item.section_id === change.id));
    return { ...data, sections, items: data.items.map((item) => item.section_id === change.id ? { ...item, section_id: null } : item),
      projectedUngroupedOrder: [...ungrouped, ...moved].map((item) => item.id) };
  }
  if (change.kind === 'item-delete') return { ...data, items: data.items.filter((item) => item.id !== change.id) };
  if (change.row.section_id && !data.sections.some((section) => section.id === change.row.section_id)) return data;
  return { ...data, items: [...data.items.filter((item) => item.id !== change.row.id), change.row] };
}

export async function commitConfirmedDetailMutation<T>(action: () => Promise<T>, commit: (result: T) => void, reread: () => Promise<unknown>): Promise<void> {
  const result = await action();
  commit(result);
  void reread();
}
