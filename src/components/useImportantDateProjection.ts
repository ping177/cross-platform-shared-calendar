import { useCallback, useEffect, useRef, useState } from 'react';
import { ImportantDatesAuthError, loadCalendarImportantDates, loadHomeImportantDates } from '../lib/important-dates-data';
import { homeImportantDates, projectImportantDates, type HomeImportantDate, type ImportantDateOccurrence, type ImportantDateRange } from '../lib/important-date-projection';
import type { CivilDate } from '../../supabase/functions/_shared/important-date.ts';
import { createRequestGuard } from '../lib/request-guard';
import type { ModuleEntry } from '../lib/module-availability';
import { supabase } from '../lib/supabase';

export type ImportantDateProjectionRequest =
  | { kind: 'home'; today: CivilDate }
  | { kind: 'calendar'; spaceIds: string[]; range: ImportantDateRange };
type ProjectionView = { kind: 'home'; items: HomeImportantDate[] } | { kind: 'calendar'; items: ImportantDateOccurrence[] };
export type ImportantDateProjectionState = {
  requestKey: string;
  status: 'loading' | 'success' | 'error';
  view: ProjectionView | null;
  scope: ModuleEntry | null;
  error: string;
};

// Only Home/Calendar projections. No navigation, editing authority, retained
// business cache or subscriptions to database changes. Callers own date inputs,
// including local-midnight changes to Home's explicit `today`.
export function useImportantDateProjection(userId: string, request: ImportantDateProjectionRequest, entry: ModuleEntry | null = null) {
  const scopeIds = (spaces: ModuleEntry['memberSpaces']) => spaces.map((space) => `${space.id}:${space.membershipRole}`).sort();
  const readRequest: ImportantDateProjectionRequest = request.kind === 'home'
    ? { kind: 'home', today: { ...request.today } }
    : { kind: 'calendar', spaceIds: [...new Set(request.spaceIds)].sort(), range: { start: { ...request.range.start }, end: { ...request.range.end } } };
  const contextKey = JSON.stringify([userId, readRequest, entry ? [scopeIds(entry.memberSpaces), scopeIds(entry.eligibleSpaces)] : null]);
  const guard = useRef(createRequestGuard());
  const context = useRef({ key: contextKey, generation: 0 });
  if (context.current.key !== contextKey) {
    guard.current.invalidate();
    context.current = { key: contextKey, generation: context.current.generation + 1 };
  }
  const requestKey = JSON.stringify([contextKey, context.current.generation]);
  const inputs = useRef({ userId, request: readRequest, requestKey });
  inputs.current = { userId, request: readRequest, requestKey };
  const loading = (key: string): ImportantDateProjectionState => ({ requestKey: key, status: 'loading', view: null, scope: null, error: '' });
  const [state, setState] = useState<ImportantDateProjectionState>(() => loading(requestKey));

  const invalidate = useCallback(() => {
    guard.current.invalidate();
    setState(loading(inputs.current.requestKey));
  }, []);

  const refresh = useCallback(async () => {
    const context = inputs.current;
    const ticket = guard.current.begin();
    const isCurrent = () => guard.current.isCurrent(ticket) && inputs.current.requestKey === context.requestKey;
    setState(loading(context.requestKey));
    const publishEligibility = (scope: ModuleEntry) => {
      if (isCurrent()) setState((current) => ({ ...current, scope, view: null }));
    };
    try {
      const target = context.request;
      const data = target.kind === 'home'
        ? await loadHomeImportantDates(context.userId, target.today, supabase, undefined, publishEligibility)
        : await loadCalendarImportantDates(context.userId, target.spaceIds, target.range, supabase, undefined, publishEligibility);
      if (!isCurrent()) return;
      const view: ProjectionView = target.kind === 'home'
        ? { kind: 'home', items: homeImportantDates(data.dates, target.today) }
        : { kind: 'calendar', items: projectImportantDates(data.dates, target.range) };
      setState({ requestKey: context.requestKey, status: 'success', view,
        scope: { memberSpaces: data.memberSpaces, eligibleSpaces: data.eligibleSpaces }, error: '' });
    } catch (error) {
      if (!isCurrent()) return;
      const message = error instanceof ImportantDatesAuthError ? '登录状态已变化，请重试。'
        : error instanceof Error && /[\u3400-\u9fff]/u.test(error.message) ? error.message : '重要日读取失败，请重试。';
      setState((current) => ({ ...current, status: 'error', view: null, error: message }));
    }
  }, [userId, requestKey]);

  useEffect(() => {
    void refresh();
    return () => guard.current.invalidate();
  }, [refresh]);

  useEffect(() => {
    const onForeground = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') onForeground(); };
    window.addEventListener('focus', onForeground);
    window.addEventListener('online', onForeground);
    document.addEventListener('visibilitychange', onVisible);
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      if (inputs.current.userId !== userId || session?.user.id === userId) return;
      guard.current.invalidate();
      setState({ ...loading(inputs.current.requestKey), status: 'error', error: '登录状态已变化，请重试。' });
    });
    return () => {
      window.removeEventListener('focus', onForeground);
      window.removeEventListener('online', onForeground);
      document.removeEventListener('visibilitychange', onVisible);
      auth.subscription.unsubscribe();
    };
  }, [userId, refresh]);

  // Render-time masking closes the gap before the next effect cleans up an old
  // range/scope/user request; its late response also checks this exact key.
  return { state: state.requestKey === requestKey ? state : loading(requestKey), refresh, invalidate };
}
