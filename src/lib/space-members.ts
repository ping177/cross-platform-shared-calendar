import { supabase } from './supabase.ts';
import type { SpaceMember } from '../types.ts';

export async function readSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
  const { data, error } = await supabase.from('space_members')
    .select('space_id,user_id,role,joined_at,profiles(display_name)')
    .eq('space_id', spaceId)
    .order('joined_at', { ascending: true })
    .order('user_id', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Omit<SpaceMember, 'profiles'> & { profiles?: { display_name: string | null }[] | { display_name: string | null } | null }>).map(
    (member) => ({ ...member, profiles: Array.isArray(member.profiles) ? member.profiles[0] ?? null : member.profiles ?? null }),
  );
}
