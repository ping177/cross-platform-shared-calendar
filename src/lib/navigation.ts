import type { CalendarFilter } from './aggregate-calendar';
import { canLeaveReviewDetail, type ReviewDetailTarget } from './review-detail';
import { selectReviewSpace } from './review-history';
import type { CurrentSpace } from '../types';

export type TopLevelTab = 'home' | 'calendar' | 'modules' | 'me';
export type ModuleScreen = 'hub' | 'tasks' | 'completed' | 'review' | 'review-detail' | 'lists';
export type NavigationState = { tab: TopLevelTab; moduleScreen: ModuleScreen };

export const initialNavigation: NavigationState = { tab: 'home', moduleScreen: 'hub' };

export type NavigationTarget =
  | { page: 'home' | 'calendar' | 'modules' | 'profile' | 'tasks' | 'tasks-completed' | 'lists-overview' | 'space-management' }
  | { page: 'review-history'; spaceId?: string }
  | { page: 'review-detail'; spaceId: string; reviewId: string }
  | { page: 'space-detail'; spaceId: string };

type NavigationStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function navigationKey(userId: string) {
  return `navigation:${userId}`;
}

export function parseNavigationTarget(value: string | null): NavigationTarget | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !('page' in parsed)) return null;
    const target = parsed as Record<string, unknown>;
    switch (target.page) {
      case 'home': case 'calendar': case 'modules': case 'profile':
      case 'tasks': case 'tasks-completed': case 'lists-overview': case 'space-management':
        return { page: target.page };
      case 'review-history':
        return target.spaceId === undefined ? { page: 'review-history' }
          : typeof target.spaceId === 'string' && uuidPattern.test(target.spaceId)
            ? { page: 'review-history', spaceId: target.spaceId } : null;
      case 'space-detail':
        return typeof target.spaceId === 'string' && uuidPattern.test(target.spaceId)
          ? { page: 'space-detail', spaceId: target.spaceId } : null;
      case 'review-detail':
        return typeof target.spaceId === 'string' && uuidPattern.test(target.spaceId)
          && typeof target.reviewId === 'string' && uuidPattern.test(target.reviewId)
          ? { page: 'review-detail', spaceId: target.spaceId, reviewId: target.reviewId } : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function readNavigationTarget(storage: NavigationStorage, userId: string): NavigationTarget | null {
  try { return parseNavigationTarget(storage.getItem(navigationKey(userId))); } catch { return null; }
}

export function writeNavigationTarget(storage: NavigationStorage, userId: string, target: NavigationTarget): void {
  try { storage.setItem(navigationKey(userId), JSON.stringify(target)); } catch { /* Navigation still works in memory. */ }
}

export function clearNavigationTarget(storage: NavigationStorage, userId: string): void {
  try { storage.removeItem(navigationKey(userId)); } catch { /* Navigation still works in memory. */ }
}

export function navigationTargetForState(
  navigation: NavigationState,
  myScreen: 'profile' | 'management' | 'detail',
  reviewDetail: ReviewDetailTarget | null,
  reviewSpaceId: string | null,
  selectedSpaceId: string | null,
): NavigationTarget | null {
  switch (navigation.tab) {
    case 'home': return { page: 'home' };
    case 'calendar': return { page: 'calendar' };
    case 'me':
      return myScreen === 'profile' ? { page: 'profile' }
        : myScreen === 'management' ? { page: 'space-management' }
          : selectedSpaceId ? { page: 'space-detail', spaceId: selectedSpaceId } : null;
    case 'modules':
      switch (navigation.moduleScreen) {
        case 'hub': return { page: 'modules' };
        case 'tasks': return { page: 'tasks' };
        case 'completed': return { page: 'tasks-completed' };
        case 'lists': return { page: 'lists-overview' };
        case 'review': return reviewSpaceId ? { page: 'review-history', spaceId: reviewSpaceId } : { page: 'review-history' };
        case 'review-detail': return reviewDetail ? { page: 'review-detail', spaceId: reviewDetail.spaceId, reviewId: reviewDetail.reviewId } : null;
      }
  }
}

export async function resolveNavigationTarget(
  target: NavigationTarget | null,
  spaces: CurrentSpace[],
  review: {
    loadReviewSpaces: () => Promise<CurrentSpace[]>;
    canReadReview: (space: CurrentSpace, reviewId: string) => Promise<boolean>;
  },
  lists?: { loadListsSpaces: () => Promise<CurrentSpace[]> },
): Promise<NavigationTarget> {
  if (!target) return { page: 'home' };
  if (target.page === 'space-detail') {
    return spaces.some((space) => space.id === target.spaceId) ? target : { page: 'space-management' };
  }
  if (target.page === 'lists-overview') {
    if (!lists) return target;
    try { return (await lists.loadListsSpaces()).length ? target : { page: 'modules' }; }
    catch { return target; }
  }
  if (target.page !== 'review-history' && target.page !== 'review-detail') return target;

  let eligible: CurrentSpace[];
  try { eligible = await review.loadReviewSpaces(); } catch { return target; }
  if (target.page === 'review-history') {
    const spaceId = selectReviewSpace(target.spaceId ?? null, eligible);
    return spaceId ? { page: 'review-history', spaceId } : { page: 'modules' };
  }
  const space = eligible.find((item) => item.id === target.spaceId);
  if (!space) return { page: 'modules' };
  try {
    return await review.canReadReview(space, target.reviewId) ? target : { page: 'review-history', spaceId: space.id };
  } catch {
    return target;
  }
}

export function selectTab(_current: NavigationState, tab: TopLevelTab): NavigationState {
  return { tab, moduleScreen: 'hub' };
}

export function canChangeTabFromReviewDetail(current: NavigationState, dirty: boolean, confirmDiscard: () => boolean): boolean {
  return current.tab !== 'modules' || current.moduleScreen !== 'review-detail' || canLeaveReviewDetail(dirty, confirmDiscard);
}

export function openTaskModule(_current: NavigationState): NavigationState {
  return { tab: 'modules', moduleScreen: 'tasks' };
}

export function openReviewModule(_current: NavigationState): NavigationState {
  return { tab: 'modules', moduleScreen: 'review' };
}

export function openListsModule(_current: NavigationState): NavigationState {
  return { tab: 'modules', moduleScreen: 'lists' };
}

export function openReviewDetail(_current: NavigationState): NavigationState {
  return { tab: 'modules', moduleScreen: 'review-detail' };
}

export function openCompletedTasks(_current: NavigationState): NavigationState {
  return { tab: 'modules', moduleScreen: 'completed' };
}

export function openTaskList(_current: NavigationState): NavigationState {
  return { tab: 'modules', moduleScreen: 'tasks' };
}

export function openCalendar(_current: NavigationState): NavigationState {
  return { tab: 'calendar', moduleScreen: 'hub' };
}

export function calendarContentSpaceId(calendarFilter: CalendarFilter, availableIds: string[]) {
  if (calendarFilter === 'all') return availableIds[0] ?? null;
  return availableIds.includes(calendarFilter.spaceId) ? calendarFilter.spaceId : null;
}
