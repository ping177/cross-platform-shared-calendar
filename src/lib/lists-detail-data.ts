import type { SupabaseClient } from '@supabase/supabase-js';
import { completeRows } from './aggregate-calendar';
import { loadListsEligibility } from './lists-data';
import { deriveListDetail, normalizeDetailText } from './lists-detail';
import { supabase } from './supabase';
import type { CurrentSpace, List, ListItem, ListSection } from '../types';

export type ListDetailTarget = { spaceId: string; listId: string };
export type ListDetailRead =
  // The optional order exists only in local detail state until the next canonical reread.
  | { status: 'ready'; space: CurrentSpace; list: List; sections: ListSection[]; items: ListItem[]; projectedUngroupedOrder?: string[] }
  | { status: 'ineligible' | 'deleted'; eligibleSpaces: CurrentSpace[] };

type EligibilityReader = () => Promise<{ eligibleSpaces: CurrentSpace[] }>;

export async function loadListDetail(
  userId: string,
  target: ListDetailTarget,
  client: SupabaseClient = supabase,
  readEligibility: EligibilityReader = () => loadListsEligibility(userId, client),
): Promise<ListDetailRead> {
  const first = await readEligibility();
  const space = first.eligibleSpaces.find((candidate) => candidate.id === target.spaceId);
  if (!space) return { status: 'ineligible', eligibleSpaces: first.eligibleSpaces };
  const listResult = await client.from('lists').select('id,space_id,name,created_by,created_at,updated_at')
    .eq('id', target.listId).eq('space_id', target.spaceId).maybeSingle();
  if (listResult.error) throw listResult.error;
  if (!listResult.data) {
    const second = await readEligibility();
    return { status: second.eligibleSpaces.some((candidate) => candidate.id === target.spaceId) ? 'deleted' : 'ineligible', eligibleSpaces: second.eligibleSpaces };
  }
  const list = listResult.data as List;
  if (list.id !== target.listId || list.space_id !== target.spaceId || typeof list.name !== 'string') throw new Error('清单身份校验失败，请重试。');
  const sectionsRead = completeRows(async (start, end) => {
    const page = await client.from('list_sections').select('id,list_id,name,sort_order', { count: 'exact' })
      .eq('list_id', target.listId).order('id').range(start, end);
    if (!page.error && page.data === null) throw new Error('清单分组读取不完整，请重试。');
    return { data: page.data as ListSection[] | null, count: page.count, error: page.error };
  }, (row) => row.id, (row) => row.list_id === target.listId, '清单分组');
  const itemsRead = completeRows(async (start, end) => {
    const page = await client.from('list_items').select('id,list_id,space_id,section_id,content,completed,sort_order', { count: 'exact' })
      .eq('list_id', target.listId).order('id').range(start, end);
    if (!page.error && page.data === null) throw new Error('清单项目读取不完整，请重试。');
    return { data: page.data as ListItem[] | null, count: page.count, error: page.error };
  }, (row) => row.id, (row) => row.list_id === target.listId && row.space_id === target.spaceId, '清单项目');
  const [sections, items] = await Promise.all([sectionsRead, itemsRead]);
  deriveListDetail(target.listId, target.spaceId, sections, items);
  const final = await readEligibility();
  const finalSpace = final.eligibleSpaces.find((candidate) => candidate.id === target.spaceId);
  if (!finalSpace) return { status: 'ineligible', eligibleSpaces: final.eligibleSpaces };
  return { status: 'ready', space: finalSpace, list, sections, items };
}

function assertSection(row: unknown, listId: string, name: string, id?: string): ListSection {
  const section = row as ListSection | null;
  if (!section || typeof section.id !== 'string' || section.list_id !== listId || section.name !== name || (id && section.id !== id)
    || !Number.isSafeInteger(section.sort_order) || section.sort_order < 1) {
    throw new Error('无法确认分组的服务端记录，请刷新后重试。');
  }
  return section;
}

function assertItem(row: unknown, target: ListDetailTarget, sectionId?: string | null, content?: string, id?: string): ListItem {
  const item = row as ListItem | null;
  if (!item || typeof item.id !== 'string' || item.list_id !== target.listId || item.space_id !== target.spaceId
    || (sectionId !== undefined && item.section_id !== sectionId)
    || (content !== undefined && item.content !== content) || (id && item.id !== id)
    || typeof item.completed !== 'boolean' || !Number.isSafeInteger(item.sort_order) || item.sort_order < 1) {
    throw new Error('无法确认项目的服务端记录，请刷新后重试。');
  }
  return item;
}

export async function createListSection(client: SupabaseClient, listId: string, value: string): Promise<ListSection> {
  const name = normalizeDetailText(value, '分组名称');
  const { data, error } = await client.rpc('create_list_section', { p_list_id: listId, p_name: name });
  if (error) throw error;
  return assertSection(data, listId, name);
}

export async function renameListSection(client: SupabaseClient, section: ListSection, value: string): Promise<ListSection | null> {
  const name = normalizeDetailText(value, '分组名称');
  const { data, error } = await client.from('list_sections').update({ name }).eq('id', section.id).eq('list_id', section.list_id)
    .select('id,list_id,name,sort_order').maybeSingle();
  if (error) throw error;
  return data ? assertSection(data, section.list_id, name, section.id) : null;
}

export async function createListItem(client: SupabaseClient, target: ListDetailTarget, sectionId: string | null, value: string): Promise<ListItem> {
  const content = normalizeDetailText(value, '项目内容');
  const { data, error } = await client.rpc('create_list_item', { p_list_id: target.listId, p_section_id: sectionId, p_content: content });
  if (error) throw error;
  const item = assertItem(data, target, sectionId, content);
  if (item.completed) throw new Error('无法确认新项目的服务端记录，请刷新后重试。');
  return item;
}

export async function editListItem(client: SupabaseClient, target: ListDetailTarget, item: ListItem, value: string): Promise<ListItem | null> {
  const content = normalizeDetailText(value, '项目内容');
  const { data, error } = await client.from('list_items').update({ content }).eq('id', item.id).eq('list_id', target.listId)
    .select('id,list_id,space_id,section_id,content,completed,sort_order').maybeSingle();
  if (error) throw error;
  return data ? assertItem(data, target, undefined, content, item.id) : null;
}

export async function setListItemCompleted(client: SupabaseClient, target: ListDetailTarget, item: ListItem, completed: boolean): Promise<ListItem> {
  const { data, error } = await client.rpc('set_list_item_completed', { p_item_id: item.id, p_completed: completed });
  if (error) throw error;
  const returned = data as ListItem | null;
  if (!returned || returned.completed !== completed) {
    throw new Error('无法确认项目的完成状态，请刷新后重试。');
  }
  return assertItem(returned, target, undefined, undefined, item.id);
}

export async function deleteListItem(client: SupabaseClient, listId: string, itemId: string): Promise<void> {
  const { error } = await client.rpc('delete_list_item', { p_list_id: listId, p_item_id: itemId });
  if (error) throw error;
}

export async function deleteListSection(client: SupabaseClient, listId: string, sectionId: string, preserveItems: boolean): Promise<void> {
  const { error } = await client.rpc('delete_list_section', { p_list_id: listId, p_section_id: sectionId, p_preserve_items: preserveItems });
  if (error) throw error;
}
