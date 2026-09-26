import type { SupabaseClient } from '@supabase/supabase-js';
import { listCurrentSpaces } from './current-spaces';
import { readListEligibility, readListOverview, normalizeListName, type ListModuleRow } from './lists';
import { supabase } from './supabase';
import type { List, ListItemOverview } from '../types';

async function assertCurrentUser(client: SupabaseClient, userId: string) {
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== userId) throw new Error('登录状态已变化，请重试。');
}

export async function loadListsEligibility(userId: string, client: SupabaseClient = supabase, readSpaces = listCurrentSpaces) {
  await assertCurrentUser(client, userId);
  const memberSpaces = await readSpaces(userId);
  const eligibleSpaces = await readListEligibility(memberSpaces, async (start, end) => {
    const page = await client.from('space_modules').select('space_id,enabled', { count: 'exact' })
      .eq('module_key', 'lists').order('space_id').range(start, end);
    return { data: page.data as ListModuleRow[] | null, count: page.count, error: page.error };
  });
  await assertCurrentUser(client, userId);
  return { memberSpaces, eligibleSpaces };
}

export async function loadListsOverview(userId: string, client: SupabaseClient = supabase, readSpaces = listCurrentSpaces) {
  const eligibility = await loadListsEligibility(userId, client, readSpaces);
  const grouped = await readListOverview(eligibility.eligibleSpaces, {
    listPage: async (spaceId, start, end) => {
      const page = await client.from('lists').select('id,space_id,name,created_by,created_at,updated_at', { count: 'exact' })
        .eq('space_id', spaceId).order('id').range(start, end);
      return { data: page.data as List[] | null, count: page.count, error: page.error };
    },
    itemPage: async (spaceId, start, end) => {
      const page = await client.from('list_items').select('id,list_id,space_id,completed', { count: 'exact' })
        .eq('space_id', spaceId).order('id').range(start, end);
      return { data: page.data as ListItemOverview[] | null, count: page.count, error: page.error };
    },
  });
  await assertCurrentUser(client, userId);
  return { ...eligibility, grouped };
}

function assertCanonicalList(row: unknown, spaceId: string, name: string, id?: string): List {
  const list = row as List | null;
  if (!list || typeof list.id !== 'string' || list.space_id !== spaceId || list.name !== name || (id && list.id !== id)) {
    throw new Error('无法确认清单的服务端记录，请刷新后重试。');
  }
  return list;
}

export async function createList(client: SupabaseClient, spaceId: string, value: string): Promise<List> {
  const name = normalizeListName(value);
  const { data, error } = await client.from('lists').insert({ space_id: spaceId, name })
    .select('id,space_id,name,created_by,created_at,updated_at').single();
  if (error) throw error;
  return assertCanonicalList(data, spaceId, name);
}

export async function renameList(client: SupabaseClient, list: List, value: string): Promise<List | null> {
  const name = normalizeListName(value);
  const { data, error } = await client.from('lists').update({ name }).eq('id', list.id).eq('space_id', list.space_id)
    .select('id,space_id,name,created_by,created_at,updated_at').maybeSingle();
  if (error) throw error;
  return data ? assertCanonicalList(data, list.space_id, name, list.id) : null;
}

export async function deleteList(client: SupabaseClient, listId: string): Promise<void> {
  const { error } = await client.rpc('delete_list', { p_list_id: listId });
  if (error) throw error;
}
