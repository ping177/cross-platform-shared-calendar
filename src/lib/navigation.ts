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
