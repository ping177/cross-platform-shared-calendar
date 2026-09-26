import type { CalendarFilter } from './aggregate-calendar';

export type TopLevelTab = 'home' | 'calendar' | 'modules' | 'me';
export type ModuleScreen = 'hub' | 'tasks' | 'completed' | 'review';
export type NavigationState = { tab: TopLevelTab; moduleScreen: ModuleScreen };

export const initialNavigation: NavigationState = { tab: 'home', moduleScreen: 'hub' };

export function selectTab(_current: NavigationState, tab: TopLevelTab): NavigationState {
  return { tab, moduleScreen: 'hub' };
}

export function openTaskModule(_current: NavigationState): NavigationState {
  return { tab: 'modules', moduleScreen: 'tasks' };
}

export function openReviewModule(_current: NavigationState): NavigationState {
  return { tab: 'modules', moduleScreen: 'review' };
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
