import { supabase } from './supabase.ts';
import type { SpaceMember } from '../types.ts';

export async function readSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
  const { data, error } = await supabase.from('space_members')
    .select('space_id,user_id,role,joined_at,profiles(display_name,avatar_preset,avatar_path)')
    .eq('space_id', spaceId)
    .order('joined_at', { ascending: true })
    .order('user_id', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Omit<SpaceMember, 'profiles'> & { profiles?: NonNullable<SpaceMember['profiles']>[] | SpaceMember['profiles'] }>).map(
    (member) => ({ ...member, profiles: Array.isArray(member.profiles) ? member.profiles[0] ?? null : member.profiles ?? null }),
  );
}
