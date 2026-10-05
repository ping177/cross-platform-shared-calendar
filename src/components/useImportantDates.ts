import { useCallback, useEffect, useRef, useState } from 'react';
import { ImportantDatesAuthError, loadImportantDates, type ImportantDatesData } from '../lib/important-dates-data';
import { importantDateLocalToday, normalizeImportantDateFilter, type ImportantDateFilter } from '../lib/important-dates';
import { sameModuleScope, type ModuleEntry } from '../lib/module-availability';
import { createRequestGuard } from '../lib/request-guard';
import { supabase } from '../lib/supabase';

export type ImportantDatesState = { userId: string; data: ImportantDatesData | null; error: string; refreshing: boolean; authLost: boolean };

export type ImportantDatesEntryOptions = {
  entry?: ModuleEntry | null;
  entryPending?: boolean;
  initialData?: ImportantDatesData;
  initialFilter?: ImportantDateFilter;
  onInvalidateEligibility?: () => void;
};

export function useImportantDates(userId: string, onNoEligible: () => void, eligibilityRevision = 0, options: ImportantDatesEntryOptions = {}) {
  const { entry, entryPending = false, initialData, initialFilter = 'all' } = options;
  const safeInitial = initialData && sameModuleScope(entry ?? null, initialData.memberSpaces, initialData.eligibleSpaces) ? initialData : null;
  const scopeKey = entry === undefined ? 'standalone' : entry ? JSON.stringify([entry.memberSpaces.map((space) => `${space.id}:${space.membershipRole}`).sort(), entry.eligibleSpaces.map((space) => `${space.id}:${space.membershipRole}`).sort()]) : 'unknown';
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [state, setState] = useState<ImportantDatesState>({ userId, data: safeInitial, error: '', refreshing: true, authLost: false });
  const [filter, setFilter] = useState<ImportantDateFilter>(safeInitial ? normalizeImportantDateFilter(initialFilter, safeInitial.eligibleSpaces) : 'all');
  const [today, setToday] = useState(importantDateLocalToday);
  const guard = useRef(createRequestGuard());
  const sessionLost = useRef(false);
  const readContext = useRef(userId);
  if (readContext.current !== userId) {
    guard.current.invalidate();
    readContext.current = userId;
  }
  const noEligibleRef = useRef(onNoEligible);
  noEligibleRef.current = onNoEligible;

  const invalidate = useCallback(() => {
    guard.current.invalidate();
    optionsRef.current.onInvalidateEligibility?.();
    setState({ userId, data: null, error: '', refreshing: true, authLost: false });
  }, [userId]);

  const refresh = useCallback(async (revalidateEligibility = true): Promise<ImportantDatesData | null> => {
    const request = guard.current.begin();
    setState((current) => ({ ...current, refreshing: true }));
    try {
      const publishEligibility = (eligibility: Pick<ImportantDatesData, 'memberSpaces' | 'eligibleSpaces'>) => {
        if (!guard.current.isCurrent(request)) return;
        const eligibleIds = new Set(eligibility.eligibleSpaces.map((space) => space.id));
        // Confirmed loss clears affected rows even if the subsequent source read fails.
        setState((current) => current.data ? { ...current, data: { ...eligibility, dates: current.data.dates.filter((date) => eligibleIds.has(date.space_id)) } } : current);
        setFilter((current) => normalizeImportantDateFilter(current, eligibility.eligibleSpaces));
      };
      const data = await loadImportantDates(userId, supabase, undefined, publishEligibility,
        revalidateEligibility ? undefined : optionsRef.current.entry ?? undefined);
      if (!guard.current.isCurrent(request)) return null;
      setState({ userId, data, error: '', refreshing: false, authLost: false });
      setToday(importantDateLocalToday());
      const currentEntry = optionsRef.current.entry;
      if (data.eligibleSpaces.length && currentEntry !== undefined && !sameModuleScope(currentEntry, data.memberSpaces, data.eligibleSpaces)) optionsRef.current.onInvalidateEligibility?.();
      if (!data.eligibleSpaces.length) noEligibleRef.current();
      return data;
    } catch (error) {
      if (guard.current.isCurrent(request)) {
        const message = error instanceof Error && /[\u3400-\u9fff]/u.test(error.message) ? error.message : '重要日读取失败，请重试。';
        const authLost = error instanceof ImportantDatesAuthError;
        setState((current) => ({ userId, data: authLost ? null : current.data, error: message, refreshing: false, authLost }));
      }
      return null;
    }
  }, [userId]);

  useEffect(() => {
    if (!entryPending) void refresh(false);
    return () => { guard.current.invalidate(); };
  }, [refresh, eligibilityRevision, scopeKey, entryPending]);

  useEffect(() => {
    const onFocus = () => { setToday(importantDateLocalToday()); void refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') onFocus(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) {
        sessionLost.current = true;
        guard.current.invalidate();
        setState({ userId, data: null, error: '登录状态已变化。', refreshing: false, authLost: true });
      }
    });
    let timer: ReturnType<typeof setTimeout>;
    const scheduleRollover = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => { onFocus(); scheduleRollover(); }, midnight.getTime() - now.getTime());
    };
    scheduleRollover();
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      auth.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [refresh, invalidate, userId]);

  // A confirmed scope loss hides affected rows immediately; an unknown hint only
  // blocks actions while the module's canonical reader resolves it.
  const lostScope = entry && state.data && !sameModuleScope(entry, state.data.memberSpaces, state.data.eligibleSpaces);
  const visibleState = lostScope ? { ...state, data: null } : state;
  const validEntry = entry === undefined || Boolean(entry && !entryPending && state.data && sameModuleScope(entry, state.data.memberSpaces, state.data.eligibleSpaces));
  return { state: visibleState, sessionLost: sessionLost.current, filter, today, setFilter, refresh, invalidate, canAct: !sessionLost.current && validEntry && Boolean(visibleState.data) && !state.refreshing && !state.error };
}
