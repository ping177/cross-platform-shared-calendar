import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurrentSpace, Space } from '../types.ts';

export const spaceNameMaxLength = 80;

export function canRenameSpace(space: CurrentSpace, userId: string) {
  return Boolean(userId) && space.membershipRole === 'owner'
    && (space.kind === 'shared' || space.created_by === userId);
}

export function normalizeSpaceName(value: string) {
  const name = value.trim();
  if (!name || Array.from(name).length > spaceNameMaxLength) throw new Error('名称须为 1–80 个字符。');
  return name;
}

export async function renameSpace(client: SupabaseClient, space: CurrentSpace, userId: string, value: string): Promise<Space | null> {
  if (!canRenameSpace(space, userId)) throw new Error('只有当前空间所有者可以修改名称。');
  // Do not normalize untouched legacy names or send a meaningless UPDATE.
  if (value.trim() === space.name.trim()) return null;
  const name = normalizeSpaceName(value);
  const { data: identity, error: authError } = await client.auth.getUser();
  if (authError || identity.user?.id !== userId) throw new Error('登录状态已变化，请重新进入空间详情。');
  const { data, error } = await client.from('spaces').update({ name }).eq('id', space.id).eq('name', space.name)
    .select('id,name,kind,invite_code,created_by,created_at').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('空间名称或成员身份已变化，请重新进入空间详情。');
  if (data.id !== space.id || data.name !== name || data.kind !== space.kind || data.created_by !== space.created_by
    || typeof data.invite_code !== 'string' || typeof data.created_at !== 'string') {
    throw new Error('无法确认服务端空间记录，请刷新空间列表。');
  }
  return data as Space;
}

export function spaceRenameError(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (/Only the Space owner|42501/.test(message)) return '只有当前空间所有者可以修改名称，请刷新后重试。';
  if (/Space name must contain/.test(message)) return '名称须为 1–80 个字符。';
  return `保存失败：${message || '请稍后重试。'}`;
}
