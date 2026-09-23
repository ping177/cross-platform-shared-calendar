import type { EventAudience, Space } from '../types.ts';

export function newEventIdentity(kind: Space['kind'], audience: EventAudience, userId: string, partnerId: string | null) {
  if (kind === 'personal') return { scope: 'personal' as const, owner_user_id: userId };
  if (audience === 'shared') return { scope: 'shared' as const, owner_user_id: null };
  if (audience === 'partner' && !partnerId) throw new Error('另一位成员加入空间后，才能创建其个人日程。');
  return { scope: 'personal' as const, owner_user_id: audience === 'mine' ? userId : partnerId };
}

export function taskAssignmentForSpace(kind: Space['kind'], existingAssignment: string | null, chosenAssignment: string | null) {
  return kind === 'personal' ? existingAssignment : chosenAssignment;
}
