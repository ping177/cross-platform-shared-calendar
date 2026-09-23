import type { CurrentSpace } from '../types.ts';

type SelectionStorage = Pick<Storage, 'getItem' | 'setItem'>;

function selectionKey(userId: string) {
  return `selectedSpaceId:${userId}`;
}

export function readSelectedSpaceId(storage: SelectionStorage, userId: string) {
  try {
    return storage.getItem(selectionKey(userId));
  } catch {
    return null;
  }
}

export function writeSelectedSpaceId(storage: SelectionStorage, userId: string, spaceId: string) {
  try {
    storage.setItem(selectionKey(userId), spaceId);
  } catch {
    // The in-memory selection still works when device storage is unavailable.
  }
}

export function ensureOnceUntilFailure(run: () => Promise<void>) {
  let pending: Promise<void> | null = null;
  return () => {
    if (!pending) pending = run().catch((error) => { pending = null; throw error; });
    return pending;
  };
}

export function chooseSelectedSpaceId(spaces: CurrentSpace[], savedId: string | null) {
  if (savedId && spaces.some((space) => space.id === savedId)) return savedId;
  const ordered = [...spaces].sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id));
  return ordered.find((space) => space.kind === 'shared')?.id
    ?? ordered.find((space) => space.kind === 'personal')?.id
    ?? null;
}

export async function bootstrapSpaces(
  userId: string,
  storage: SelectionStorage,
  operations: { ensurePersonalSpace: () => Promise<unknown>; listCurrentSpaces: () => Promise<CurrentSpace[]>; currentSelectionId?: string | null },
) {
  let personalInitializationError: Error | null = null;
  try {
    await operations.ensurePersonalSpace();
  } catch (error) {
    personalInitializationError = error instanceof Error ? error : new Error('我的空间初始化请求失败。');
  }
  const spaces = await operations.listCurrentSpaces();
  const currentId = operations.currentSelectionId;
  const rememberedId = currentId && spaces.some((space) => space.id === currentId) ? currentId : readSelectedSpaceId(storage, userId);
  const selectedSpaceId = chooseSelectedSpaceId(spaces, rememberedId);
  if (!selectedSpaceId) {
    throw new Error(personalInitializationError ? '我的空间暂时没有初始化成功，请重试。' : '未找到可用空间，请重新加载。');
  }
  return {
    spaces,
    selectedSpaceId,
    personalInitializationError: spaces.some((space) => space.kind === 'personal') ? null : personalInitializationError,
  };
}

export async function completeSharedSpaceAction(
  action: 'create' | 'join',
  value: string,
  rpc: (method: string, args: Record<string, string>) => Promise<{ data: { id: string } | null; error: Error | null }>,
  onReady: (spaceId: string) => Promise<boolean>,
) {
  const method = action === 'create' ? 'create_space_with_invite' : 'join_space_by_invite_code';
  const args: Record<string, string> = action === 'create' ? { space_name: value } : { code: value.trim().toUpperCase() };
  const { data, error } = await rpc(method, args);
  if (error) throw error;
  if (!data?.id) throw new Error('无法确认共享空间，请重试。');
  return onReady(data.id);
}
