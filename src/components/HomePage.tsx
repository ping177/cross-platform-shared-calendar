import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Circle, Plus } from 'lucide-react';
import type { EventSheetProps } from '../App';
import { type CreateKind, type CreateTargetControl, type CreateTargetState } from './GlobalCreateControls';
import { createCalendarReadLoop } from '../lib/calendar-refresh';
import { listCurrentSpaces } from '../lib/current-spaces';
import { formatDay, formatTime } from '../lib/date';
import { eventEditTargetForEvent, eventEditTargetForOccurrence } from '../lib/event-edit-target';
import { homeEventRange, readHomeEvents, readHomeModules, readHomeTasks, type HomeEventQuery, type HomeModuleRow } from '../lib/home-aggregation';
import { memberDisplayNameForUser } from '../lib/member';
import { availableTaskTargets, homeCreateEntry, targetMembersValid } from '../lib/global-create';
import { supabase } from '../lib/supabase';
import { canChangeTaskStatus, formatTaskDueDate, taskAssignmentLabel, taskErrorMessage, taskRealtimeConfig } from '../lib/task';
import type { CalendarEvent, CalendarOccurrence, CalendarOccurrenceRange, CurrentSpace, EventOccurrenceException, SpaceMember, Task } from '../types';
import { TaskSheet } from './TaskSheet';

type SectionState<T> = { status: 'loading' | 'success' | 'error'; items: T[]; membersBySpaceId: Record<string, SpaceMember[]>; error: string };
const loadingState = <T,>(): SectionState<T> => ({ status: 'loading', items: [], membersBySpaceId: {}, error: '' });
const errorText = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

async function moduleSpaces(spaces: CurrentSpace[]) {
  return readHomeModules(spaces, async (start, end) => {
    const result = await supabase.from('space_modules').select('space_id,enabled', { count: 'exact' })
      .in('space_id', spaces.map((space) => space.id)).eq('module_key', 'tasks').order('space_id').range(start, end);
    return { data: result.data as HomeModuleRow[] | null, count: result.count, error: result.error };
  });
}

async function spaceMembers(spaceId: string): Promise<SpaceMember[]> {
  const { data, error } = await supabase.from('space_members')
    .select('space_id,user_id,role,joined_at,profiles(display_name)')
    .eq('space_id', spaceId).order('joined_at').order('user_id');
  if (error) throw error;
  return ((data ?? []) as Array<Omit<SpaceMember, 'profiles'> & { profiles?: { display_name: string | null }[] | { display_name: string | null } | null }>).map(
    (member) => ({ ...member, profiles: Array.isArray(member.profiles) ? member.profiles[0] ?? null : member.profiles ?? null }),
  );
}

async function eventData(spaces: CurrentSpace[], range: CalendarOccurrenceRange) {
  return readHomeEvents(spaces, range, {
    eventPage: async (spaceId, kind: HomeEventQuery, start, end, window) => {
      let query = supabase.from('events').select('*', { count: 'exact' }).eq('space_id', spaceId);
      query = kind === 'recurring' ? query.not('recurrence_rule', 'is', null) : query.is('recurrence_rule', null);
      if (kind === 'starting') query = query.gte('starts_at', window.start.toISOString()).lte('starts_at', window.end.toISOString());
      if (kind === 'overlap') query = query.lt('starts_at', window.start.toISOString()).gte('ends_at', window.start.toISOString());
      const result = await query.order('id').range(start, end);
      return { data: result.data as CalendarEvent[] | null, count: result.count, error: result.error };
    },
    exceptionPage: async (eventIds, start, end) => {
      const result = await supabase.from('event_occurrence_exceptions').select('*', { count: 'exact' })
        .in('event_id', eventIds).order('event_id').order('occurrence_date').order('id').range(start, end);
      return { data: result.data as EventOccurrenceException[] | null, count: result.count, error: result.error };
    },
    members: spaceMembers,
  });
}

async function taskData(spaces: CurrentSpace[], userId: string, today: Date) {
  return readHomeTasks(spaces, userId, today, {
    modulePage: async (start, end) => {
      const result = await supabase.from('space_modules').select('space_id,enabled', { count: 'exact' })
        .in('space_id', spaces.map((space) => space.id)).eq('module_key', 'tasks').order('space_id').range(start, end);
      return { data: result.data as HomeModuleRow[] | null, count: result.count, error: result.error };
    },
    taskPage: async (spaceId, start, end) => {
      const result = await supabase.from('tasks').select('*', { count: 'exact' })
        .eq('space_id', spaceId).eq('status', 'open').order('id').range(start, end);
      return { data: result.data as Task[] | null, count: result.count, error: result.error };
    },
    members: spaceMembers,
  });
}

export function HomeSection({ title, status, error, items, expanded, empty, onToggle, onRetry, createAction, createFeedback }: {
  title: string; status: SectionState<unknown>['status']; error: string; items: ReactNode[]; expanded: boolean; empty: string;
  onToggle: () => void; onRetry: () => void; createAction?: ReactNode; createFeedback?: ReactNode;
}) {
  return <section className="space-y-3" aria-label={title}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="min-w-0 break-words text-lg font-bold">{title}</h2>
      {createAction}
    </div>
    {createFeedback}
    {status === 'loading' && <p className="rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm" role="status">正在读取…</p>}
    {status === 'error' && <div className="rounded-lg bg-white px-4 py-5 shadow-sm" role="alert"><p className="text-sm text-coral">{error || `${title}加载失败，请重试。`}</p><button className="mt-2 min-h-11 font-semibold text-teal" type="button" onClick={onRetry}>重试</button></div>}
    {status === 'success' && (items.length ? <>
      <ul className="space-y-2">{(expanded ? items : items.slice(0, 5)).map((item, index) => <li key={index}>{item}</li>)}</ul>
      {items.length > 5 && <button className="min-h-11 font-semibold text-teal" type="button" onClick={onToggle}>{expanded ? '收起' : '展开更多'}</button>}
    </> : <p className="rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm">{empty}</p>)}
  </section>;
}

export function HomePage({ spaces, userId, EventSheetComponent, onMembershipRefresh }: {
  spaces: CurrentSpace[]; userId: string; EventSheetComponent: ComponentType<EventSheetProps>; onMembershipRefresh: () => Promise<void>;
}) {
  const [eventState, setEventState] = useState<SectionState<CalendarOccurrence>>(loadingState);
  const [taskState, setTaskState] = useState<SectionState<Task>>(loadingState);
  const [eventExpanded, setEventExpanded] = useState(false);
  const [taskExpanded, setTaskExpanded] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarOccurrence | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingTaskMembers, setEditingTaskMembers] = useState<SpaceMember[]>([]);
  const [openingTask, setOpeningTask] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [eventRevision, setEventRevision] = useState(0);
  const [taskRevision, setTaskRevision] = useState(0);
  const [dayRevision, setDayRevision] = useState(0);
  const [openingCreateKind, setOpeningCreateKind] = useState<CreateKind | null>(null);
  const [createEntryError, setCreateEntryError] = useState<{ kind: CreateKind; message: string } | null>(null);
  const [choosingSpaceKind, setChoosingSpaceKind] = useState<CreateKind | null>(null);
  const [createSpaces, setCreateSpaces] = useState<CurrentSpace[]>([]);
  const [enabledTaskIds, setEnabledTaskIds] = useState<string[]>([]);
  const [createKind, setCreateKind] = useState<CreateKind | null>(null);
  const [createTargetId, setCreateTargetId] = useState('');
  const [createSpace, setCreateSpace] = useState<CurrentSpace | null>(null);
  const [createMembers, setCreateMembers] = useState<SpaceMember[]>([]);
  const [createTargetState, setCreateTargetState] = useState<CreateTargetState>('loading');
  const [createTargetError, setCreateTargetError] = useState('');
  const eventRefresh = useRef<() => void>(() => undefined);
  const taskRefresh = useRef<() => void>(() => undefined);
  const openingGeneration = useRef(0);
  const membershipRefresh = useRef(onMembershipRefresh);
  const createGeneration = useRef(0);
  const targetIdRef = useRef('');
  const eventCreateButton = useRef<HTMLButtonElement>(null);
  const taskCreateButton = useRef<HTMLButtonElement>(null);
  membershipRefresh.current = onMembershipRefresh;
  const spaceIds = spaces.map((space) => space.id).join(',');

  useEffect(() => {
    const focus = () => { void membershipRefresh.current(); };
    window.addEventListener('focus', focus);
    return () => { window.removeEventListener('focus', focus); openingGeneration.current += 1; createGeneration.current += 1; };
  }, []);

  async function currentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId) throw new Error('登录状态已变化，请重新打开创建表单。');
  }

  async function beginCreate(kind: CreateKind) {
    const generation = ++createGeneration.current;
    setOpeningCreateKind(kind);
    setCreateEntryError(null);
    setChoosingSpaceKind(null);
    setCreateSpaces([]);
    setEnabledTaskIds([]);
    try {
      await currentUser();
      const listed = await listCurrentSpaces(userId);
      const enabled = kind === 'task' ? await moduleSpaces(listed).catch(() => { throw new Error('任务模块状态无法确认，请重试。'); }) : [];
      await currentUser();
      if (generation !== createGeneration.current) return;
      setCreateSpaces(listed);
      setEnabledTaskIds(enabled.map((space) => space.id));
      const entry = homeCreateEntry(kind, listed, userId, enabled.map((space) => space.id));
      if (entry.state === 'open') startCreate(kind, entry.targetId, listed);
      else if (entry.state === 'choose') setChoosingSpaceKind(kind);
      else setCreateEntryError({ kind, message: kind === 'task' ? '没有已启用任务的空间，暂时无法创建任务。' : '没有可用空间，暂时无法创建日程。' });
    } catch (error) {
      if (generation === createGeneration.current) {
        const message = errorText(error, '无法确认可用空间，请重试。');
        setCreateEntryError({ kind, message: /[\u3400-\u9fff]/.test(message) ? message : '无法确认可用空间，请重试。' });
      }
    } finally {
      if (generation === createGeneration.current) setOpeningCreateKind(null);
    }
  }

  async function loadTarget(kind: CreateKind, targetId: string) {
    const generation = ++createGeneration.current;
    setCreateTargetState('loading');
    setCreateTargetError('');
    try {
      await currentUser();
      const listed = await listCurrentSpaces(userId);
      const target = listed.find((space) => space.id === targetId);
      if (!target) throw new Error('此空间已不在你的成员列表中，请重新选择。');
      const enabled = kind === 'task' ? await moduleSpaces(listed).catch(() => { throw new Error('任务模块状态无法确认，请重试。'); }) : [];
      const members = await spaceMembers(targetId);
      if (!targetMembersValid(members, targetId, userId)) throw new Error('空间成员资料已变化，请重试。');
      await currentUser();
      if (generation !== createGeneration.current || targetIdRef.current !== targetId) return;
      setCreateSpaces(listed);
      if (kind === 'task') setEnabledTaskIds(enabled.map((space) => space.id));
      setCreateSpace(target);
      setCreateMembers(members);
      setCreateTargetState(kind === 'task' && !enabled.some((space) => space.id === targetId) ? 'blocked' : 'ready');
    } catch (error) {
      if (generation === createGeneration.current) {
        setCreateTargetState('error');
        const message = errorText(error, '无法确认目标空间，请重试。');
        setCreateTargetError(/[\u3400-\u9fff]/.test(message) ? message : '无法确认目标空间，请重试。');
      }
    }
  }

  function startCreate(kind: CreateKind, targetId: string, listed: CurrentSpace[]) {
    setOpeningCreateKind(null);
    setChoosingSpaceKind(null);
    targetIdRef.current = targetId;
    setCreateKind(kind);
    setCreateTargetId(targetId);
    setCreateSpace(listed.find((space) => space.id === targetId) ?? null);
    setCreateMembers([]);
    void loadTarget(kind, targetId);
  }

  function selectCreateTarget(targetId: string) {
    if (!createKind || !createSpaces.some((space) => space.id === targetId)) return;
    targetIdRef.current = targetId;
    setCreateTargetId(targetId);
    void loadTarget(createKind, targetId);
  }

  function closeCreate() {
    const closingKind = createKind;
    createGeneration.current += 1;
    targetIdRef.current = '';
    setCreateKind(null);
    setCreateTargetId('');
    setCreateSpace(null);
    setCreateMembers([]);
    (closingKind === 'event' ? eventCreateButton : taskCreateButton).current?.focus();
  }

  function sectionCreateFeedback(kind: CreateKind) {
    const choices = kind === 'task' ? availableTaskTargets(createSpaces, enabledTaskIds) : createSpaces;
    return <>
      {openingCreateKind === kind && <p className="text-sm text-ink/60" role="status">正在确认可用空间…</p>}
      {createEntryError?.kind === kind && <p className="text-sm text-coral" role="alert">{createEntryError.message}<button className="ml-3 min-h-11 font-semibold underline" type="button" onClick={() => void beginCreate(kind)}>重试</button></p>}
      {choosingSpaceKind === kind && <div className="rounded-lg bg-white p-3 text-sm shadow-sm" role="group" aria-label="选择保存空间">
        <p className="text-ink/70">我的空间暂不可用，请主动选择保存空间。</p>
        {choices.map((space) => <button key={space.id} className="mt-2 block min-h-11 w-full rounded-lg px-3 text-left font-semibold text-teal hover:bg-mist" type="button" onClick={() => startCreate(kind, space.id, createSpaces)}>{space.name}</button>)}
      </div>}
    </>;
  }

  async function validateCreateTarget(kind: CreateKind, targetId: string, relatedUserId?: string | null) {
    const generation = createGeneration.current;
    if (createTargetState !== 'ready' || targetIdRef.current !== targetId) throw new Error('请先确认保存空间。');
    await currentUser();
    const listed = await listCurrentSpaces(userId);
    const target = listed.find((space) => space.id === targetId);
    if (!target || target.kind !== createSpace?.kind) throw new Error('此空间已不在你的成员列表中，请重新选择。');
    if (kind === 'task') {
      const enabled = await moduleSpaces([target]).catch(() => { throw new Error('任务模块状态无法确认，请重试。'); });
      if (!enabled.length) throw new Error('当前空间的任务模块已关闭，请选择其他空间。');
    }
    const members = await spaceMembers(targetId);
    if (!targetMembersValid(members, targetId, userId, relatedUserId)) throw new Error('空间成员或分配对象已变化，请重新选择。');
    await currentUser();
    if (generation !== createGeneration.current || targetIdRef.current !== targetId) throw new Error('保存空间已变化，请重新确认。');
  }

  const createTargetControl: CreateTargetControl = {
    spaces: createSpaces, selectedId: createTargetId, enabledIds: enabledTaskIds,
    state: createTargetState, error: createTargetError,
    onSelect: selectCreateTarget, onRetry: () => { if (createKind && createTargetId) void loadTarget(createKind, createTargetId); },
  };

  useEffect(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(() => setDayRevision((value) => value + 1), next.getTime() - now.getTime() + 20);
    return () => clearTimeout(timer);
  }, [dayRevision]);

  useEffect(() => {
    let active = true;
    const connected = new Set<string>();
    let ready = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];
    setEventState(loadingState());
    const loop = createCalendarReadLoop(async (isCurrent) => {
      setEventState(loadingState());
      const loaded = await eventData(spaces, homeEventRange(new Date()));
      if (isCurrent()) setEventState({ status: 'success', items: loaded.occurrences, membersBySpaceId: loaded.membersBySpaceId, error: '' });
    }, (error) => { setEditingEvent(null); setEventState({ ...loadingState(), status: 'error', error: errorText(error, '近期日程加载失败，请重试。') }); });
    function refresh() {
      if (!active) return;
      setEditingEvent(null);
      setEventState(loadingState());
      loop.change();
    }
    eventRefresh.current = refresh;
    for (const space of spaces) {
      const channel = supabase.channel(`home-events:${space.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `space_id=eq.${space.id}` }, refresh)
        .subscribe((status) => {
          if (!active) return;
          if (status === 'SUBSCRIBED') {
            const wasConnected = connected.has(space.id);
            connected.add(space.id);
            if (connected.size === spaces.length && !ready) { ready = true; loop.start(); }
            else if (!wasConnected && ready) refresh();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            connected.delete(space.id);
            ready = false;
            loop.pause();
            setEditingEvent(null);
            setEventState({ ...loadingState(), status: 'error', error: '日程实时同步暂不可用，请重试。' });
          }
        });
      channels.push(channel);
    }
    if (!spaces.length) loop.start();
    return () => { active = false; loop.stop(); eventRefresh.current = () => undefined; for (const channel of channels) void supabase.removeChannel(channel); };
  }, [spaceIds, eventRevision, dayRevision]);

  useEffect(() => {
    let active = true;
    let loop: ReturnType<typeof createCalendarReadLoop> | null = null;
    const channels: ReturnType<typeof supabase.channel>[] = [];
    const connected = new Set<string>();
    setTaskState(loadingState());
    async function setup() {
      try {
        const enabled = await moduleSpaces(spaces);
        if (!active) return;
        const enabledIds = enabled.map((space) => space.id).join(',');
        loop = createCalendarReadLoop(async (isCurrent) => {
          setTaskState(loadingState());
          const loaded = await taskData(spaces, userId, new Date());
          if (!isCurrent()) return;
          if (loaded.enabledSpaceIds.join(',') !== enabledIds) { setEditingTask(null); setTaskRevision((value) => value + 1); return; }
          setTaskState({ status: 'success', items: loaded.tasks, membersBySpaceId: loaded.membersBySpaceId, error: '' });
          setEditingTask((current) => current && !loaded.tasks.some((task) => task.id === current.id && task.space_id === current.space_id) ? null : current);
        }, (error) => { openingGeneration.current += 1; setOpeningTask(false); setEditingTask(null); setTaskState({ ...loadingState(), status: 'error', error: errorText(error, '任务加载失败，请重试。') }); });
        function refresh() {
          if (!active) return;
          openingGeneration.current += 1;
          setOpeningTask(false);
          setEditingTask(null);
          setTaskState(loadingState());
          loop?.change();
        }
        taskRefresh.current = refresh;
        if (!enabled.length) { loop.start(); return; }
        let ready = false;
        for (const space of enabled) {
          const channel = supabase.channel(`home-tasks:${space.id}`)
            .on('postgres_changes', taskRealtimeConfig(space.id), refresh)
            .subscribe((status) => {
              if (!active) return;
              if (status === 'SUBSCRIBED') {
                const wasConnected = connected.has(space.id);
                connected.add(space.id);
                if (connected.size === enabled.length && !ready) { ready = true; loop?.start(); }
                else if (!wasConnected && ready) refresh();
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                connected.delete(space.id);
                ready = false;
                loop?.pause();
                openingGeneration.current += 1;
                setOpeningTask(false);
                setEditingTask(null);
                setTaskState({ ...loadingState(), status: 'error', error: '任务实时同步暂不可用，请重试。' });
              }
            });
          channels.push(channel);
        }
      } catch (error) {
        if (active) setTaskState({ ...loadingState(), status: 'error', error: errorText(error, '任务模块状态读取失败，请重试。') });
      }
    }
    void setup();
    return () => { active = false; loop?.stop(); taskRefresh.current = () => undefined; for (const channel of channels) void supabase.removeChannel(channel); };
  }, [spaceIds, userId, taskRevision, dayRevision]);

  async function openTask(task: Task) {
    const generation = ++openingGeneration.current;
    const space = spaces.find((item) => item.id === task.space_id);
    if (!space) return;
    setOpeningTask(true);
    try {
      const enabled = await moduleSpaces([space]);
      if (!enabled.length) { setEditingTask(null); setTaskRevision((value) => value + 1); return; }
      const { data, error } = await supabase.from('tasks').select('*').eq('space_id', space.id).eq('id', task.id).maybeSingle();
      if (error) throw error;
      const members = await spaceMembers(space.id);
      if (generation !== openingGeneration.current) return;
      const fresh = data as Task | null;
      if (!members.some((member) => member.user_id === userId && member.space_id === space.id)) throw new Error('此空间已不在你的成员列表中，请重试。');
      if (!fresh || fresh.status !== 'open' || (fresh.assigned_to_user_id !== null && fresh.assigned_to_user_id !== userId)) { taskRefresh.current(); return; }
      setEditingTaskMembers(members);
      setEditingTask(fresh);
    } catch (error) {
      if (generation === openingGeneration.current) setTaskState({ ...loadingState(), status: 'error', error: taskErrorMessage(error) });
    } finally { if (generation === openingGeneration.current) setOpeningTask(false); }
  }

  async function completeTask(task: Task) {
    if (!canChangeTaskStatus(task, userId) || busyTaskId !== null) return;
    setBusyTaskId(task.id);
    try {
      const { data, error } = await supabase.from('tasks').update({ status: 'completed' }).eq('space_id', task.space_id).eq('id', task.id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('任务已变化，请重试。');
      taskRefresh.current();
    } catch (error) {
      setTaskState({ ...loadingState(), status: 'error', error: taskErrorMessage(error) });
      setTaskRevision((value) => value + 1);
    } finally { setBusyTaskId(null); }
  }

  async function taskMutationError(task: Task) {
    const space = spaces.find((item) => item.id === task.space_id);
    if (!space) { setEditingTask(null); return true; }
    try {
      if (!(await moduleSpaces([space])).length) {
        setEditingTask(null);
        setTaskRevision((value) => value + 1);
        return true;
      }
    } catch (error) {
      setEditingTask(null);
      setTaskState({ ...loadingState(), status: 'error', error: errorText(error, '任务模块状态读取失败，请重试。') });
      return true;
    }
    return false;
  }

  const eventItems = eventState.items.map((occurrence) => {
    const event = occurrence.source_event;
    const space = spaces.find((item) => item.id === event.space_id);
    const members = eventState.membersBySpaceId[event.space_id] ?? [];
    return <button key={`${event.space_id}:${occurrence.occurrence_id}`} className="w-full rounded-lg bg-white p-4 text-left shadow-sm" type="button" onClick={() => setEditingEvent(occurrence)}>
      <span className="block break-words font-semibold">{occurrence.title}</span>
      <span className="mt-1 block text-sm text-ink/60">{formatDay(new Date(occurrence.occurrence_starts_at))} · {formatTime(occurrence.occurrence_starts_at, occurrence.all_day)}</span>
      <span className="mt-1 block text-sm text-teal">{space?.name} · {event.scope === 'shared' ? '共同' : memberDisplayNameForUser(members, event.owner_user_id)}</span>
    </button>;
  });
  const taskItems = taskState.items.map((task) => {
    const space = spaces.find((item) => item.id === task.space_id);
    const members = taskState.membersBySpaceId[task.space_id] ?? [];
    return <div key={`${task.space_id}:${task.id}`} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 shadow-sm">
      <button className="grid h-11 w-11 shrink-0 place-items-center text-teal disabled:opacity-50" type="button" disabled={busyTaskId !== null} onClick={() => void completeTask(task)} aria-label={`完成 ${task.title}`}><Circle size={23} /></button>
      <button className="min-h-11 min-w-0 flex-1 py-1 text-left disabled:opacity-50" type="button" disabled={openingTask} onClick={() => void openTask(task)}>
        <span className="block break-words font-semibold">{task.title}</span>
        <span className="mt-1 block text-sm text-ink/60">{space?.name}{space?.kind === 'shared' ? ` · ${taskAssignmentLabel(task.assigned_to_user_id, members, userId)}` : ''}{task.due_on ? ` · ${formatTaskDueDate(task.due_on)}` : ' · 无截止日期'}</span>
      </button>
    </div>;
  });
  const eventSpace = editingEvent ? spaces.find((space) => space.id === editingEvent.source_event.space_id) : null;
  const eventMembers = eventSpace ? eventState.membersBySpaceId[eventSpace.id] ?? [] : [];
  const taskSpace = editingTask ? spaces.find((space) => space.id === editingTask.space_id) : null;
  const taskMembers = taskSpace ? editingTaskMembers : [];

  return <main className="mx-auto min-h-screen max-w-3xl space-y-7 px-4 py-6 safe-bottom">
    <h1 className="text-2xl font-bold">首页</h1>
    <HomeSection title="近期日程" status={eventState.status} error={eventState.error} items={eventItems} expanded={eventExpanded} empty="未来三天暂无日程" onToggle={() => setEventExpanded((value) => !value)} onRetry={() => setEventRevision((value) => value + 1)}
      createAction={<button ref={eventCreateButton} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-teal hover:bg-white disabled:opacity-50" type="button" aria-label="新建日程" disabled={openingCreateKind !== null} onClick={() => void beginCreate('event')}><Plus size={21} aria-hidden="true" /></button>}
      createFeedback={sectionCreateFeedback('event')}
    />
    <HomeSection title="需要处理的任务" status={taskState.status} error={taskState.error} items={taskItems} expanded={taskExpanded} empty="暂无需要处理的任务" onToggle={() => setTaskExpanded((value) => !value)} onRetry={() => setTaskRevision((value) => value + 1)}
      createAction={<button ref={taskCreateButton} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-teal hover:bg-white disabled:opacity-50" type="button" aria-label="新建任务" disabled={openingCreateKind !== null} onClick={() => void beginCreate('task')}><Plus size={21} aria-hidden="true" /></button>}
      createFeedback={sectionCreateFeedback('task')}
    />
    {editingEvent && eventSpace && eventMembers.length > 0 && <EventSheetComponent
      target={editingEvent.source_event.recurrence_rule === null ? eventEditTargetForEvent(editingEvent.source_event) : eventEditTargetForOccurrence(editingEvent)}
      space={eventSpace} userId={userId} members={eventMembers} partnerId={eventMembers.find((member) => member.user_id !== userId)?.user_id ?? null}
      onClose={() => setEditingEvent(null)} onSaved={() => eventRefresh.current()} validateCreateTarget={async () => false}
      showSourceSpace sourceSpaceLabel={eventSpace.name}
    />}
    {editingTask && taskSpace && taskMembers.length > 0 && <TaskSheet
      key={`${taskSpace.id}:${editingTask.id}`} task={editingTask} spaceId={taskSpace.id} spaceKind={taskSpace.kind}
      userId={userId} members={taskMembers} sourceSpaceLabel={taskSpace.name}
      onClose={() => setEditingTask(null)} onSaved={async () => { taskRefresh.current(); }}
      onMutationError={() => taskMutationError(editingTask)}
    />}
    {createKind === 'event' && createSpace && <EventSheetComponent
      target={null} space={createSpace} userId={userId} members={createMembers}
      partnerId={createMembers.find((member) => member.user_id !== userId)?.user_id ?? null}
      onClose={closeCreate} onSaved={() => eventRefresh.current()}
      validateCreateTarget={async (ownerId) => { await validateCreateTarget('event', createSpace.id, ownerId); return true; }}
      createTarget={createTargetControl}
    />}
    {createKind === 'task' && createSpace && <TaskSheet
      task={null} spaceId={createSpace.id} spaceKind={createSpace.kind} userId={userId} members={createMembers}
      onClose={closeCreate} onSaved={async () => { taskRefresh.current(); }}
      createTarget={createTargetControl}
      validateGlobalCreate={(assigneeId) => validateCreateTarget('task', createSpace.id, assigneeId)}
    />}
  </main>;
}
