import { useCallback, useEffect, useRef, useState } from 'react';
import { ImportantDatesAuthError, loadCalendarImportantDates, loadHomeImportantDates } from '../lib/important-dates-data';
import { compareImportantDateCivilDates, homeImportantDates, projectImportantDates, type HomeImportantDate, type ImportantDateOccurrence, type ImportantDateRange } from '../lib/important-date-projection';
import type { CivilDate } from '../../supabase/functions/_shared/important-date.ts';
import { createRequestGuard } from '../lib/request-guard';
import { sameModuleScope, type ModuleEntry } from '../lib/module-availability';
import { supabase } from '../lib/supabase';

export type ImportantDateProjectionRequest =
  | { kind: 'home'; today: CivilDate }
  | { kind: 'calendar'; spaceIds: string[]; range: ImportantDateRange };
type ProjectionView = { kind: 'home'; items: HomeImportantDate[] } | { kind: 'calendar'; items: ImportantDateOccurrence[] };
export type HomeImportantDatesSnapshot = { userId: string; today: CivilDate; scope: ModuleEntry; items: HomeImportantDate[] };
type HomeRetention = {
  memberSpaces: ModuleEntry['memberSpaces']; initialData?: HomeImportantDatesSnapshot;
  onValidated?: (data: HomeImportantDatesSnapshot) => void; onInvalidate?: () => void;
};
export type ImportantDateProjectionState = {
  requestKey: string;
  status: 'loading' | 'success' | 'error';
  view: ProjectionView | null;
  scope: ModuleEntry | null;
  error: string;
  refreshing: boolean;
};

// Home can restore an App-owned validated presentation, then always reconcile
// canonically. Calendar remains a read-only projection without retained data.
export function useImportantDateProjection(userId: string, request: ImportantDateProjectionRequest, entry: ModuleEntry | null = null, retention?: HomeRetention) {
  const scopeIds = (spaces: ModuleEntry['memberSpaces']) => spaces.map((space) => `${space.id}:${space.membershipRole}`).sort();
  const readRequest: ImportantDateProjectionRequest = request.kind === 'home'
    ? { kind: 'home', today: { ...request.today } }
    : { kind: 'calendar', spaceIds: [...new Set(request.spaceIds)].sort(), range: { start: { ...request.range.start }, end: { ...request.range.end } } };
  const contextKey = JSON.stringify([userId, readRequest, entry ? [scopeIds(entry.memberSpaces), scopeIds(entry.eligibleSpaces)] : null,
    retention ? scopeIds(retention.memberSpaces) : null]);
  const guard = useRef(createRequestGuard());
  const context = useRef({ key: contextKey, generation: 0 });
  if (context.current.key !== contextKey) {
    guard.current.invalidate();
    context.current = { key: contextKey, generation: context.current.generation + 1 };
  }
  const requestKey = JSON.stringify([contextKey, context.current.generation]);
  const inputs = useRef({ userId, request: readRequest, requestKey, entry, retention });
  inputs.current = { userId, request: readRequest, requestKey, entry, retention };
  const authLost = useRef(false);
  const presentation = useRef<HomeImportantDatesSnapshot | null>(retention?.initialData ?? null);
  const safePresentation = () => {
    const data = presentation.current;
    const current = inputs.current;
    if (authLost.current || !data || !current.retention || current.request.kind !== 'home' || data.userId !== current.userId
      || compareImportantDateCivilDates(data.today, current.request.today) !== 0) return null;
    const membership = { memberSpaces: current.retention.memberSpaces, eligibleSpaces: data.scope.eligibleSpaces };
    if (!sameModuleScope(membership, data.scope.memberSpaces, data.scope.eligibleSpaces)
      || (current.entry && !sameModuleScope(current.entry, data.scope.memberSpaces, data.scope.eligibleSpaces))) return null;
    return data;
  };
  const loading = (key: string): ImportantDateProjectionState => ({ requestKey: key, status: 'loading', view: null, scope: null, error: '', refreshing: true });
  const retainedState = (key: string): ImportantDateProjectionState => {
    const data = safePresentation();
    return data ? { requestKey: key, status: 'success', view: { kind: 'home', items: data.items }, scope: data.scope, error: '', refreshing: true } : loading(key);
  };
  const [state, setState] = useState<ImportantDateProjectionState>(() => retainedState(requestKey));
  const clearPresentation = () => { presentation.current = null; inputs.current.retention?.onInvalidate?.(); };

  const invalidate = useCallback(() => {
    guard.current.invalidate();
    clearPresentation();
    setState(loading(inputs.current.requestKey));
  }, []);

  const refresh = useCallback(async () => {
    if (authLost.current) return;
    const context = inputs.current;
    const ticket = guard.current.begin();
    const isCurrent = () => guard.current.isCurrent(ticket) && inputs.current.requestKey === context.requestKey;
    if (presentation.current && !safePresentation()) clearPresentation();
    setState(retainedState(context.requestKey));
    const publishEligibility = (scope: ModuleEntry) => {
      if (!isCurrent()) return;
      if (presentation.current && !sameModuleScope(scope, presentation.current.scope.memberSpaces, presentation.current.scope.eligibleSpaces)) clearPresentation();
      setState((current) => ({ ...current, scope, status: presentation.current ? current.status : 'loading', view: presentation.current ? current.view : null }));
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
      const scope = { memberSpaces: data.memberSpaces, eligibleSpaces: data.eligibleSpaces };
      setState({ requestKey: context.requestKey, status: 'success', view, scope, error: '', refreshing: false });
      if (target.kind === 'home' && view.kind === 'home' && context.retention) {
        presentation.current = { userId: context.userId, today: target.today, scope, items: view.items };
        inputs.current.retention?.onValidated?.(presentation.current);
      }
    } catch (error) {
      if (!isCurrent()) return;
      const message = error instanceof ImportantDatesAuthError ? '登录状态已变化，请重试。'
        : error instanceof Error && /[\u3400-\u9fff]/u.test(error.message) ? error.message : '重要日读取失败，请重试。';
      // getUser transport errors also use AuthError: discard the presentation,
      // but allow an explicit fresh retry. Only an auth event ends this session.
      if (error instanceof ImportantDatesAuthError) clearPresentation();
      setState((current) => ({ ...current, status: 'error', view: presentation.current ? current.view : null, error: message, refreshing: false }));
    }
  }, [userId, requestKey]);

  useEffect(() => {
    const ticket = guard.current.begin();
    // Skip same-turn cleanup/StrictMode replay or a foreground read that has
    // already superseded this queued mount/context reconciliation.
    void Promise.resolve().then(() => { if (guard.current.isCurrent(ticket)) void refresh(); });
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
      authLost.current = true;
      clearPresentation();
      setState({ ...loading(inputs.current.requestKey), status: 'error', refreshing: false, error: '登录状态已变化，请重试。' });
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
  return { state: state.requestKey === requestKey ? state : retainedState(requestKey), refresh, invalidate };
}
