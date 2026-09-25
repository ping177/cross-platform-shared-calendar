import type { CurrentSpace, SpaceMember } from '../types';

export type SpaceLifecycleAction = 'leave' | 'remove' | 'transfer' | 'delete';

export class StaleSpaceLifecycleError extends Error {}

export function lifecycleTarget(action: SpaceLifecycleAction, space: CurrentSpace, members: SpaceMember[], actorId: string, targetId?: string) {
  if (space.kind !== 'shared') throw new StaleSpaceLifecycleError('此操作只适用于共享空间，请刷新后重试。');
  if (action === 'leave') {
    if (space.membershipRole !== 'member' || !members.some((member) => member.user_id === actorId && member.role === 'member')) {
      throw new StaleSpaceLifecycleError('你的成员身份已变化，请刷新后重试。');
    }
    return;
  }
  if (space.membershipRole !== 'owner' || !members.some((member) => member.user_id === actorId && member.role === 'owner')) {
    throw new StaleSpaceLifecycleError('你的所有者身份已变化，请刷新后重试。');
  }
  if (action === 'remove' || action === 'transfer') {
    if (!targetId || targetId === actorId || !members.some((member) => member.user_id === targetId && member.role === 'member')) {
      throw new StaleSpaceLifecycleError('目标成员已变化，请刷新后重试。');
    }
  }
}

export async function executeSpaceLifecycle(
  action: SpaceLifecycleAction,
  space: CurrentSpace,
  members: SpaceMember[],
  actorId: string,
  targetId: string | undefined,
  operations: {
    listSpaces: () => Promise<CurrentSpace[]>;
    readMembers: (spaceId: string) => Promise<SpaceMember[]>;
    rpc: (method: string, args: Record<string, string>) => Promise<{ error: { message: string } | null }>;
  },
) {
  lifecycleTarget(action, space, members, actorId, targetId);
  const currentSpace = (await operations.listSpaces()).find((item) => item.id === space.id);
  if (!currentSpace || currentSpace.kind !== 'shared' || currentSpace.membershipRole !== space.membershipRole) {
    throw new StaleSpaceLifecycleError('空间或你的角色已变化，请刷新后重试。');
  }
  lifecycleTarget(action, currentSpace, await operations.readMembers(space.id), actorId, targetId);
  const method = { leave: 'leave_shared_space', remove: 'remove_space_member', transfer: 'transfer_space_ownership', delete: 'delete_shared_space' }[action];
  const args = { p_space_id: space.id } as Record<string, string>;
  if (action === 'remove') args.p_member_user_id = targetId!;
  if (action === 'transfer') args.p_new_owner_user_id = targetId!;
  const { error } = await operations.rpc(method, args);
  if (error) throw new Error(lifecycleErrorMessage(error.message));
}

export function lifecycleErrorMessage(message: string) {
  if (/Shared Space not found/i.test(message)) return '共享空间已不存在，请刷新空间列表。';
  if (/Only an ordinary member may leave|Only the current owner|Target must be another ordinary member|New owner must be the other current member/i.test(message)) {
    return '空间成员或角色已变化，请刷新后重试。';
  }
  return `操作未完成：${message || '请稍后重试。'}`;
}

export async function settleSpaceLifecycle(action: SpaceLifecycleAction, failure: string | undefined, operations: {
  clearSelection: () => void;
  closeDetail: () => void;
  refresh: (resetSelection: boolean) => Promise<boolean>;
  remountDetail: () => void;
  showError: (message: string) => void;
}) {
  const resetSelection = !failure && (action === 'leave' || action === 'delete');
  if (resetSelection) {
    operations.clearSelection();
    operations.closeDetail();
  }
  const refreshed = await operations.refresh(resetSelection);
  if (refreshed) operations.remountDetail();
  if (failure) operations.showError(failure);
  else if (!refreshed) operations.showError('操作已提交，但空间列表未能刷新。请重试刷新空间列表。');
}
