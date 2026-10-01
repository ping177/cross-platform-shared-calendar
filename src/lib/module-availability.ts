import type { CurrentSpace } from '../types';

export type ModuleKey = 'tasks' | 'review' | 'lists' | 'important_dates';
export type ModuleAvailability = {
  tasksIds: string[] | null;
  reviewIds: string[] | null;
  listsIds: string[] | null;
  importantDatesIds: string[] | null;
  tasksError: boolean;
  reviewError: boolean;
  listsError: boolean;
  importantDatesError: boolean;
};
export type ModuleRead = { tasksIds: string[] | null; reviewIds: string[] | null; listsIds: string[] | null; importantDatesIds: string[] | null };
export type ModuleEntry = { memberSpaces: CurrentSpace[]; eligibleSpaces: CurrentSpace[] };

// A retained view is usable only for the same confirmed membership and module scope.
export function sameModuleScope(entry: ModuleEntry | null, memberSpaces: CurrentSpace[], eligibleSpaces: CurrentSpace[]): boolean {
  if (!entry) return false;
  const key = (spaces: CurrentSpace[]) => spaces.map((space) => `${space.id}:${space.membershipRole}`).sort().join(',');
  return key(entry.memberSpaces) === key(memberSpaces) && key(entry.eligibleSpaces) === key(eligibleSpaces);
}

export function moduleEntry(spaces: CurrentSpace[], availability: ModuleAvailability | null, key: ModuleKey, refreshing: boolean): ModuleEntry | null {
  const field = key === 'tasks' ? 'tasksIds' : key === 'review' ? 'reviewIds' : key === 'lists' ? 'listsIds' : 'importantDatesIds';
  const error = key === 'tasks' ? availability?.tasksError : key === 'review' ? availability?.reviewError : key === 'lists' ? availability?.listsError : availability?.importantDatesError;
  const ids = availability?.[field];
  if (refreshing || error || !ids) return null;
  const known = new Set(spaces.map((space) => space.id));
  if (ids.some((id) => !known.has(id))) return null;
  const eligible = new Set(ids);
  return { memberSpaces: spaces, eligibleSpaces: spaces.filter((space) => eligible.has(space.id)) };
}

// A failed read never turns a known enabled module into a confirmed disabled one.
export function mergeModuleAvailability(previous: ModuleAvailability | null, read: ModuleRead): ModuleAvailability {
  return {
    tasksIds: read.tasksIds ?? previous?.tasksIds ?? null,
    reviewIds: read.reviewIds ?? previous?.reviewIds ?? null,
    listsIds: read.listsIds ?? previous?.listsIds ?? null,
    importantDatesIds: read.importantDatesIds ?? previous?.importantDatesIds ?? null,
    tasksError: read.tasksIds === null,
    reviewError: read.reviewIds === null,
    listsError: read.listsIds === null,
    importantDatesError: read.importantDatesIds === null,
  };
}

export function applyModuleToggle(previous: ModuleAvailability | null, key: ModuleKey, spaceId: string, state: 'enabled' | 'disabled'): ModuleAvailability | null {
  if (!previous) return previous;
  const field = key === 'tasks' ? 'tasksIds' : key === 'review' ? 'reviewIds' : key === 'lists' ? 'listsIds' : 'importantDatesIds';
  const ids = previous[field];
  if (ids === null) return previous;
  return { ...previous, [field]: state === 'enabled' ? [...new Set([...ids, spaceId])] : ids.filter((id) => id !== spaceId) };
}
