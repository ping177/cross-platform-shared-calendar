import type { CalendarEvent, EventAudience, Space, SpaceMember } from '../types.ts';

export function newEventIdentity(kind: Space['kind'], audience: EventAudience, userId: string, partnerId: string | null) {
  if (kind === 'personal') return { scope: 'personal' as const, owner_user_id: userId };
  if (audience === 'shared') return { scope: 'shared' as const, owner_user_id: null };
  if (audience === 'partner' && !partnerId) throw new Error('另一位成员加入空间后，才能创建其个人日程。');
  return { scope: 'personal' as const, owner_user_id: audience === 'mine' ? userId : partnerId };
}

export function taskAssignmentForSpace(kind: Space['kind'], existingAssignment: string | null, chosenAssignment: string | null) {
  return kind === 'personal' ? existingAssignment : chosenAssignment;
}

export function canManageSpaceEvent(space: Pick<Space, 'id' | 'kind' | 'created_by'>, event: Pick<CalendarEvent, 'space_id' | 'scope' | 'owner_user_id'>, userId: string, members: SpaceMember[]) {
  if (event.space_id !== space.id || !members.some((member) => member.space_id === space.id && member.user_id === userId)) return false;
  return space.kind === 'shared'
    || (space.created_by === userId && event.scope === 'personal' && event.owner_user_id === userId);
}
