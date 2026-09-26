export type ModuleKey = 'tasks' | 'review' | 'lists';
export type ModuleAvailability = {
  tasksIds: string[] | null;
  reviewIds: string[] | null;
  listsIds: string[] | null;
  tasksError: boolean;
  reviewError: boolean;
  listsError: boolean;
};
export type ModuleRead = { tasksIds: string[] | null; reviewIds: string[] | null; listsIds: string[] | null };

// A failed read never turns a known enabled module into a confirmed disabled one.
export function mergeModuleAvailability(previous: ModuleAvailability | null, read: ModuleRead): ModuleAvailability {
  return {
    tasksIds: read.tasksIds ?? previous?.tasksIds ?? null,
    reviewIds: read.reviewIds ?? previous?.reviewIds ?? null,
    listsIds: read.listsIds ?? previous?.listsIds ?? null,
    tasksError: read.tasksIds === null,
    reviewError: read.reviewIds === null,
    listsError: read.listsIds === null,
  };
}

export function applyModuleToggle(previous: ModuleAvailability | null, key: ModuleKey, spaceId: string, state: 'enabled' | 'disabled'): ModuleAvailability | null {
  if (!previous) return previous;
  const field = key === 'tasks' ? 'tasksIds' : key === 'review' ? 'reviewIds' : 'listsIds';
  const ids = previous[field];
  if (ids === null) return previous;
  return { ...previous, [field]: state === 'enabled' ? [...new Set([...ids, spaceId])] : ids.filter((id) => id !== spaceId) };
}
