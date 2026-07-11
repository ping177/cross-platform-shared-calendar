import type { SpaceMember } from '../types';

export const memberDisplayNameFallback = '成员';
export const memberDisplayNameMaxLength = 20;

export function normalizeMemberDisplayName(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';

  return normalized.length > 0 && normalized.length <= memberDisplayNameMaxLength ? normalized : null;
}

export function memberDisplayName(member: SpaceMember | null | undefined) {
  return normalizeMemberDisplayName(member?.profiles?.display_name) ?? memberDisplayNameFallback;
}

export function memberDisplayNameForUser(members: SpaceMember[], userId: string | null | undefined) {
  return memberDisplayName(members.find((member) => member.user_id === userId));
}
