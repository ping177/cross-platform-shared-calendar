import { useCallback, useEffect, useRef, useState } from 'react';
import { createAggregateTaskLoader, subscribeTaskRealtimeScope, taskRealtimeSpaceIds, type TaskFilter } from '../lib/aggregate-tasks';
import { loadAggregateTasks } from '../lib/aggregate-tasks-data';
import { supabase } from '../lib/supabase';
import { taskRealtimeConfig } from '../lib/task';
import { sameModuleScope, type ModuleEntry } from '../lib/module-availability';

export type TaskData = Awaited<ReturnType<typeof loadAggregateTasks>>;
type TaskState = { status: 'loading' | 'error'; data: TaskData | null; error: string } | { status: 'ready'; data: TaskData; error: '' };

function loadErrorText(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return /[\u3400-\u9fff]/.test(message) ? message : '任务读取失败，请重试。';
}

export function useAggregateTasks(userId: string, entry: ModuleEntry | null, entryPending: boolean, initialData?: TaskData, onValidated?: (data: TaskData) => void) {
  const [filter, setFilter] = useState<TaskFilter>(initialData?.filter ?? 'all');
  const [state, setState] = useState<TaskState>(initialData ? { status: 'ready', data: initialData, error: '' } : { status: 'loading', data: null, error: '' });
  const [syncError, setSyncError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const filterRef = useRef<TaskFilter>(initialData?.filter ?? 'all');
  const onValidatedRef = useRef(onValidated);
  onValidatedRef.current = onValidated;
  const entryRef = useRef(entry);
  const pendingRef = useRef(entryPending);
  const loader = useRef(createAggregateTaskLoader(loadAggregateTasks));
  entryRef.current = entry;
  pendingRef.current = entryPending;

  const refresh = useCallback(async (showLoading = false, revalidateEligibility = false) => {
    if (pendingRef.current && !revalidateEligibility) return;
    if (showLoading) setState((current) => current.data ? current : { status: 'loading', data: null, error: '' });
    await loader.current.load(userId, filterRef.current, (result) => {
      if (result.status === 'error') {
        const error = loadErrorText(result.error);
        setRefreshError(error);
        setState((current) => current.data ? current : { status: 'error', data: null, error });
        return;
      }
      setRefreshError('');
      const currentFilter = filterRef.current;
      if (result.data.filter === 'all' ? currentFilter !== 'all' : currentFilter === 'all' || currentFilter.spaceId !== result.data.filter.spaceId) {
        filterRef.current = result.data.filter;
        setFilter(result.data.filter);
      }
      setState({ status: 'ready', data: result.data, error: '' });
      if (sameModuleScope(entryRef.current, result.data.memberSpaces, result.data.eligibleSpaces)) onValidatedRef.current?.(result.data);
    }, revalidateEligibility ? undefined : entryRef.current ?? undefined);
  }, [userId]);

  useEffect(() => {
    if (!entryPending) void refresh(true);
    return () => loader.current.invalidate();
  }, [filter, entry, entryPending, refresh]);

  const lostSpace = Boolean(entry && state.data && !sameModuleScope(entry, state.data.memberSpaces, state.data.eligibleSpaces));
  const scopeIds = state.status === 'ready' && !lostSpace ? taskRealtimeSpaceIds(state.data.eligibleSpaces, state.data.filter).join(',') : '';
  useEffect(() => {
    if (!scopeIds) return;
    let active = true;
    const ids = scopeIds.split(',');
    const connected = new Set<string>();
    setSyncError('');
    const cleanup = subscribeTaskRealtimeScope(ids, (spaceId, changed) => supabase
      .channel(`aggregate-tasks:${userId}:${spaceId}`)
      .on('postgres_changes', taskRealtimeConfig(spaceId), changed)
      .subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          const firstConnection = !connected.has(spaceId);
          connected.add(spaceId);
          if (connected.size === ids.length) setSyncError('');
          if (firstConnection && connected.size === ids.length) void refresh();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          connected.delete(spaceId);
          setSyncError('任务实时同步暂不可用，请检查连接或重试。');
        }
      }), (channel) => { void supabase.removeChannel(channel); }, () => { if (active) void refresh(); });
    return () => { active = false; cleanup(); };
  }, [scopeIds, userId, refresh]);

  function chooseFilter(next: TaskFilter) {
    loader.current.invalidate();
    filterRef.current = next;
    setFilter(next);
    setState((current) => ({ status: 'loading', data: current.data, error: '' }));
    setSyncError('');
    setRefreshError('');
  }

  const visibleState: TaskState = lostSpace ? { status: 'loading', data: null, error: '' } : state;
  return { filter, state: visibleState, syncError, refreshError, canAct: Boolean(entry) && !lostSpace, chooseFilter, refresh };
}
