import type { CurrentSpace, SpaceMember } from '../types.ts';

export function homeCreateTarget(spaces: CurrentSpace[], userId: string): string | null {
  return spaces.find((space) => space.kind === 'personal' && space.created_by === userId)?.id ?? null;
}

export function availableTaskTargets(spaces: CurrentSpace[], enabledIds: readonly string[]) {
  const enabled = new Set(enabledIds);
  return spaces.filter((space) => enabled.has(space.id));
}

export function homeCreateEntry(kind: 'event' | 'task', spaces: CurrentSpace[], userId: string, enabledIds: readonly string[]) {
  const eligible = kind === 'task' ? availableTaskTargets(spaces, enabledIds) : spaces;
  if (eligible.length === 0) return { state: 'blocked' as const };
  const personalId = homeCreateTarget(spaces, userId);
  return personalId ? { state: 'open' as const, targetId: personalId } : { state: 'choose' as const };
}

export function targetMembersValid(members: SpaceMember[], spaceId: string, userId: string, assignedId?: string | null) {
  return members.length > 0
    && members.every((member) => member.space_id === spaceId)
    && members.some((member) => member.user_id === userId)
    && (!assignedId || members.some((member) => member.user_id === assignedId));
}

export function canUseCreateTarget(state: string, selectedId: string, spaceId: string, members: SpaceMember[], userId: string) {
  return state === 'ready' && selectedId === spaceId && targetMembersValid(members, spaceId, userId);
}

export function resetEventAudienceForTarget<T extends { audience: string }>(draft: T): Omit<T, 'audience'> & { audience: 'mine' } {
  return { ...draft, audience: 'mine' };
}

export function resetTaskAssignmentForTarget(_previous: string) { return ''; }

export function canConfirmCreate(confirmedTargetId: string | null, selectedId: string, spaceId: string) {
  return Boolean(confirmedTargetId) && confirmedTargetId === selectedId && selectedId === spaceId;
}

export function createSubmitLock() {
  let locked = false;
  return {
    acquire() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() { locked = false; },
  };
}
