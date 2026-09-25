import { supabase } from './supabase.ts';
import type { CurrentSpace, Space, SpaceMember } from '../types.ts';

const spaceBatchSize = 500;

export async function listCurrentSpaces(userId: string): Promise<CurrentSpace[]> {
  const memberships: Array<Pick<SpaceMember, 'space_id' | 'role'>> = [];
  for (let start = 0; ;) {
    const { data, count, error } = await supabase.from('space_members')
      .select('space_id,role', { count: 'exact' })
      .eq('user_id', userId)
      .order('space_id')
      .range(start, start + spaceBatchSize - 1);
    if (error) throw error;
    if (count === null) throw new Error('无法确认空间成员列表是否完整。');
    const batch = (data ?? []) as Array<Pick<SpaceMember, 'space_id' | 'role'>>;
    memberships.push(...batch);
    if (memberships.length >= count) break;
    if (batch.length === 0) throw new Error('空间成员列表读取不完整，请重试。');
    start += batch.length;
  }

  const roles = new Map(memberships.map((member) => [member.space_id, member.role]));
  const spaces: CurrentSpace[] = [];
  for (let start = 0; ;) {
    const { data, count, error } = await supabase.from('spaces')
      .select('*', { count: 'exact' })
      .order('created_at')
      .order('id')
      .range(start, start + spaceBatchSize - 1);
    if (error) throw error;
    if (count === null) throw new Error('无法确认空间列表是否完整。');
    const batch = (data ?? []) as Space[];
    for (const space of batch) {
      const membershipRole = roles.get(space.id);
      if (membershipRole) spaces.push({ ...space, membershipRole });
    }
    if (start + batch.length >= count) break;
    if (batch.length === 0) throw new Error('空间列表读取不完整，请重试。');
    start += batch.length;
  }
  return spaces;
}
