import { useEffect, useRef, useState } from 'react';
import { readAggregateCalendar, type AggregateCalendarData, type CalendarFilter } from '../lib/aggregate-calendar';
import { calendarVisibleRange, type CalendarDisplayView } from '../lib/calendar-display';
import { calendarEventPresentation, calendarEventScopeKey, calendarEventViewKey, sameCalendarEventOccurrence, validCalendarEventsSnapshot, type CalendarEventPresentation, type CalendarEventsSnapshot } from '../lib/calendar-event-view';
import { createCalendarReadLoop } from '../lib/calendar-refresh';
import { createRequestGuard } from '../lib/request-guard';
import { expandRecurringEvents } from '../lib/recurrence';
import { readSpaceMembers } from '../lib/space-members';
import { supabase } from '../lib/supabase';
import type { CalendarEvent, CurrentSpace, EventOccurrenceException } from '../types';

function errorText(error: unknown) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : '日历读取失败，请重试。';
}

export function useCalendarEvents(userId: string, memberSpaces: CurrentSpace[], spaces: CurrentSpace[], filter: CalendarFilter, view: CalendarDisplayView, selectedDate: Date, options: {
  initialData?: CalendarEventsSnapshot;
  onValidated?: (data: CalendarEventsSnapshot) => void;
  onInvalidate?: () => void;
}) {
  const scopeKey = calendarEventScopeKey(userId, memberSpaces, spaces, filter);
  const viewKey = calendarEventViewKey(scopeKey, view, selectedDate);
  const [presentation, setPresentation] = useState(() => validCalendarEventsSnapshot(options.initialData, scopeKey, viewKey));
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [retry, setRetry] = useState(0);
  const [authLost, setAuthLost] = useState(false);
  const sessionLost = useRef(false);
  const requestGuard = useRef(createRequestGuard());
  const scopeRevision = useRef({ key: viewKey, generation: 0 });
  if (scopeRevision.current.key !== viewKey) scopeRevision.current = { key: viewKey, generation: scopeRevision.current.generation + 1 };
  const current = useRef({ scopeKey, viewKey, view, selectedDate, options });
  current.current = { scopeKey, viewKey, view, selectedDate, options };
  // Full sources/exceptions are mounted canonical authority only; never lifted
  // into the session presentation slot. The original read loop owns freshness.
  const canonical = useRef<{ data: AggregateCalendarData; isCurrent: () => boolean } | null>(null);
  const pending = useRef(true);
  const waiters = useRef(new Set<(success: boolean) => void>());
  const reload = useRef<() => void>(() => undefined);
  function settle(success: boolean) {
    pending.current = false;
    for (const resolve of waiters.current) resolve(success);
    waiters.current.clear();
  }
  function publish(data: AggregateCalendarData) {
    const context = current.current;
    const expansion = expandRecurringEvents(data.events, calendarVisibleRange(context.view, context.selectedDate), data.exceptions);
    if (expansion.errors.length) throw new Error('重复日程无法完整显示，请重试。');
    const snapshot: CalendarEventsSnapshot = { scopeKey: context.scopeKey, viewKey: context.viewKey,
      items: calendarEventPresentation(expansion.occurrences), membersBySpaceId: data.membersBySpaceId };
    setPresentation(snapshot); setStatus('success'); setError('');
    context.options.onValidated?.(snapshot);
  }

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id === userId) return;
      sessionLost.current = true; requestGuard.current.invalidate(); canonical.current = null;
      setAuthLost(true); setPresentation(undefined); current.current.options.onInvalidate?.(); settle(false);
    });
    return () => data.subscription.unsubscribe();
  }, [userId]);

  useEffect(() => {
    let active = true;
    let subscribed = false;
    const connected = new Set<string>();
    const channels: ReturnType<typeof supabase.channel>[] = [];
    const readScope = scopeKey;
    const readLoop = createCalendarReadLoop(async (isCurrent) => {
      const request = requestGuard.current.begin();
      canonical.current = null; pending.current = true; setStatus('loading'); setError('');
      const loaded = await readAggregateCalendar(spaces, {
        eventPage: async (spaceId, start, end) => {
          const result = await supabase.from('events').select('*', { count: 'exact' })
            .eq('space_id', spaceId).order('id').range(start, end);
          return { data: result.data as CalendarEvent[] | null, count: result.count, error: result.error };
        },
        exceptionPage: async (eventIds, start, end) => {
          const result = await supabase.from('event_occurrence_exceptions').select('*', { count: 'exact' })
            .in('event_id', eventIds).order('event_id').order('occurrence_date').order('id').range(start, end);
          return { data: result.data as EventOccurrenceException[] | null, count: result.count, error: result.error };
        },
        members: readSpaceMembers,
      });
      const fresh = () => active && !sessionLost.current && isCurrent() && requestGuard.current.isCurrent(request) && current.current.scopeKey === readScope;
      if (!fresh()) return;
      if (spaces.some((space) => !loaded.membersBySpaceId[space.id]?.some((member) => member.user_id === userId))) {
        setPresentation(undefined); current.current.options.onInvalidate?.();
        throw new Error('空间成员身份已变化，请重新读取空间。');
      }
      publish(loaded);
      canonical.current = { data: loaded, isCurrent: fresh };
      settle(true);
    }, (readError) => {
      if (!active || sessionLost.current || current.current.scopeKey !== readScope) return;
      canonical.current = null; setError(errorText(readError)); setStatus('error'); settle(false);
    });
    function changed() {
      if (!active || sessionLost.current) return;
      requestGuard.current.invalidate(); canonical.current = null; pending.current = true;
      setStatus('loading'); readLoop.change();
    }
    reload.current = changed;
    canonical.current = null; pending.current = true; setStatus('loading'); setSyncError('');
    for (const visibleSpace of spaces) {
      const channel = supabase.channel(`calendar-events:${visibleSpace.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `space_id=eq.${visibleSpace.id}` }, changed)
        .subscribe((channelStatus) => {
          if (!active || sessionLost.current) return;
          if (channelStatus === 'SUBSCRIBED') {
            const wasConnected = connected.has(visibleSpace.id);
            connected.add(visibleSpace.id);
            if (connected.size === spaces.length && !subscribed) { subscribed = true; readLoop.start(); }
            else if (!wasConnected && subscribed) changed();
            if (connected.size === spaces.length) setSyncError('');
          } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' || channelStatus === 'CLOSED') {
            connected.delete(visibleSpace.id); subscribed = false; readLoop.pause();
            requestGuard.current.invalidate(); canonical.current = null;
            setSyncError('日程实时同步暂不可用，请重试。'); setStatus('error'); settle(false);
          }
        });
      channels.push(channel);
    }
    if (!spaces.length) {
      setPresentation(undefined); current.current.options.onInvalidate?.();
      setError('未找到可用空间，请重试。'); setStatus('error'); settle(false);
    }
    return () => {
      active = false; reload.current = () => undefined; readLoop.stop();
      requestGuard.current.invalidate(); canonical.current = null; settle(false);
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [scopeKey, retry]);

  // Mounted canonical reads cover all sources and exceptions. Browsing another
  // range can reuse that fresh read; a restored display cannot derive a range.
  useEffect(() => {
    if (!canonical.current?.isCurrent()) return;
    try { publish(canonical.current.data); }
    catch (cause) { canonical.current = null; setError(errorText(cause)); setStatus('error'); settle(false); }
  }, [viewKey]);

  async function qualify(row: CalendarEventPresentation) {
    const generation = scopeRevision.current.generation;
    if (!canonical.current?.isCurrent()) {
      if (!pending.current || !await new Promise<boolean>((resolve) => waiters.current.add(resolve))) return null;
    }
    const fresh = canonical.current;
    if (generation !== scopeRevision.current.generation || !fresh?.isCurrent()) return null;
    const context = current.current;
    const expansion = expandRecurringEvents(fresh.data.events, calendarVisibleRange(context.view, context.selectedDate), fresh.data.exceptions);
    const occurrence = expansion.errors.length ? undefined : expansion.occurrences.find((item) => sameCalendarEventOccurrence(row, item));
    return occurrence ? { occurrence, isCurrent: fresh.isCurrent } : null;
  }
  return {
    presentation: authLost ? undefined : validCalendarEventsSnapshot(presentation, scopeKey, viewKey),
    status, error, syncError, authLost, qualify,
    isFresh: () => Boolean(canonical.current?.isCurrent()),
    membersBySpaceId: authLost ? {} : validCalendarEventsSnapshot(presentation, scopeKey, viewKey)?.membersBySpaceId ?? {},
    refresh: () => reload.current(), retry: () => setRetry((value) => value + 1),
  };
}
