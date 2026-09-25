import { useCallback, useEffect, useRef, useState } from 'react';
import { createAggregateTaskLoader, subscribeTaskRealtimeScope, taskRealtimeSpaceIds, type TaskFilter } from '../lib/aggregate-tasks';
import { loadAggregateTasks } from '../lib/aggregate-tasks-data';
import { supabase } from '../lib/supabase';
import { taskRealtimeConfig } from '../lib/task';

type TaskData = Awaited<ReturnType<typeof loadAggregateTasks>>;
type TaskState = { status: 'loading' | 'error'; data: TaskData | null; error: string } | { status: 'ready'; data: TaskData; error: '' };

function loadErrorText(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return /[\u3400-\u9fff]/.test(message) ? message : '任务读取失败，请重试。';
}

export function useAggregateTasks(userId: string) {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [state, setState] = useState<TaskState>({ status: 'loading', data: null, error: '' });
  const [syncError, setSyncError] = useState('');
  const filterRef = useRef<TaskFilter>('all');
  const loader = useRef(createAggregateTaskLoader(loadAggregateTasks));

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setState((current) => ({ status: 'loading', data: current.data, error: '' }));
    await loader.current.load(userId, filterRef.current, (result) => {
      if (result.status === 'error') {
        setState({ status: 'error', data: null, error: loadErrorText(result.error) });
        return;
      }
      const currentFilter = filterRef.current;
      if (result.data.filter === 'all' ? currentFilter !== 'all' : currentFilter === 'all' || currentFilter.spaceId !== result.data.filter.spaceId) {
        filterRef.current = result.data.filter;
        setFilter(result.data.filter);
      }
      setState({ status: 'ready', data: result.data, error: '' });
    });
  }, [userId]);

  useEffect(() => {
    void refresh(true);
    return () => loader.current.invalidate();
  }, [filter, refresh]);

  useEffect(() => {
    const refocus = () => { void refresh(true); };
    window.addEventListener('focus', refocus);
    return () => window.removeEventListener('focus', refocus);
  }, [refresh]);

  const scopeIds = state.status === 'ready' ? taskRealtimeSpaceIds(state.data.eligibleSpaces, state.data.filter).join(',') : '';
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
  }

  return { filter, state, syncError, chooseFilter, refresh };
}
