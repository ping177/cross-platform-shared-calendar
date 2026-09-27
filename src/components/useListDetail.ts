import { useCallback, useEffect, useRef, useState } from 'react';
import { createListsRefreshSignal } from '../lib/lists';
import { applyConfirmedDetailChange } from '../lib/lists-detail';
import { loadListDetail, type ListDetailRead, type ListDetailTarget } from '../lib/lists-detail-data';
import { createRequestGuard } from '../lib/request-guard';
import { supabase } from '../lib/supabase';
import type { List, ListItem, ListSection } from '../types';

type Ready = Extract<ListDetailRead, { status: 'ready' }>;
type DetailState = { status: 'loading' | 'error'; data: null; error: string; degraded: boolean }
  | { status: 'ready'; data: Ready; error: string; degraded: boolean };

export function useListDetail(userId: string, target: ListDetailTarget, onUnavailable: (result: Extract<ListDetailRead, { status: 'ineligible' | 'deleted' }>) => void) {
  const [state, setState] = useState<DetailState>({ status: 'loading', data: null, error: '', degraded: false });
  const [scopeReady, setScopeReady] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [connectionRevision, setConnectionRevision] = useState(0);
  const guard = useRef(createRequestGuard());
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  const refresh = useCallback(async (): Promise<ListDetailRead | null> => {
    const request = guard.current.begin();
    try {
      const result = await loadListDetail(userId, target);
      if (!guard.current.isCurrent(request)) return null;
      if (result.status !== 'ready') {
        onUnavailableRef.current(result);
        return result;
      }
      setState({ status: 'ready', data: result, error: '', degraded: false });
      setScopeReady(true);
      return result;
    } catch (error) {
      if (guard.current.isCurrent(request)) {
        const message = error instanceof Error && /[\u3400-\u9fff]/u.test(error.message) ? error.message : '清单详情读取失败，请重试。';
        setState((current) => current.status === 'ready'
          ? { ...current, error: message, degraded: true }
          : { status: 'error', data: null, error: message, degraded: true });
      }
      return null;
    }
  }, [userId, target.spaceId, target.listId]);

  const reconnect = useCallback(() => {
    setConnectionRevision((revision) => revision + 1);
    void refresh();
  }, [refresh]);

  const applyConfirmed = useCallback((change: { kind: 'list'; row: List } | { kind: 'section'; row: ListSection } | { kind: 'item'; row: ListItem } | { kind: 'item-delete'; id: string } | { kind: 'section-delete'; id: string; preserveItems: boolean }) => {
    guard.current.invalidate();
    setState((current) => current.status === 'ready'
      ? { ...current, data: applyConfirmedDetailChange(current.data, change) }
      : current);
  }, []);

  useEffect(() => {
    void refresh();
    const onForeground = () => { if (document.visibilityState === 'visible') reconnect(); };
    const onOnline = () => { reconnect(); };
    window.addEventListener('focus', onForeground);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onForeground);
    return () => {
      window.removeEventListener('focus', onForeground);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onForeground);
      guard.current.invalidate();
    };
  }, [refresh, reconnect]);

  useEffect(() => {
    if (!scopeReady) return;
    let active = true;
    const signal = createListsRefreshSignal(() => { void refresh(); });
    const channel = supabase.channel(`lists-detail:${userId}:${target.listId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists', filter: `id=eq.${target.listId}` }, signal.signal)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_sections', filter: `list_id=eq.${target.listId}` }, signal.signal)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items', filter: `list_id=eq.${target.listId}` }, signal.signal)
      .subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') { setSyncError(''); signal.signal(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setSyncError('清单实时同步暂不可用，请重试。');
        }
      });
    return () => {
      active = false;
      signal.stop();
      void supabase.removeChannel(channel);
    };
  }, [scopeReady, userId, target.listId, refresh, connectionRevision]);

  return { state, syncError, refresh, reconnect, applyConfirmed };
}
