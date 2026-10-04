import { useEffect, useRef, useState } from 'react';
import { createCalendarReadLoop } from '../lib/calendar-refresh';
import { homeCivilToday, homeMemberKey, validHomeTaskSnapshot, type HomeTaskSnapshot } from '../lib/home-aggregation';
import { sameModuleScope, type ModuleEntry } from '../lib/module-availability';
import { supabase } from '../lib/supabase';
import { taskRealtimeConfig } from '../lib/task';
import type { CurrentSpace, SpaceMember, Task } from '../types';

type TaskRead = { tasks: Task[]; enabledSpaceIds: string[]; membersBySpaceId: Record<string, SpaceMember[]> };
export function useHomeTaskView({ userId, spaces, entry, initialData, readModules, read, onValidated, onInvalidate, onRefresh }: {
  userId: string; spaces: CurrentSpace[]; entry: ModuleEntry | null; initialData?: HomeTaskSnapshot;
  readModules: (spaces: CurrentSpace[]) => Promise<CurrentSpace[]>;
  read: (spaces: CurrentSpace[], userId: string, today: Date, onEligible: (spaces: CurrentSpace[]) => void) => Promise<TaskRead>;
  onValidated?: (data: HomeTaskSnapshot) => void; onInvalidate?: () => void; onRefresh?: () => void;
}) {
  const now = new Date(); const today = homeCivilToday(now);
  const key = `${userId}:${homeMemberKey(spaces)}:${today}:${entry ? homeMemberKey(entry.eligibleSpaces) : 'unknown'}`;
  // Replace the ticket on every scope transition, including A → B → A.
  const scope = useRef({ key, ticket: 0 });
  if (scope.current.key !== key) scope.current = { key, ticket: scope.current.ticket + 1 };
  const ticket = scope.current;
  const callbacks = useRef({ readModules, read, onValidated, onInvalidate, onRefresh }); callbacks.current = { readModules, read, onValidated, onInvalidate, onRefresh };
  const [snapshot, setSnapshot] = useState(() => validHomeTaskSnapshot(initialData, userId, spaces, now, entry));
  const snapshotRef = useRef(snapshot); snapshotRef.current = snapshot;
  const [confirmedScope, setConfirmedScope] = useState<{ entryKey: string; scope: ModuleEntry } | null>(null);
  const entryKey = entry ? homeMemberKey(entry.eligibleSpaces) : 'unknown';
  const failure = useRef('');
  const [error, setError] = useState(''); const [refreshing, setRefreshing] = useState(true); const [revision, setRevision] = useState(0);
  // Only this mount's complete canonical read may qualify actions.
  const fresh = useRef<{ ticket: typeof ticket; data: TaskRead } | null>(null);
  const waiters = useRef<Array<(value: TaskRead | null) => void>>([]);
  const refresh = useRef<() => void>(() => undefined); const blocked = useRef(false);
  const retained = !blocked.current && validHomeTaskSnapshot(snapshot, userId, spaces, now, confirmedScope?.entryKey === entryKey ? confirmedScope.scope : entry);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id === userId) return;
      callbacks.current.onRefresh?.(); blocked.current = true; scope.current = { key, ticket: scope.current.ticket + 1 }; fresh.current = null;
      setSnapshot(undefined); callbacks.current.onInvalidate?.();
      for (const done of waiters.current.splice(0)) done(null);
      failure.current = '登录状态已变化，请重新登录。'; setError(failure.current); setRefreshing(false);
    });
    return () => data.subscription.unsubscribe();
  }, [userId]);

  useEffect(() => {
    let active = true; let loop: ReturnType<typeof createCalendarReadLoop> | null = null;
    const current = () => active && !blocked.current && scope.current === ticket && homeCivilToday(new Date()) === today;
    const connected = new Set<string>(); const channels: ReturnType<typeof supabase.channel>[] = [];
    fresh.current = null;
    if (!validHomeTaskSnapshot(snapshot, userId, spaces, now, entry)) { setSnapshot(undefined); if (snapshot) callbacks.current.onInvalidate?.(); }
    failure.current = ''; setError(''); setRefreshing(true);
    function settle(data: TaskRead | null) { for (const done of waiters.current.splice(0)) done(data); }
    function fail(value: unknown) {
      if (!current()) return;
      callbacks.current.onRefresh?.();
      fresh.current = null; failure.current = value instanceof Error ? value.message : '任务加载失败，请重试。'; setError(failure.current); setRefreshing(false); settle(null);
    }
    function qualifyScope(eligibleSpaces: CurrentSpace[]) {
      const confirmed = { memberSpaces: spaces, eligibleSpaces };
      setConfirmedScope({ entryKey, scope: confirmed });
      const previous = snapshotRef.current;
      if (previous && !sameModuleScope(confirmed, previous.scope.memberSpaces, previous.scope.eligibleSpaces)) { snapshotRef.current = undefined; setSnapshot(undefined); callbacks.current.onInvalidate?.(); }
    }
    async function setup() {
      try {
        const enabled = await callbacks.current.readModules(spaces);
        if (!current()) return;
        qualifyScope(enabled);
        const enabledIds = enabled.map((space) => space.id).join(',');
        loop = createCalendarReadLoop(async (isCurrent) => {
          if (!current()) return;
          fresh.current = null; failure.current = ''; setRefreshing(true); setError('');
          const loaded = await callbacks.current.read(spaces, userId, now, (eligible) => { if (isCurrent() && current()) qualifyScope(eligible); });
          if (!isCurrent() || !current()) return;
          const eligible = spaces.filter((space) => loaded.enabledSpaceIds.includes(space.id)); qualifyScope(eligible);
          if (loaded.enabledSpaceIds.join(',') !== enabledIds) { setRevision((value) => value + 1); return; }
          const validated: HomeTaskSnapshot = { userId, today, scope: { memberSpaces: spaces, eligibleSpaces: eligible }, items: loaded.tasks, membersBySpaceId: loaded.membersBySpaceId };
          fresh.current = { ticket, data: loaded }; snapshotRef.current = validated; setSnapshot(validated); setRefreshing(false);
          callbacks.current.onValidated?.(validated); settle(loaded);
        }, fail);
        function reread() { if (!current()) return; callbacks.current.onRefresh?.(); fresh.current = null; failure.current = ''; setRefreshing(true); setError(''); loop?.change(); }
        refresh.current = reread;
        if (!enabled.length) { loop.start(); return; }
        let ready = false;
        for (const space of enabled) {
          const channel = supabase.channel(`home-tasks:${space.id}`)
            .on('postgres_changes', taskRealtimeConfig(space.id), reread)
            .subscribe((status) => {
              if (!current()) return;
              if (status === 'SUBSCRIBED') {
                const wasConnected = connected.has(space.id); connected.add(space.id);
                if (connected.size === enabled.length && !ready) { ready = true; loop?.start(); }
                else if (!wasConnected && ready) reread();
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                connected.delete(space.id); ready = false; loop?.pause(); fail(new Error('任务实时同步暂不可用，请重试。'));
              }
            });
          channels.push(channel);
        }
      } catch (error) { fail(error); }
    }
    void setup();
    return () => { active = false; loop?.stop(); fresh.current = null; settle(null); refresh.current = () => undefined; for (const channel of channels) void supabase.removeChannel(channel); };
  }, [key, revision]);

  async function qualify(row: Task) {
    if (blocked.current || scope.current !== ticket || !retained) return null;
    const loaded = fresh.current?.ticket === ticket ? fresh.current.data : failure.current ? null : await new Promise<TaskRead | null>((done) => waiters.current.push(done));
    if (!loaded || blocked.current || scope.current !== ticket || homeCivilToday(new Date()) !== today) return null;
    return loaded.tasks.find((item) => item.id === row.id && item.space_id === row.space_id) ?? null;
  }
  return { snapshot: retained || undefined, status: retained ? 'success' as const : error ? 'error' as const : 'loading' as const,
    error, refreshing, qualify, isFresh: (row: Task) => !blocked.current && scope.current === ticket && fresh.current?.ticket === ticket && fresh.current.data.tasks.includes(row), refresh: () => refresh.current(), retry: () => setRevision((value) => value + 1) };
}
