import { useCallback, useEffect, useRef, useState } from 'react';
import { ImportantDatesAuthError, loadImportantDates, type ImportantDatesData } from '../lib/important-dates-data';
import { importantDateLocalToday, normalizeImportantDateFilter, type ImportantDateFilter } from '../lib/important-dates';
import { createRequestGuard } from '../lib/request-guard';
import { supabase } from '../lib/supabase';

export type ImportantDatesState = { userId: string; data: ImportantDatesData | null; error: string; refreshing: boolean; authLost: boolean };

export function useImportantDates(userId: string, onNoEligible: () => void, eligibilityRevision = 0) {
  const [state, setState] = useState<ImportantDatesState>({ userId, data: null, error: '', refreshing: true, authLost: false });
  const [filter, setFilter] = useState<ImportantDateFilter>('all');
  const [today, setToday] = useState(importantDateLocalToday);
  const guard = useRef(createRequestGuard());
  const noEligibleRef = useRef(onNoEligible);
  noEligibleRef.current = onNoEligible;

  const invalidate = useCallback(() => {
    guard.current.invalidate();
    setState({ userId, data: null, error: '', refreshing: true, authLost: false });
  }, [userId]);

  const refresh = useCallback(async (): Promise<ImportantDatesData | null> => {
    const request = guard.current.begin();
    setState((current) => ({ ...current, refreshing: true }));
    try {
      const data = await loadImportantDates(userId, supabase, undefined, (eligibility) => {
        if (!guard.current.isCurrent(request)) return;
        const eligibleIds = new Set(eligibility.eligibleSpaces.map((space) => space.id));
        // Confirmed loss clears affected rows even if the subsequent source read fails.
        setState((current) => current.data ? { ...current, data: { ...eligibility, dates: current.data.dates.filter((date) => eligibleIds.has(date.space_id)) } } : current);
        setFilter((current) => normalizeImportantDateFilter(current, eligibility.eligibleSpaces));
      });
      if (!guard.current.isCurrent(request)) return null;
      setState({ userId, data, error: '', refreshing: false, authLost: false });
      setToday(importantDateLocalToday());
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
    void refresh();
    return () => { guard.current.invalidate(); };
  }, [refresh, eligibilityRevision]);

  useEffect(() => {
    const onFocus = () => { setToday(importantDateLocalToday()); void refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') onFocus(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) {
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

  return { state, filter, today, setFilter, refresh, invalidate, canAct: Boolean(state.data) && !state.refreshing && !state.error };
}
