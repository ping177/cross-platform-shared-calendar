import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeMemberDisplayName, memberDisplayNameMaxLength } from './member.ts';

export type Profile = { display_name: string | null; avatar_preset: string | null; avatar_path: string | null };
export const profileColumns = 'display_name,avatar_preset,avatar_path';

export async function requireProfileOwner(client: SupabaseClient, userId: string) {
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== userId) throw new Error('登录状态已变化，请重新登录后再试。');
}

export async function readProfile(client: SupabaseClient, userId: string): Promise<Profile> {
  const { data, error } = await client.from('profiles').select(profileColumns).eq('id', userId).maybeSingle();
  if (error || !data) throw new Error('未能读取资料，请稍后重试。');
  return data as Profile;
}

export async function saveProfileName(client: SupabaseClient, userId: string, draft: string, savedName: string) {
  const name = normalizeMemberDisplayName(draft);
  if (!name) throw new Error(`名称须为 1–${memberDisplayNameMaxLength} 个字符。`);
  if (name === savedName) return null;
  await requireProfileOwner(client, userId);
  const { data, error } = await client.from('profiles').update({ display_name: name }).eq('id', userId).select('display_name').maybeSingle();
  if (error || !data) throw new Error('未能更新名称，请稍后重试。');
  return data.display_name as string;
}
