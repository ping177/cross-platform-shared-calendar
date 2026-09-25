import type { CalendarFilter } from './aggregate-calendar';

export type TopLevelTab = 'home' | 'calendar' | 'spaces' | 'me';
export type SpaceScreen = 'list' | 'hub' | 'tasks' | 'completed';
export type NavigationState = { tab: TopLevelTab; spaceScreen: SpaceScreen };

export const initialNavigation: NavigationState = { tab: 'home', spaceScreen: 'list' };

export function selectTab(_current: NavigationState, tab: TopLevelTab): NavigationState {
  return { tab, spaceScreen: 'list' };
}

export function openSpace(_current: NavigationState): NavigationState {
  return { tab: 'spaces', spaceScreen: 'hub' };
}

export function openSpaceScreen(_current: NavigationState, spaceScreen: Exclude<SpaceScreen, 'list'>): NavigationState {
  return { tab: 'spaces', spaceScreen };
}

export function openCalendar(_current: NavigationState): NavigationState {
  return { tab: 'calendar', spaceScreen: 'list' };
}

export function contentSpaceIdForNavigation(tab: TopLevelTab, legacySpaceId: string | null, calendarFilter: CalendarFilter, availableIds: string[]) {
  if (tab === 'spaces') return legacySpaceId && availableIds.includes(legacySpaceId) ? legacySpaceId : null;
  if (tab === 'calendar') return calendarFilter === 'all' ? availableIds[0] ?? null : calendarFilter.spaceId;
  return null;
}
