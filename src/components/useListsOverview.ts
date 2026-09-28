import { useCallback, useEffect, useRef, useState } from 'react';
import { loadListsOverview } from '../lib/lists-data';
import { listCurrentSpaces } from '../lib/current-spaces';
import { sameModuleScope, type ModuleEntry } from '../lib/module-availability';
import { createListsRefreshSignal, normalizeListFilter, subscribeListsRealtimeScope, type ListFilter } from '../lib/lists';
import { createRequestGuard } from '../lib/request-guard';
import { supabase } from '../lib/supabase';

export type OverviewData = Awaited<ReturnType<typeof loadListsOverview>>;
type OverviewState = { status: 'loading' | 'error'; error: string; data: null }
  | { status: 'ready'; error: ''; data: OverviewData };

export function useListsOverview(userId: string, onNoEligible: () => void, entry: ModuleEntry | null, entryPending: boolean, initialData?: OverviewData, initialFilter: ListFilter = 'all', onValidated?: (data: OverviewData, filter: ListFilter) => void) {
  const [filter, setFilter] = useState<ListFilter>(initialFilter);
  const [state, setState] = useState<OverviewState>(initialData ? { status: 'ready', data: initialData, error: '' } : { status: 'loading', data: null, error: '' });
  const [scopeIds, setScopeIds] = useState(initialData?.eligibleSpaces.map((space) => space.id).sort().join(',') ?? '');
  const [syncError, setSyncError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const guard = useRef(createRequestGuard());
  const entryRef = useRef(entry);
  const pendingRef = useRef(entryPending);
  entryRef.current = entry;
  pendingRef.current = entryPending;
  const onNoEligibleRef = useRef(onNoEligible);
  onNoEligibleRef.current = onNoEligible;
  const onValidatedRef = useRef(onValidated);
  onValidatedRef.current = onValidated;
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const refresh = useCallback(async (revalidateEligibility = false): Promise<OverviewData | null> => {
    if (pendingRef.current && !revalidateEligibility) return null;
    const request = guard.current.begin();
    setState((current) => current.data ? current : { status: 'loading', data: null, error: '' });
    try {
      const data = await loadListsOverview(userId, supabase, listCurrentSpaces, revalidateEligibility ? undefined : entryRef.current ?? undefined);
      if (!guard.current.isCurrent(request)) return null;
      setRefreshError('');
      const normalizedFilter = normalizeListFilter(filterRef.current, data.eligibleSpaces);
      setFilter(normalizedFilter);
      setScopeIds(data.eligibleSpaces.map((space) => space.id).sort().join(','));
      if (!data.eligibleSpaces.length) {
        onNoEligibleRef.current();
        return data;
      }
      setState({ status: 'ready', data, error: '' });
      if (sameModuleScope(entryRef.current, data.memberSpaces, data.eligibleSpaces)) onValidatedRef.current?.(data, normalizedFilter);
      return data;
    } catch (error) {
      if (guard.current.isCurrent(request)) {
        const errorText = error instanceof Error && /[\u3400-\u9fff]/u.test(error.message)
          ? error.message : '清单读取失败，请重试。';
        setRefreshError(errorText);
        setState((current) => current.data ? current : { status: 'error', data: null, error: errorText });
      }
      return null;
    }
  }, [userId]);

  useEffect(() => {
    if (!entryPending) void refresh();
    return () => { guard.current.invalidate(); };
  }, [entry, entryPending, refresh]);

  const lostSpace = Boolean(entry && state.data && !sameModuleScope(entry, state.data.memberSpaces, state.data.eligibleSpaces));
  const activeScopeIds = lostSpace ? '' : scopeIds;
  useEffect(() => {
    if (!activeScopeIds) return;
    let active = true;
    const ids = activeScopeIds.split(',');
    const connected = new Set<string>();
    const signal = createListsRefreshSignal(() => { void refresh(); });
    setSyncError('');
    const cleanup = subscribeListsRealtimeScope(ids, (spaceId) => supabase.channel(`lists-overview:${userId}:${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists', filter: `space_id=eq.${spaceId}` }, signal.signal)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items', filter: `space_id=eq.${spaceId}` }, signal.signal)
      .subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          connected.add(spaceId);
          if (connected.size === ids.length) { setSyncError(''); signal.signal(); }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          connected.delete(spaceId);
          setSyncError('清单实时同步暂不可用，请重试。');
        }
      }), (channel) => { void supabase.removeChannel(channel); });
    return () => {
      active = false;
      signal.stop();
      cleanup();
    };
  }, [activeScopeIds, userId, refresh]);

  function chooseFilter(next: ListFilter) {
    if (state.status !== 'ready') return;
    const normalized = normalizeListFilter(next, state.data.eligibleSpaces);
    setFilter(normalized);
    if (sameModuleScope(entryRef.current, state.data.memberSpaces, state.data.eligibleSpaces)) onValidatedRef.current?.(state.data, normalized);
  }

  const visibleState: OverviewState = lostSpace ? { status: 'loading', data: null, error: '' } : state;
  return { filter, state: visibleState, syncError, refreshError, canAct: Boolean(entry) && !lostSpace, chooseFilter, refresh };
}
