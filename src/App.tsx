import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  eventFallsOnDay,
  formatDay,
  formatMonth,
  formatTime,
  fromDateInputValue,
  isSameDay,
  sortEvents,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateInputValue,
} from './lib/date';
import type { CalendarEvent, EventAudience, Space, SpaceMember } from './types';

type ViewMode = 'today' | 'week' | 'month';
type EventDraft = {
  title: string;
  description: string;
  audience: EventAudience;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

const viewLabels: Record<ViewMode, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
};

const emptyDraft = (date = new Date()): EventDraft => ({
  title: '',
  description: '',
  audience: 'mine',
  startsAt: toDateInputValue(date),
  endsAt: '',
  allDay: false,
});

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '操作失败，请稍后再试。';
}

function audienceFromEvent(event: CalendarEvent, userId: string): EventAudience {
  if (event.scope === 'shared') {
    return 'shared';
  }

  return event.owner_user_id === userId ? 'mine' : 'partner';
}

function audienceLabel(audience: EventAudience) {
  return audience === 'mine' ? '我的' : audience === 'partner' ? '对方的' : '共同的';
}

function audienceClass(audience: EventAudience) {
  if (audience === 'mine') {
    return 'border-l-teal bg-teal/10 text-teal';
  }

  if (audience === 'partner') {
    return 'border-l-coral bg-coral/10 text-coral';
  }

  return 'border-l-amber bg-amber/10 text-amber';
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return <ConfigMissing />;
  }

  if (loadingSession) {
    return <FullScreenMessage title="正在载入" body="正在恢复登录状态。" />;
  }

  if (!session) {
    return <AuthPage />;
  }

  return <CalendarApp session={session} />;
}

function ConfigMissing() {
  return (
    <FullScreenMessage
      title="需要配置 Supabase"
      body="请复制 .env.example 为 .env，并填入 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY。"
    />
  );
}

function FullScreenMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-mist px-5">
      <section className="w-full max-w-sm rounded-lg bg-white p-6 shadow-soft">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-ink/70">{body}</p>
      </section>
    </main>
  );
}

function AuthPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    setBusy(false);
    setStatus(error ? error.message : '登录链接已发送，请在手机或电脑邮箱中打开。');
  }

  return (
    <main className="min-h-screen bg-mist px-5 py-10">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-teal text-white">
            <CalendarDays size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-ink">共享日历</h1>
            <p className="text-sm text-ink/60">两个人的小日程本</p>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-lg bg-white p-5 shadow-soft">
          <label className="text-sm font-semibold text-ink" htmlFor="email">
            邮箱
          </label>
          <input
            id="email"
            className="mt-2 w-full rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <button
            className="mt-4 h-12 w-full rounded-lg bg-teal font-semibold text-white disabled:opacity-60"
            type="submit"
            disabled={busy}
          >
            {busy ? '发送中' : '发送 Magic Link'}
          </button>
          {status && <p className="mt-4 text-sm leading-6 text-ink/70">{status}</p>}
        </form>
      </section>
    </main>
  );
}

function CalendarApp({ session }: { session: Session }) {
  const userId = session.user.id;
  const [space, setSpace] = useState<Space | null>(null);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);

  const partner = members.find((member) => member.user_id !== userId) ?? null;

  async function loadSpace() {
    setLoading(true);
    setError('');

    const { data, error: loadError } = await supabase
      .from('spaces')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (loadError) {
      setError(loadError.message);
    }

    setSpace(data);
    setLoading(false);
  }

  async function loadMembers(spaceId: string) {
    const { data, error: memberError } = await supabase
      .from('space_members')
      .select('space_id,user_id,role,joined_at,profiles(display_name)')
      .eq('space_id', spaceId)
      .order('joined_at', { ascending: true });

    if (memberError) {
      setError(memberError.message);
      return;
    }

    setMembers(
      ((data ?? []) as Array<Omit<SpaceMember, 'profiles'> & { profiles?: { display_name: string | null }[] | { display_name: string | null } | null }>).map(
        (member) => ({
          ...member,
          profiles: Array.isArray(member.profiles) ? member.profiles[0] ?? null : member.profiles ?? null,
        }),
      ),
    );
  }

  async function loadEvents(spaceId: string) {
    const { data, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('space_id', spaceId)
      .order('starts_at', { ascending: true });

    if (eventError) {
      setError(eventError.message);
      return;
    }

    setEvents((data ?? []) as CalendarEvent[]);
  }

  useEffect(() => {
    void loadSpace();
  }, []);

  useEffect(() => {
    if (!space) {
      setMembers([]);
      setEvents([]);
      return;
    }

    void loadMembers(space.id);
    void loadEvents(space.id);

    const channel = supabase
      .channel(`events:${space.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `space_id=eq.${space.id}` },
        () => void loadEvents(space.id),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [space?.id]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return <FullScreenMessage title="正在载入" body="正在读取你的共享空间。" />;
  }

  if (!space) {
    return <OnboardingPage onReady={loadSpace} />;
  }

  return (
    <main className="min-h-screen bg-mist text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
        <header className="sticky top-0 z-10 border-b border-ink/10 bg-mist/95 px-4 pb-3 pt-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-ink/60">{space.name}</p>
              <h1 className="text-2xl font-bold">{formatMonth(selectedDate)}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="grid h-10 w-10 place-items-center rounded-lg bg-white text-ink shadow-sm" type="button" onClick={signOut} aria-label="退出登录">
                <LogOut size={18} />
              </button>
              <button className="grid h-10 w-10 place-items-center rounded-lg bg-teal text-white shadow-sm" type="button" onClick={() => setShowNewEvent(true)} aria-label="新建日程">
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-white p-1 shadow-sm">
            {(Object.keys(viewLabels) as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`h-10 rounded-md text-sm font-semibold ${viewMode === mode ? 'bg-teal text-white' : 'text-ink/70'}`}
                onClick={() => setViewMode(mode)}
              >
                {viewLabels[mode]}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button className="grid h-10 w-10 place-items-center rounded-lg bg-white" type="button" onClick={() => setSelectedDate(addDays(selectedDate, viewMode === 'month' ? -30 : -7))} aria-label="上一段">
              <ChevronLeft size={18} />
            </button>
            <button className="h-10 rounded-lg bg-white px-4 text-sm font-semibold" type="button" onClick={() => setSelectedDate(new Date())}>
              回到今天
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-lg bg-white" type="button" onClick={() => setSelectedDate(addDays(selectedDate, viewMode === 'month' ? 30 : 7))} aria-label="下一段">
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        <section className="flex-1 px-4 py-4 safe-bottom">
          {error && <Notice tone="error" message={error} />}
          <InvitePanel space={space} onSpaceChange={setSpace} />
          <CalendarViews
            events={events}
            selectedDate={selectedDate}
            viewMode={viewMode}
            userId={userId}
            onEdit={setEditingEvent}
            onSelectDate={setSelectedDate}
          />
        </section>
      </div>

      {(showNewEvent || editingEvent) && (
        <EventSheet
          event={editingEvent}
          space={space}
          userId={userId}
          partnerId={partner?.user_id ?? null}
          onClose={() => {
            setShowNewEvent(false);
            setEditingEvent(null);
          }}
          onSaved={() => void loadEvents(space.id)}
        />
      )}
    </main>
  );
}

function Notice({ tone, message }: { tone: 'error' | 'success'; message: string }) {
  return (
    <p className={`mb-4 rounded-lg px-4 py-3 text-sm ${tone === 'error' ? 'bg-coral/10 text-coral' : 'bg-teal/10 text-teal'}`}>
      {message}
    </p>
  );
}

function OnboardingPage({ onReady }: { onReady: () => Promise<void> }) {
  const [spaceName, setSpaceName] = useState('我们的日历');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function createSpace(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    const { error } = await supabase.rpc('create_space_with_invite', { space_name: spaceName });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await onReady();
  }

  async function joinSpace(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    const { error } = await supabase.rpc('join_space_by_invite_code', { code: inviteCode.trim().toUpperCase() });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await onReady();
  }

  return (
    <main className="min-h-screen bg-mist px-5 py-8">
      <section className="mx-auto max-w-md">
        <h1 className="text-3xl font-bold text-ink">开始共享</h1>
        <p className="mt-2 text-sm leading-6 text-ink/65">创建一个两人空间，或输入对方给你的邀请码加入。</p>

        {message && <div className="mt-5"><Notice tone="error" message={message} /></div>}

        <form onSubmit={createSpace} className="mt-6 rounded-lg bg-white p-5 shadow-soft">
          <h2 className="text-lg font-bold">创建共享空间</h2>
          <input
            className="mt-4 w-full rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal"
            value={spaceName}
            onChange={(event) => setSpaceName(event.target.value)}
            required
          />
          <button className="mt-4 h-12 w-full rounded-lg bg-teal font-semibold text-white disabled:opacity-60" type="submit" disabled={busy}>
            创建空间
          </button>
        </form>

        <form onSubmit={joinSpace} className="mt-4 rounded-lg bg-white p-5 shadow-soft">
          <h2 className="text-lg font-bold">加入空间</h2>
          <input
            className="mt-4 w-full rounded-lg border border-ink/15 px-4 py-3 uppercase tracking-wide outline-none focus:border-teal"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="输入邀请码"
            required
          />
          <button className="mt-4 h-12 w-full rounded-lg bg-ink font-semibold text-white disabled:opacity-60" type="submit" disabled={busy}>
            加入空间
          </button>
        </form>
      </section>
    </main>
  );
}

function InvitePanel({ space, onSpaceChange }: { space: Space; onSpaceChange: (space: Space) => void }) {
  const [message, setMessage] = useState('');

  async function copyCode() {
    await navigator.clipboard.writeText(space.invite_code);
    setMessage('邀请码已复制。');
  }

  async function rotateCode() {
    setMessage('');
    const { data, error } = await supabase.rpc('rotate_invite_code', { space_id: space.id });

    if (error) {
      setMessage(error.message);
      return;
    }

    onSpaceChange(data as Space);
    setMessage('已生成新邀请码，旧码已失效。');
  }

  return (
    <section className="mb-4 rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-ink/45">邀请码</p>
          <p className="mt-1 text-2xl font-bold tracking-widest text-ink">{space.invite_code}</p>
        </div>
        <div className="flex gap-2">
          <button className="grid h-10 w-10 place-items-center rounded-lg bg-mist" type="button" onClick={copyCode} aria-label="复制邀请码">
            <Copy size={18} />
          </button>
          <button className="grid h-10 w-10 place-items-center rounded-lg bg-mist" type="button" onClick={rotateCode} aria-label="轮换邀请码">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>
      {message && <p className="mt-2 text-sm text-ink/60">{message}</p>}
    </section>
  );
}

function CalendarViews({
  events,
  selectedDate,
  viewMode,
  userId,
  onEdit,
  onSelectDate,
}: {
  events: CalendarEvent[];
  selectedDate: Date;
  viewMode: ViewMode;
  userId: string;
  onEdit: (event: CalendarEvent) => void;
  onSelectDate: (date: Date) => void;
}) {
  if (viewMode === 'month') {
    return <MonthView events={events} selectedDate={selectedDate} userId={userId} onEdit={onEdit} onSelectDate={onSelectDate} />;
  }

  const days = viewMode === 'today' ? [selectedDate] : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDate), index));

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const dayEvents = sortEvents(events.filter((event) => eventFallsOnDay(event, day)));
        return (
          <DaySection key={day.toISOString()} day={day} events={dayEvents} userId={userId} onEdit={onEdit} />
        );
      })}
    </div>
  );
}

function MonthView({
  events,
  selectedDate,
  userId,
  onEdit,
  onSelectDate,
}: {
  events: CalendarEvent[];
  selectedDate: Date;
  userId: string;
  onEdit: (event: CalendarEvent) => void;
  onSelectDate: (date: Date) => void;
}) {
  const monthStart = startOfMonth(selectedDate);
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const selectedEvents = sortEvents(events.filter((event) => eventFallsOnDay(event, selectedDate)));

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-white p-3 shadow-sm">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink/45">
          {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {cells.map((day) => {
            const dayEvents = events.filter((event) => eventFallsOnDay(event, day));
            const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
            const isSelected = isSameDay(day, selectedDate);
            return (
              <button
                key={day.toISOString()}
                type="button"
                className={`aspect-square rounded-lg text-sm ${isSelected ? 'bg-teal text-white' : isCurrentMonth ? 'bg-mist text-ink' : 'bg-transparent text-ink/30'}`}
                onClick={() => onSelectDate(day)}
              >
                <span>{day.getDate()}</span>
                {dayEvents.length > 0 && <span className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-coral'}`} />}
              </button>
            );
          })}
        </div>
      </section>
      <DaySection day={selectedDate} events={selectedEvents} userId={userId} onEdit={onEdit} />
    </div>
  );
}

function DaySection({ day, events, userId, onEdit }: { day: Date; events: CalendarEvent[]; userId: string; onEdit: (event: CalendarEvent) => void }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-ink/60">{formatDay(day)}</h2>
      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 bg-white px-4 py-6 text-center text-sm text-ink/45">这天还没有日程</div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} userId={userId} onEdit={() => onEdit(event)} />
          ))}
        </div>
      )}
    </section>
  );
}

function EventCard({ event, userId, onEdit }: { event: CalendarEvent; userId: string; onEdit: () => void }) {
  const audience = audienceFromEvent(event, userId);

  return (
    <button type="button" className={`w-full rounded-lg border-l-4 bg-white p-4 text-left shadow-sm ${audienceClass(audience)}`} onClick={onEdit}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{event.title}</p>
          {event.description && <p className="mt-1 line-clamp-2 text-sm text-ink/55">{event.description}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-current/10 px-2 py-1 text-xs font-semibold">{audienceLabel(audience)}</span>
      </div>
      <p className="mt-3 text-sm text-ink/55">
        {formatTime(event.starts_at, event.all_day)}
        {event.ends_at && !event.all_day ? ` - ${formatTime(event.ends_at, false)}` : ''}
      </p>
    </button>
  );
}

function EventSheet({
  event,
  space,
  userId,
  partnerId,
  onClose,
  onSaved,
}: {
  event: CalendarEvent | null;
  space: Space;
  userId: string;
  partnerId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<EventDraft>(() => {
    if (!event) {
      return emptyDraft();
    }

    return {
      title: event.title,
      description: event.description ?? '',
      audience: audienceFromEvent(event, userId),
      startsAt: toDateInputValue(new Date(event.starts_at)),
      endsAt: event.ends_at ? toDateInputValue(new Date(event.ends_at)) : '',
      allDay: event.all_day,
    };
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canChoosePartner = Boolean(partnerId);

  async function save(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError('');

    const ownerUserId = draft.audience === 'shared' ? null : draft.audience === 'mine' ? userId : partnerId;

    if (draft.audience === 'partner' && !partnerId) {
      setBusy(false);
      setError('对方加入空间后，才能创建对方的个人日程。');
      return;
    }

    const payload = {
      space_id: space.id,
      scope: draft.audience === 'shared' ? 'shared' : 'personal',
      owner_user_id: ownerUserId,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      starts_at: fromDateInputValue(draft.startsAt),
      ends_at: draft.endsAt ? fromDateInputValue(draft.endsAt) : null,
      all_day: draft.allDay,
    };

    const result = event
      ? await supabase.from('events').update(payload).eq('id', event.id)
      : await supabase.from('events').insert(payload);

    setBusy(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    onSaved();
    onClose();
  }

  async function deleteEvent() {
    if (!event) {
      return;
    }

    setBusy(true);
    const { error: deleteError } = await supabase.from('events').delete().eq('id', event.id);
    setBusy(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 bg-ink/35">
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[92vh] max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-soft safe-bottom">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{event ? '编辑日程' : '新建日程'}</h2>
          <button className="grid h-10 w-10 place-items-center rounded-lg bg-mist" type="button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        {error && <div className="mt-4"><Notice tone="error" message={error} /></div>}

        <form className="mt-5 space-y-4" onSubmit={save}>
          <Field label="标题">
            <input className="w-full rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal" required value={draft.title} onChange={(inputEvent) => setDraft({ ...draft, title: inputEvent.target.value })} />
          </Field>

          <Field label="归属">
            <div className="grid grid-cols-3 gap-2">
              {(['mine', 'partner', 'shared'] as EventAudience[]).map((audience) => (
                <button
                  key={audience}
                  type="button"
                  disabled={audience === 'partner' && !canChoosePartner}
                  className={`h-11 rounded-lg text-sm font-semibold disabled:opacity-40 ${draft.audience === audience ? 'bg-teal text-white' : 'bg-mist text-ink/70'}`}
                  onClick={() => setDraft({ ...draft, audience })}
                >
                  {audienceLabel(audience)}
                </button>
              ))}
            </div>
          </Field>

          <Field label="开始时间">
            <input className="w-full rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal" type="datetime-local" required value={draft.startsAt} onChange={(inputEvent) => setDraft({ ...draft, startsAt: inputEvent.target.value })} />
          </Field>

          <Field label="结束时间">
            <input className="w-full rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal" type="datetime-local" value={draft.endsAt} onChange={(inputEvent) => setDraft({ ...draft, endsAt: inputEvent.target.value })} />
          </Field>

          <label className="flex items-center gap-3 rounded-lg bg-mist px-4 py-3 text-sm font-semibold">
            <input type="checkbox" checked={draft.allDay} onChange={(inputEvent) => setDraft({ ...draft, allDay: inputEvent.target.checked })} />
            全天
          </label>

          <Field label="描述">
            <textarea className="min-h-24 w-full resize-none rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal" value={draft.description} onChange={(inputEvent) => setDraft({ ...draft, description: inputEvent.target.value })} />
          </Field>

          <div className="flex gap-3 pt-2">
            {event && (
              <button className="grid h-12 w-12 place-items-center rounded-lg bg-coral/10 text-coral" type="button" onClick={deleteEvent} disabled={busy} aria-label="删除日程">
                <Trash2 size={20} />
              </button>
            )}
            <button className="h-12 flex-1 rounded-lg bg-teal font-semibold text-white disabled:opacity-60" type="submit" disabled={busy}>
              {busy ? '保存中' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-ink/70">{label}</span>
      {children}
    </label>
  );
}
