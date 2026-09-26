import { useCallback, useEffect, useRef, useState } from 'react';
import { loadListsOverview } from '../lib/lists-data';
import { createListsRefreshSignal, normalizeListFilter, subscribeListsRealtimeScope, type ListFilter } from '../lib/lists';
import { createRequestGuard } from '../lib/request-guard';
import { supabase } from '../lib/supabase';

type OverviewData = Awaited<ReturnType<typeof loadListsOverview>>;
type OverviewState = { status: 'loading' | 'error'; error: string; data: null }
  | { status: 'ready'; error: ''; data: OverviewData };

export function useListsOverview(userId: string, onNoEligible: () => void) {
  const [filter, setFilter] = useState<ListFilter>('all');
  const [state, setState] = useState<OverviewState>({ status: 'loading', data: null, error: '' });
  const [scopeIds, setScopeIds] = useState('');
  const [syncError, setSyncError] = useState('');
  const guard = useRef(createRequestGuard());
  const onNoEligibleRef = useRef(onNoEligible);
  onNoEligibleRef.current = onNoEligible;

  const refresh = useCallback(async (): Promise<OverviewData | null> => {
    const request = guard.current.begin();
    setState({ status: 'loading', data: null, error: '' });
    try {
      const data = await loadListsOverview(userId);
      if (!guard.current.isCurrent(request)) return null;
      setFilter((current) => normalizeListFilter(current, data.eligibleSpaces));
      setScopeIds(data.eligibleSpaces.map((space) => space.id).sort().join(','));
      if (!data.eligibleSpaces.length) {
        onNoEligibleRef.current();
        return data;
      }
      setState({ status: 'ready', data, error: '' });
      return data;
    } catch (error) {
      if (guard.current.isCurrent(request)) {
        setScopeIds('');
        setState({ status: 'error', data: null, error: error instanceof Error && /[\u3400-\u9fff]/u.test(error.message)
          ? error.message : '清单读取失败，请重试。' });
      }
      return null;
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); guard.current.invalidate(); };
  }, [refresh]);

  useEffect(() => {
    if (!scopeIds) return;
    let active = true;
    const ids = scopeIds.split(',');
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
  }, [scopeIds, userId, refresh]);

  function chooseFilter(next: ListFilter) {
    if (state.status !== 'ready') return;
    setFilter(normalizeListFilter(next, state.data.eligibleSpaces));
  }

  return { filter, state, syncError, chooseFilter, refresh };
}
