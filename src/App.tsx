import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '@supabase/supabase-js';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { MemberSheet } from './components/MemberSheet';
import { MyPage } from './components/MyPage';
import { RecurrenceControls } from './components/RecurrenceControls';
import { TasksArea, type TasksScreen } from './components/TasksArea';
import { calendarVisibleRange } from './lib/calendar-display';
import { calendarSpaces, readAggregateCalendar, spaceLabel, validCalendarFilter, type CalendarFilter } from './lib/aggregate-calendar';
import { createCalendarReadLoop } from './lib/calendar-refresh';
import { draftFromEditTarget, type EventDraft } from './lib/event-edit-draft';
import {
  buildEventUpdatePayload,
  deleteMutationRoute,
  deleteOccurrenceAndFutureRpcArgs,
  occurrenceDeleteRpcArgs,
  occurrenceOverrideRpcArgs,
  saveMutationRoute,
  splitRecurringEventRpcArgs,
  type OccurrenceScope,
} from './lib/event-edit-mutation';
import { eventEditTargetForEvent, eventEditTargetForOccurrence } from './lib/event-edit-target';
import { eventEditUiState, occurrenceActionCopy, type OccurrenceAction } from './lib/event-edit-ui';
import { memberDisplayNameForUser } from './lib/member';
import { defaultRecurrenceDraft, expandRecurringEvents, recurrenceDraftFromRule, recurrenceRuleFromDraft, recurrenceSummary, type RecurrenceDraft } from './lib/recurrence';
import {
  allDayReminderOptions,
  defaultReminderKind,
  mapReminderKindForAllDay,
  reminderKindLabel,
  resolveEventTimeZone,
  timedReminderOptions,
} from './lib/reminder';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { bootstrapSpaces, chooseSelectedSpaceId, completeSharedSpaceAction, ensureOnceUntilFailure, writeSelectedSpaceId } from './lib/space-selection';
import { newEventIdentity } from './lib/space-content';
import { createTasksModuleToggleGuard, tasksModuleStateFromResult, type TasksModuleState } from './lib/space-modules';
import { createRequestGuard } from './lib/request-guard';
import { initialNavigation, openCalendar, openSpace, openSpaceScreen, selectTab, type TopLevelTab } from './lib/navigation';
import {
  registerPushServiceWorker,
} from './lib/push-notifications';
import {
  addDays,
  addHours,
  addMonths,
  formatDay,
  formatMonth,
  formatTime,
  fromDateInputValue,
  isSameDay,
  occurrenceFallsOnDay,
  sortOccurrences,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateInputValue,
} from './lib/date';
import type { CalendarEvent, CalendarOccurrence, CurrentSpace, EventAudience, EventEditTarget, EventOccurrenceException, Space, SpaceMember } from './types';
import type { ReminderKind } from '../supabase/functions/_shared/reminder-due.ts';

type ViewMode = 'today' | 'week' | 'month';
const viewLabels: Record<ViewMode, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
};

function emptyDraft(date?: Date): EventDraft {
  const startsAt = date ? new Date(date) : new Date();
  const endsAt = addHours(startsAt, 1);
  const startsAtValue = toDateInputValue(startsAt);

  return {
    title: '',
    description: '',
    audience: 'mine',
    startsAt: startsAtValue,
    endsAt: toDateInputValue(endsAt),
    allDay: false,
    reminderKind: defaultReminderKind(false),
    recurrence: defaultRecurrenceDraft(startsAtValue),
  };
}

function draftFromEvent(event: CalendarEvent, userId: string): EventDraft {
  const startsAt = toDateInputValue(new Date(event.starts_at));

  return {
    title: event.title,
    description: event.description ?? '',
    audience: audienceFromEvent(event, userId),
    startsAt,
    endsAt: event.ends_at ? toDateInputValue(new Date(event.ends_at)) : '',
    allDay: event.all_day,
    reminderKind: event.reminder_kind,
    recurrence: recurrenceDraftFromRule(event.recurrence_rule, startsAt),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
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

function canManageEvent(event: CalendarEvent, userId: string) {
  return event.scope === 'shared' || event.owner_user_id === userId;
}

function audienceLabel(audience: EventAudience, userId: string, members: SpaceMember[]) {
  if (audience === 'shared') {
    return '共同';
  }

  const ownerUserId = audience === 'mine' ? userId : members.find((member) => member.user_id !== userId)?.user_id;
  return memberDisplayNameForUser(members, ownerUserId);
}

function eventAudienceLabel(event: CalendarEvent, members: SpaceMember[]) {
  return event.scope === 'shared' ? '共同' : memberDisplayNameForUser(members, event.owner_user_id);
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

  return <CalendarApp key={session.user.id} session={session} />;
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
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [status, setStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'otp') {
      otpInputRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (cooldownSeconds === 0) {
      return;
    }

    const timer = window.setTimeout(() => setCooldownSeconds((seconds) => seconds - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  async function requestOtp() {
    setSending(true);
    setStatus('');
    setErrorMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
    });

    setSending(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setOtp('');
    setStep('otp');
    setCooldownSeconds(60);
    setStatus('验证码已发送，请输入邮件中的 8 位数字验证码。');
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setStatus('');
    setErrorMessage('');

    if (otp.length !== 8) {
      setErrorMessage('请输入 8 位数字验证码。');
      return;
    }

    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    setVerifying(false);

    if (error) {
      setErrorMessage(error.message);
    }
  }

  function changeEmail() {
    setStep('email');
    setOtp('');
    setStatus('');
    setErrorMessage('');
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

        {step === 'email' ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void requestOtp();
            }}
            className="rounded-lg bg-white p-5 shadow-soft"
          >
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
              disabled={sending}
            >
              {sending ? '发送中' : '发送验证码'}
            </button>
            {errorMessage && <p className="mt-4 text-sm leading-6 text-coral">{errorMessage}</p>}
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="rounded-lg bg-white p-5 shadow-soft">
            <p className="text-sm leading-6 text-ink/70">验证码已发送至 {email}</p>
            <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="otp">
              8 位验证码
            </label>
            <input
              ref={otpInputRef}
              id="otp"
              className="mt-2 w-full rounded-lg border border-ink/15 px-4 py-3 text-center text-lg tracking-[0.35em] outline-none focus:border-teal"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              required
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 8))}
              aria-describedby="otp-help"
              aria-invalid={Boolean(errorMessage)}
            />
            <p id="otp-help" className="mt-2 text-sm leading-6 text-ink/60">
              请在当前浏览器或 PWA 中输入邮件里的验证码。
            </p>
            <button
              className="mt-4 h-12 w-full rounded-lg bg-teal font-semibold text-white disabled:opacity-60"
              type="submit"
              disabled={verifying || otp.length !== 8}
            >
              {verifying ? '验证中' : '验证并登录'}
            </button>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold">
              <button className="text-teal disabled:opacity-50" type="button" onClick={changeEmail} disabled={sending || verifying}>
                修改邮箱
              </button>
              <button className="text-teal disabled:opacity-50" type="button" onClick={() => void requestOtp()} disabled={cooldownSeconds > 0 || sending || verifying}>
                {cooldownSeconds > 0 ? `${cooldownSeconds} 秒后可重发` : sending ? '发送中' : '重新发送'}
              </button>
            </div>
            {status && <p className="mt-4 text-sm leading-6 text-ink/70">{status}</p>}
            {errorMessage && <p className="mt-4 text-sm leading-6 text-coral">{errorMessage}</p>}
          </form>
        )}
      </section>
    </main>
  );
}

const spaceBatchSize = 500;

async function listCurrentSpaces(userId: string): Promise<CurrentSpace[]> {
  const memberships: Array<Pick<SpaceMember, 'space_id' | 'role'>> = [];
  for (let start = 0; ;) {
    const { data, count, error } = await supabase.from('space_members')
      .select('space_id,role', { count: 'exact' })
      .eq('user_id', userId)
      .order('space_id')
      .range(start, start + spaceBatchSize - 1);
    if (error) throw error;
    if (count === null) throw new Error('无法确认空间成员列表是否完整。');
    const batch = (data ?? []) as Array<Pick<SpaceMember, 'space_id' | 'role'>>;
    memberships.push(...batch);
    if (memberships.length >= count) break;
    if (batch.length === 0) throw new Error('空间成员列表读取不完整，请重试。');
    start += batch.length;
  }

  const roles = new Map(memberships.map((member) => [member.space_id, member.role]));
  const spaces: CurrentSpace[] = [];
  for (let start = 0; ;) {
    const { data, count, error } = await supabase.from('spaces')
      .select('*', { count: 'exact' })
      .order('created_at')
      .order('id')
      .range(start, start + spaceBatchSize - 1);
    if (error) throw error;
    if (count === null) throw new Error('无法确认空间列表是否完整。');
    const batch = (data ?? []) as Space[];
    for (const space of batch) {
      const membershipRole = roles.get(space.id);
      if (membershipRole) spaces.push({ ...space, membershipRole });
    }
    if (start + batch.length >= count) break;
    if (batch.length === 0) throw new Error('空间列表读取不完整，请重试。');
    start += batch.length;
  }
  return spaces;
}

async function readSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
  const { data, error } = await supabase.from('space_members')
    .select('space_id,user_id,role,joined_at,profiles(display_name)')
    .eq('space_id', spaceId)
    .order('joined_at', { ascending: true })
    .order('user_id', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Omit<SpaceMember, 'profiles'> & { profiles?: { display_name: string | null }[] | { display_name: string | null } | null }>).map(
    (member) => ({ ...member, profiles: Array.isArray(member.profiles) ? member.profiles[0] ?? null : member.profiles ?? null }),
  );
}

function CalendarApp({ session }: { session: Session }) {
  const userId = session.user.id;
  const [spaces, setSpaces] = useState<CurrentSpace[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>('all');
  const [navigation, setNavigation] = useState(initialNavigation);
  const [spaceListStatus, setSpaceListStatus] = useState<'loading' | 'ready' | 'error'>('ready');
  const [spaceActionBusy, setSpaceActionBusy] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [personalInitializationError, setPersonalInitializationError] = useState<Error | null>(null);
  const requestGuard = useRef(createRequestGuard());
  const ensurePersonalSpace = useRef(ensureOnceUntilFailure(async () => {
    const { error: ensureError } = await supabase.rpc('ensure_personal_space');
    if (ensureError) throw ensureError;
  }));

  async function loadSpaces(preferredId?: string): Promise<boolean> {
    const currentRequest = requestGuard.current.begin();
    setLoading(true);
    setError('');
    try {
      let result: { spaces: CurrentSpace[]; selectedSpaceId: string; personalInitializationError?: Error | null };
      if (preferredId) {
        const listed = await listCurrentSpaces(userId);
        if (!listed.some((space) => space.id === preferredId)) {
          throw new Error('新空间未出现在你的成员列表中，请重试。');
        }
        result = { spaces: listed, selectedSpaceId: preferredId };
      } else {
        result = await bootstrapSpaces(userId, window.localStorage, {
          ensurePersonalSpace: ensurePersonalSpace.current,
          listCurrentSpaces: () => listCurrentSpaces(userId),
          currentSelectionId: selectedSpaceId,
        });
      }
      if (!requestGuard.current.isCurrent(currentRequest)) return false;
      setSpaces(result.spaces);
      if (selectedSpaceId && selectedSpaceId !== result.selectedSpaceId) {
        if (navigation.tab !== 'calendar') {
          setSelectedDate(new Date());
          setViewMode('today');
        }
        setNavigation((current) => current.tab === 'calendar' ? current : selectTab(current, 'spaces'));
      }
      setSelectedSpaceId(result.selectedSpaceId);
      if (!preferredId) setPersonalInitializationError(result.personalInitializationError ?? null);
      writeSelectedSpaceId(window.localStorage, userId, result.selectedSpaceId);
      return true;
    } catch (loadError) {
      if (!requestGuard.current.isCurrent(currentRequest)) return false;
      setError(getErrorMessage(loadError));
      return false;
    } finally {
      if (requestGuard.current.isCurrent(currentRequest)) setLoading(false);
    }
  }

  useEffect(() => {
    void loadSpaces();
    void registerPushServiceWorker().catch((registrationError) => {
      console.warn('Push service worker registration failed.', getErrorMessage(registrationError));
    });
    return () => { requestGuard.current.invalidate(); };
  }, [userId]);

  async function selectSpace(spaceId: string) {
    if (spaceListStatus !== 'ready' || spaceActionBusy) return;
    const request = requestGuard.current.begin();
    setSpaceListStatus('loading');
    setError('');
    try {
      const listed = await listCurrentSpaces(userId);
      if (!requestGuard.current.isCurrent(request)) return;
      setSpaces(listed);
      const validatedId = chooseSelectedSpaceId(listed, selectedSpaceId);
      if (!validatedId) throw new Error('未找到可用空间，请重新加载。');
      if (!listed.some((space) => space.id === spaceId)) {
        setSelectedSpaceId(validatedId);
        writeSelectedSpaceId(window.localStorage, userId, validatedId);
        setSelectedDate(new Date());
        setViewMode('today');
        setError('此空间已不在你的成员列表中，请重新选择。');
        setSpaceListStatus('ready');
        return;
      }
      if (selectedSpaceId !== spaceId) {
        setSelectedDate(new Date());
        setViewMode('today');
      }
      setSelectedSpaceId(spaceId);
      writeSelectedSpaceId(window.localStorage, userId, spaceId);
      setNavigation((current) => openSpace(current));
      setSpaceListStatus('ready');
    } catch (selectionError) {
      if (requestGuard.current.isCurrent(request)) {
        setError(getErrorMessage(selectionError));
        setSpaceListStatus('error');
      }
    }
  }

  async function refreshSpaces() {
    const currentRequest = requestGuard.current.begin();
    setSpaceListStatus('loading');
    setError('');
    try {
      const listed = await listCurrentSpaces(userId);
      const validatedId = chooseSelectedSpaceId(listed, selectedSpaceId);
      if (!validatedId) {
        if (requestGuard.current.isCurrent(currentRequest)) {
          setSpaces([]);
          setSelectedSpaceId(null);
        }
        throw new Error('未找到可用空间，请重新加载。');
      }
      if (!requestGuard.current.isCurrent(currentRequest)) return;
      setSpaces(listed);
      if (selectedSpaceId !== validatedId) {
        if (navigation.tab !== 'calendar') {
          setSelectedDate(new Date());
          setViewMode('today');
        }
        setNavigation((current) => current.tab === 'calendar' ? current : selectTab(current, 'spaces'));
      }
      setSelectedSpaceId(validatedId);
      writeSelectedSpaceId(window.localStorage, userId, validatedId);
      setSpaceListStatus('ready');
    } catch (refreshError) {
      if (requestGuard.current.isCurrent(currentRequest)) {
        setError(getErrorMessage(refreshError));
        setSpaceListStatus('error');
      }
    }
  }

  function changeTab(tab: TopLevelTab) {
    if (spaceActionBusy) return;
    requestGuard.current.invalidate();
    setNavigation((current) => selectTab(current, tab));
    if (tab === 'spaces') void refreshSpaces();
    if (tab === 'calendar') void refreshSpaces();
  }

  async function sharedSpaceReady(spaceId: string) {
    const ready = await loadSpaces(spaceId);
    if (ready) setNavigation((current) => openSpace(current));
    return ready;
  }

  function updateSpace(updated: Space) {
    setSpaces((current) => current.map((space) => space.id === updated.id ? { ...space, ...updated } : space));
  }

  const selectedSpace = spaces.find((space) => space.id === selectedSpaceId) ?? null;
  const validFilter = validCalendarFilter(calendarFilter, spaces);
  const visibleCalendarSpaces = calendarSpaces(spaces, validFilter);
  useEffect(() => {
    if (validFilter !== calendarFilter) setCalendarFilter('all');
  }, [validFilter, calendarFilter]);
  if (loading && !selectedSpace) return <FullScreenMessage title="正在载入" body="正在确认你的空间。" />;
  if (!selectedSpace) {
    return (
      <main className="min-h-screen bg-mist px-5 py-10">
        <div className="mx-auto max-w-md">
          <Notice tone="error" message={error || '未找到可用空间。'} />
          <button className="mt-4 h-11 rounded-lg bg-teal px-5 font-semibold text-white" type="button" onClick={() => void loadSpaces()}>重试</button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-mist text-ink pb-nav">
      {personalInitializationError && (
        <div className="bg-mist px-4 pt-4">
          <div className="mx-auto max-w-3xl rounded-lg border border-amber/40 bg-white px-4 py-3 text-sm text-ink shadow-soft" role="alert">
            <p className="font-semibold">我的空间暂时没有初始化成功。</p>
            <p className="mt-1">已有共享空间仍可正常使用。</p>
            <button className="mt-2 min-h-11 font-semibold text-teal disabled:opacity-60" type="button" disabled={loading} onClick={() => void loadSpaces()}>{loading ? '重试中…' : '重试初始化'}</button>
          </div>
        </div>
      )}
      {navigation.tab === 'spaces' && navigation.spaceScreen === 'list' && (
        spaceListStatus === 'ready'
          ? <SpacePage
              spaces={spaces}
              selectedSpaceId={selectedSpaceId!}
              onSelect={(spaceId) => { void selectSpace(spaceId); }}
              onSharedReady={sharedSpaceReady}
              busy={spaceActionBusy}
              onBusyChange={setSpaceActionBusy}
            />
          : <SpaceListPending status={spaceListStatus} onRetry={() => void refreshSpaces()} />
      )}
      {navigation.tab === 'calendar' && spaceListStatus !== 'ready' && <SpaceListPending status={spaceListStatus} onRetry={() => void refreshSpaces()} />}
      {((navigation.tab === 'calendar' && spaceListStatus === 'ready') || (navigation.tab === 'spaces' && navigation.spaceScreen !== 'list')) && (
        <CurrentSpaceApp
          key={navigation.tab === 'calendar' ? `calendar:${validFilter === 'all' ? 'all' : validFilter.spaceId}:${visibleCalendarSpaces.map((item) => item.id).join(',')}` : `spaces:${selectedSpaceId}`}
          session={session}
          space={selectedSpace}
          spaces={visibleCalendarSpaces}
          allSpaces={spaces}
          calendarFilter={validFilter}
          onCalendarFilterChange={setCalendarFilter}
          screen={navigation.tab === 'calendar' ? 'calendar' : navigation.spaceScreen as TasksScreen}
          onScreenChange={(screen) => {
            if (screen === 'calendar') {
              setCalendarFilter({ spaceId: selectedSpace.id });
              setNavigation((current) => openCalendar(current));
            } else setNavigation((current) => openSpaceScreen(current, screen));
          }}
          onHubBack={() => setNavigation((current) => selectTab(current, 'spaces'))}
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSpaceUpdate={updateSpace}
        />
      )}
      {navigation.tab === 'me' && <MyPage userId={userId} />}
      <BottomNavigation tab={navigation.tab} onChange={changeTab} disabled={spaceActionBusy} />
      {error && <p className="nav-alert fixed left-4 right-4 z-30 rounded-lg bg-coral px-4 py-3 text-sm text-white" role="alert">{error}</p>}
    </div>
  );
}

function SpaceListPending({ status, onRetry }: { status: 'loading' | 'error'; onRetry: () => void }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <h1 className="text-xl font-bold">空间</h1>
      <p className="mt-4">{status === 'loading' ? '正在确认空间成员列表…' : '空间列表刷新失败，请重试。'}</p>
      {status === 'error' && <button className="mt-4 min-h-11 rounded-lg bg-teal px-4 font-semibold text-white" type="button" onClick={onRetry}>重试</button>}
    </main>
  );
}

function calendarPickerSheet(title: string, titleId: string, onClose: () => void, choices: React.ReactNode) {
  const sheet = (
    <div className="fixed inset-0 z-30 flex items-end bg-ink/35 md:items-center md:px-4" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="w-full min-w-0 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 shadow-soft safe-bottom md:mx-auto md:max-w-md md:rounded-lg">
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-mist" aria-label={`关闭${title}`} onClick={onClose}><X size={20} /></button>
        </div>
        <div className="mt-4 space-y-1">{choices}</div>
      </section>
    </div>
  );
  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body);
}

export function CalendarFilterPicker({ spaces, filter, open, onOpen, onClose, onSelect }: {
  spaces: CurrentSpace[];
  filter: CalendarFilter;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (filter: CalendarFilter) => void;
}) {
  const selectedName = filter === 'all' ? '全部空间' : spaces.find((item) => item.id === filter.spaceId)?.name ?? '全部空间';
  function choose(next: CalendarFilter) {
    onSelect(next);
    onClose();
  }

  const sheet = open && calendarPickerSheet('筛选日历', 'calendar-filter-title', onClose, <>
    <button type="button" className="flex min-h-12 w-full min-w-0 items-center gap-3 rounded-lg px-3 text-left font-semibold hover:bg-mist" aria-label="筛选：全部空间" aria-pressed={filter === 'all'} onClick={() => choose('all')}>
      <Check size={18} className={`shrink-0 ${filter === 'all' ? 'text-teal' : 'invisible'}`} aria-hidden="true" />
      <span className="min-w-0 truncate">全部空间</span>
    </button>
    {spaces.map((item) => (
      <button key={item.id} type="button" className="flex min-h-12 w-full min-w-0 items-center gap-3 rounded-lg px-3 text-left font-semibold hover:bg-mist" aria-label={`筛选：${item.name}`} aria-pressed={filter !== 'all' && filter.spaceId === item.id} onClick={() => choose({ spaceId: item.id })}>
        <Check size={18} className={`shrink-0 ${filter !== 'all' && filter.spaceId === item.id ? 'text-teal' : 'invisible'}`} aria-hidden="true" />
        <span className="min-w-0 break-all">{item.name}</span>
      </button>
    ))}
  </>);

  return (
    <>
      <button type="button" className="flex h-11 w-full min-w-0 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-ink shadow-sm" aria-label="筛选日历" aria-haspopup="dialog" aria-expanded={open} onClick={onOpen}>
        <span className="min-w-0 flex-1 truncate text-left">{selectedName}</span>
        <ChevronDown size={16} className="shrink-0" aria-hidden="true" />
      </button>
      {sheet}
    </>
  );
}

export function CalendarViewPicker({ mode, open, onOpen, onClose, onSelect }: {
  mode: ViewMode;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (mode: ViewMode) => void;
}) {
  function choose(next: ViewMode) {
    onSelect(next);
    onClose();
  }
  const sheet = open && calendarPickerSheet('选择视图', 'calendar-view-title', onClose,
    (Object.keys(viewLabels) as ViewMode[]).map((option) => (
      <button key={option} type="button" className="flex min-h-12 w-full min-w-0 items-center gap-3 rounded-lg px-3 text-left font-semibold hover:bg-mist" aria-label={`视图：${viewLabels[option]}`} aria-pressed={mode === option} onClick={() => choose(option)}>
        <Check size={18} className={`shrink-0 ${mode === option ? 'text-teal' : 'invisible'}`} aria-hidden="true" />
        <span>{viewLabels[option]}</span>
      </button>
    )),
  );
  return (
    <>
      <button type="button" className="flex h-11 w-full min-w-0 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-ink shadow-sm" aria-label="选择日历视图" aria-haspopup="dialog" aria-expanded={open} onClick={onOpen}>
        <span className="min-w-0 flex-1 truncate text-left">{viewLabels[mode]}</span>
        <ChevronDown size={16} className="shrink-0" aria-hidden="true" />
      </button>
      {sheet}
    </>
  );
}

export function CalendarDateNavigation({ selectedDate, viewMode, onSelectedDateChange, today = new Date() }: {
  selectedDate: Date;
  viewMode: ViewMode;
  onSelectedDateChange: (date: Date) => void;
  today?: Date;
}) {
  const currentPeriodLabel = viewMode === 'today' ? '回到今天' : viewMode === 'week' ? '回到本周' : '回到本月';
  const stepDays = viewMode === 'today' ? 1 : 7;
  const navigate = (direction: -1 | 1) => onSelectedDateChange(viewMode === 'month' ? addMonths(selectedDate, direction) : addDays(selectedDate, direction * stepDays));
  return (
    <div className="mt-3 flex items-center justify-between">
      <button className="grid h-10 w-10 place-items-center rounded-lg bg-white" type="button" onClick={() => navigate(-1)} aria-label="上一段">
        <ChevronLeft size={18} />
      </button>
      <button className="h-10 rounded-lg bg-white px-4 text-sm font-semibold" type="button" onClick={() => onSelectedDateChange(today)} aria-label={currentPeriodLabel}>
        {currentPeriodLabel}
      </button>
      <button className="grid h-10 w-10 place-items-center rounded-lg bg-white" type="button" onClick={() => navigate(1)} aria-label="下一段">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export function CurrentSpaceApp({ session, space, spaces, allSpaces, calendarFilter, onCalendarFilterChange, screen, onScreenChange, onHubBack, selectedDate, onSelectedDateChange, viewMode, onViewModeChange, onSpaceUpdate }: {
  session: Session;
  space: CurrentSpace;
  spaces: CurrentSpace[];
  allSpaces: CurrentSpace[];
  calendarFilter: CalendarFilter;
  onCalendarFilterChange: (filter: CalendarFilter) => void;
  screen: TasksScreen;
  onScreenChange: (screen: TasksScreen) => void;
  onHubBack: () => void;
  selectedDate: Date;
  onSelectedDateChange: (date: Date) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSpaceUpdate: (space: Space) => void;
}) {
  const userId = session.user.id;
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [occurrenceExceptions, setOccurrenceExceptions] = useState<EventOccurrenceException[]>([]);
  const [membersBySpaceId, setMembersBySpaceId] = useState<Record<string, SpaceMember[]>>({});
  const [calendarStatus, setCalendarStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [calendarError, setCalendarError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [calendarRetry, setCalendarRetry] = useState(0);
  const [error, setError] = useState('');
  const [editingTarget, setEditingTarget] = useState<EventEditTarget | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [openCalendarSelector, setOpenCalendarSelector] = useState<'space' | 'view' | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [tasksModuleState, setTasksModuleState] = useState<TasksModuleState>('loading');
  const [tasksModuleError, setTasksModuleError] = useState('');
  const [tasksModuleBusy, setTasksModuleBusy] = useState(false);
  const memberRequestGuard = useRef(createRequestGuard());
  const eventRequestGuard = useRef(createRequestGuard());
  const moduleRequestGuard = useRef(createRequestGuard());
  const moduleToggleGuard = useRef(createTasksModuleToggleGuard());
  const createGuard = useRef(createRequestGuard());
  const reloadCalendar = useRef<() => void>(() => undefined);

  const sheetSpace = editingTarget
    ? allSpaces.find((item) => item.id === editingTarget.event.space_id) ?? null
    : calendarFilter === 'all' ? null : allSpaces.find((item) => item.id === calendarFilter.spaceId) ?? null;
  const sheetMembers = sheetSpace ? membersBySpaceId[sheetSpace.id] ?? [] : [];
  const sheetPartner = sheetMembers.find((member) => member.user_id !== userId) ?? null;
  const visibleExpansion = useMemo(
    () => expandRecurringEvents(events, calendarVisibleRange(viewMode, selectedDate), occurrenceExceptions),
    [events, occurrenceExceptions, selectedDate, viewMode],
  );
  const projectionError = calendarStatus === 'success' && visibleExpansion.errors.length > 0;

  useEffect(() => {
    if (!openCalendarSelector) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenCalendarSelector(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [openCalendarSelector]);

  async function readTasksModuleState(spaceId: string) {
    const result = await supabase.from('space_modules')
      .select('enabled')
      .eq('space_id', spaceId)
      .eq('module_key', 'tasks')
      .maybeSingle();
    return tasksModuleStateFromResult(result);
  }

  async function loadTasksModuleState(spaceId: string) {
    const currentRequest = moduleRequestGuard.current.begin();
    setTasksModuleState('loading');
    setTasksModuleError('');
    try {
      const state = await readTasksModuleState(spaceId);
      if (moduleRequestGuard.current.isCurrent(currentRequest)) setTasksModuleState(state);
    } catch {
      if (moduleRequestGuard.current.isCurrent(currentRequest)) {
        setTasksModuleState('error');
        setTasksModuleError('任务模块状态读取失败，请重试。');
      }
    }
  }

  async function changeTasksModule() {
    if (space.membershipRole !== 'owner' || moduleToggleGuard.current.isBusy() || (tasksModuleState !== 'enabled' && tasksModuleState !== 'disabled')) return;
    const currentRequest = moduleRequestGuard.current.begin();
    const nextEnabled = tasksModuleState === 'disabled';
    setTasksModuleBusy(true);
    setTasksModuleError('');
    const result = await moduleToggleGuard.current.run(
      async () => {
        const { error: toggleError } = await supabase.rpc('set_space_module_enabled', {
          p_space_id: space.id,
          p_module_key: 'tasks',
          p_enabled: nextEnabled,
        });
        if (toggleError) throw toggleError;
      },
      () => readTasksModuleState(space.id),
    );
    if (!moduleRequestGuard.current.isCurrent(currentRequest)) return;
    setTasksModuleBusy(false);
    if (result === null) return;
    if ('state' in result) {
      setTasksModuleState(result.state);
    } else if (result.failure === 'rpc') {
      setTasksModuleError('任务模块切换失败，请确认空间权限或稍后重试。');
    } else {
      setTasksModuleState('error');
      setTasksModuleError('任务模块状态读取失败，请重试。');
    }
  }

  async function loadMembers(spaceId: string) {
    const currentRequest = memberRequestGuard.current.begin();
    try {
      const loaded = await readSpaceMembers(spaceId);
      if (memberRequestGuard.current.isCurrent(currentRequest)) setMembers(loaded);
    } catch (memberError) {
      if (memberRequestGuard.current.isCurrent(currentRequest)) setError(getErrorMessage(memberError));
    }
  }

  useEffect(() => {
    if (screen !== 'calendar') {
      void loadMembers(space.id);
      void loadTasksModuleState(space.id);
    }
    return () => {
      memberRequestGuard.current.invalidate();
      moduleRequestGuard.current.invalidate();
    };
  }, [space.id, screen]);

  const visibleSpaceIds = spaces.map((item) => item.id).join(',');
  useEffect(() => {
    if (screen !== 'calendar') return;
    let active = true;
    let subscribed = false;
    const connected = new Set<string>();
    const channels: ReturnType<typeof supabase.channel>[] = [];

    const readLoop = createCalendarReadLoop(async (isCurrent) => {
      const request = eventRequestGuard.current.begin();
      setCalendarStatus('loading');
      setCalendarError('');
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
      if (!isCurrent() || !eventRequestGuard.current.isCurrent(request)) return;
      setEvents(loaded.events);
      setOccurrenceExceptions(loaded.exceptions);
      setMembersBySpaceId(loaded.membersBySpaceId);
      setCalendarStatus('success');
    }, (readError) => {
      setCalendarError(getErrorMessage(readError));
      setCalendarStatus('error');
    });

    function changed() {
      if (!active) return;
      eventRequestGuard.current.invalidate();
      setCalendarStatus('loading');
      readLoop.change();
    }

    reloadCalendar.current = changed;
    setCalendarStatus('loading');
    setSyncError('');
    for (const visibleSpace of spaces) {
      const channel = supabase.channel(`calendar-events:${visibleSpace.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `space_id=eq.${visibleSpace.id}` }, changed)
        .subscribe((status) => {
          if (!active) return;
          if (status === 'SUBSCRIBED') {
            const wasConnected = connected.has(visibleSpace.id);
            connected.add(visibleSpace.id);
            if (connected.size === spaces.length && !subscribed) {
              subscribed = true;
              readLoop.start();
            } else if (!wasConnected && subscribed) changed();
            if (connected.size === spaces.length) setSyncError('');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            connected.delete(visibleSpace.id);
            subscribed = false;
            readLoop.pause();
            eventRequestGuard.current.invalidate();
            setSyncError('日程实时同步暂不可用，请重试。');
            setCalendarStatus('error');
          }
        });
      channels.push(channel);
    }
    if (spaces.length === 0) {
      setCalendarError('未找到可用空间，请重试。');
      setCalendarStatus('error');
    }
    return () => {
      active = false;
      reloadCalendar.current = () => undefined;
      readLoop.stop();
      eventRequestGuard.current.invalidate();
      createGuard.current.invalidate();
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [screen, visibleSpaceIds, calendarRetry]);

  useEffect(() => {
    if (tasksModuleState !== 'enabled' && (screen === 'tasks' || screen === 'completed')) onScreenChange('hub');
  }, [tasksModuleState, screen, onScreenChange]);

  const visibleTasksModuleState: TasksModuleState = tasksModuleBusy ? 'loading' : tasksModuleState;

  async function verifyCreateTarget(spaceId: string) {
    const listed = await listCurrentSpaces(userId);
    return listed.some((item) => item.id === spaceId);
  }

  async function openNewEvent() {
    if (calendarFilter === 'all' || calendarStatus !== 'success' || projectionError) return;
    const targetId = calendarFilter.spaceId;
    const request = createGuard.current.begin();
    try {
      if (!await verifyCreateTarget(targetId)) throw new Error('此空间已不在你的成员列表中，请重新选择。');
      if (createGuard.current.isCurrent(request)) setShowNewEvent(true);
    } catch (createError) {
      if (createGuard.current.isCurrent(request)) {
        setCalendarError(getErrorMessage(createError));
        setCalendarStatus('error');
      }
    }
  }

  return (
    <main className="min-h-screen bg-mist text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
        {screen === 'calendar' && (
          <>
        <header className="sticky top-0 z-10 border-b border-ink/10 bg-mist/95 px-4 pb-3 pt-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-teal">日历</p>
              <h1 className="text-2xl font-bold">{formatMonth(selectedDate)}</h1>
            </div>
            <div className="flex items-center gap-2">
              {calendarFilter !== 'all' && !projectionError && <button className="grid h-10 w-10 place-items-center rounded-lg bg-teal text-white shadow-sm disabled:opacity-50" type="button" disabled={calendarStatus !== 'success'} onClick={() => void openNewEvent()} aria-label="新建日程">
                <Plus size={20} />
              </button>}
            </div>
          </div>

          <div className="mt-3 grid w-full max-w-sm grid-cols-2 gap-2">
            <div className="min-w-0">
              <CalendarFilterPicker spaces={allSpaces} filter={calendarFilter} open={openCalendarSelector === 'space'} onOpen={() => setOpenCalendarSelector('space')} onClose={() => setOpenCalendarSelector(null)} onSelect={onCalendarFilterChange} />
            </div>
            <div className="min-w-0">
              <CalendarViewPicker mode={viewMode} open={openCalendarSelector === 'view'} onOpen={() => setOpenCalendarSelector('view')} onClose={() => setOpenCalendarSelector(null)} onSelect={onViewModeChange} />
            </div>
          </div>

          <CalendarDateNavigation selectedDate={selectedDate} viewMode={viewMode} onSelectedDateChange={onSelectedDateChange} />
        </header>

        <section className="flex-1 px-4 py-4 safe-bottom">
          {syncError && <Notice tone="error" message={syncError} />}
          {calendarStatus === 'loading' && <p role="status">正在读取日程…</p>}
          {calendarStatus === 'error' && <div role="alert"><Notice tone="error" message={calendarError || syncError || '日历读取失败，请重试。'} /><button type="button" className="min-h-11 rounded-lg bg-teal px-4 font-semibold text-white" onClick={() => setCalendarRetry((value) => value + 1)}>重试</button></div>}
          {projectionError && <div role="alert"><Notice tone="error" message="重复日程无法完整显示，请重试。" /><button type="button" className="min-h-11 rounded-lg bg-teal px-4 font-semibold text-white" onClick={() => setCalendarRetry((value) => value + 1)}>重试</button></div>}
          {calendarStatus === 'success' && !projectionError && <CalendarViews
            expansion={visibleExpansion}
            membersBySpaceId={membersBySpaceId}
            spacesById={Object.fromEntries(allSpaces.map((item) => [item.id, item]))}
            showSpaceLabel={calendarFilter === 'all'}
            selectedDate={selectedDate}
            viewMode={viewMode}
            userId={userId}
            onEdit={(occurrence) => setEditingTarget(
              occurrence.source_event.recurrence_rule === null
                ? eventEditTargetForEvent(occurrence.source_event)
                : eventEditTargetForOccurrence(occurrence),
            )}
            onSelectDate={onSelectedDateChange}
          />}
        </section>
          </>
        )}
        <TasksArea
          key={`${space.id}:${visibleTasksModuleState === 'enabled' ? 'enabled' : 'blocked'}`}
          screen={screen}
          onScreenChange={onScreenChange}
          onHubBack={onHubBack}
          space={space}
          members={members}
          userId={userId}
          moduleState={visibleTasksModuleState}
          moduleError={tasksModuleError}
          moduleBusy={tasksModuleBusy}
          isOwner={space.membershipRole === 'owner'}
          onModuleRetry={() => void loadTasksModuleState(space.id)}
          onModuleToggle={() => void changeTasksModule()}
          invitePanel={space.kind === 'shared' ? <InvitePanel space={space} onSpaceChange={onSpaceUpdate} /> : null}
          onMembersOpen={() => setShowMembers(true)}
        />
      </div>

      {(showNewEvent || editingTarget) && sheetSpace && sheetMembers.length > 0 && (
        <EventSheet
          target={editingTarget}
          space={sheetSpace}
          userId={userId}
          members={sheetMembers}
          partnerId={sheetPartner?.user_id ?? null}
          onClose={() => {
            setShowNewEvent(false);
            setEditingTarget(null);
          }}
          onSaved={() => reloadCalendar.current()}
          validateCreateTarget={() => verifyCreateTarget(sheetSpace.id)}
          showSourceSpace={calendarFilter === 'all'}
        />
      )}

      {showMembers && (
        <MemberSheet
          members={members}
          userId={userId}
          onClose={() => setShowMembers(false)}
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

export function SpacePage({ spaces, selectedSpaceId, onSelect, onSharedReady, busy, onBusyChange }: {
  spaces: CurrentSpace[];
  selectedSpaceId: string;
  onSelect: (spaceId: string) => void;
  onSharedReady: (spaceId: string) => Promise<boolean>;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-4">
      <section>
        <h1 className="text-xl font-bold">空间</h1>
        <div className="mt-4 space-y-2">
          {spaces.map((space) => (
            <button key={space.id} className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-4 text-left shadow-sm disabled:opacity-60 ${space.id === selectedSpaceId ? 'bg-teal text-white' : 'bg-white text-ink'}`} type="button" onClick={() => onSelect(space.id)} disabled={busy} aria-current={space.id === selectedSpaceId ? 'true' : undefined}>
              <span className="min-w-0 truncate font-semibold">{space.kind === 'personal' ? '👤 我的空间' : space.name}</span>
              {space.id === selectedSpaceId && <span className="shrink-0 text-sm">当前</span>}
            </button>
          ))}
        </div>
        <SharedSpaceForms onReady={onSharedReady} busy={busy} onBusyChange={onBusyChange} />
      </section>
    </main>
  );
}

export function BottomNavigation({ tab, onChange, disabled = false }: { tab: TopLevelTab; onChange: (tab: TopLevelTab) => void; disabled?: boolean }) {
  const tabs: { id: TopLevelTab; label: string }[] = [
    { id: 'calendar', label: '日历' },
    { id: 'spaces', label: '空间' },
    { id: 'me', label: '我的' },
  ];
  return (
    <nav className="bottom-nav fixed inset-x-0 bottom-0 z-10 border-t border-ink/10 bg-white" aria-label="一级导航">
      <div className="mx-auto grid max-w-3xl grid-cols-3">
        {tabs.map(({ id, label }) => (
          <button key={id} type="button" className={`min-h-12 px-2 py-2 text-sm font-semibold disabled:opacity-50 ${tab === id ? 'text-teal' : 'text-ink/65'}`} onClick={() => onChange(id)} disabled={disabled} aria-current={tab === id ? 'page' : undefined}>{label}</button>
        ))}
      </div>
    </nav>
  );
}

function SharedSpaceForms({ onReady, busy, onBusyChange }: {
  onReady: (spaceId: string) => Promise<boolean>;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [spaceName, setSpaceName] = useState('我们的日历');
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');

  async function createSpace(event: React.FormEvent) {
    event.preventDefault();
    onBusyChange(true);
    setMessage('');

    try {
      if (!await completeSharedSpaceAction('create', spaceName, async (method, args) => await supabase.rpc(method, args), onReady)) {
        setMessage('空间已创建，但成员列表暂未刷新，请重试。');
      }
    } catch (createError) {
      setMessage(getErrorMessage(createError));
    } finally {
      onBusyChange(false);
    }
  }

  async function joinSpace(event: React.FormEvent) {
    event.preventDefault();
    onBusyChange(true);
    setMessage('');

    try {
      if (!await completeSharedSpaceAction('join', inviteCode, async (method, args) => await supabase.rpc(method, args), onReady)) {
        setMessage('已加入空间，但成员列表暂未刷新，请重试。');
      }
    } catch (joinError) {
      setMessage(getErrorMessage(joinError));
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <div className="mt-6 border-t border-ink/10 pt-4">
        <p className="text-sm leading-6 text-ink/65">创建两人共享空间，或输入邀请码加入。</p>

        {message && <div className="mt-5"><Notice tone="error" message={message} /></div>}

        <form onSubmit={createSpace} className="mt-4 rounded-lg bg-white p-5 shadow-soft">
          <h2 className="text-lg font-bold">创建共享空间</h2>
          <label className="mt-4 block text-sm font-semibold" htmlFor="shared-space-name">空间名称</label>
          <input
            id="shared-space-name"
            className="mt-2 w-full rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal"
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
          <label className="mt-4 block text-sm font-semibold" htmlFor="shared-invite-code">邀请码</label>
          <input
            id="shared-invite-code"
            className="mt-2 w-full rounded-lg border border-ink/15 px-4 py-3 uppercase tracking-wide outline-none focus:border-teal"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="输入邀请码"
            required
          />
          <button className="mt-4 h-12 w-full rounded-lg bg-ink font-semibold text-white disabled:opacity-60" type="submit" disabled={busy}>
            加入空间
          </button>
        </form>
    </div>
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

export function CalendarViews({
  expansion,
  membersBySpaceId,
  spacesById,
  showSpaceLabel,
  selectedDate,
  viewMode,
  userId,
  onEdit,
  onSelectDate,
}: {
  expansion: ReturnType<typeof expandRecurringEvents>;
  membersBySpaceId: Record<string, SpaceMember[]>;
  spacesById: Record<string, CurrentSpace>;
  showSpaceLabel: boolean;
  selectedDate: Date;
  viewMode: ViewMode;
  userId: string;
  onEdit: (occurrence: CalendarOccurrence) => void;
  onSelectDate: (date: Date) => void;
}) {
  if (expansion.errors.length > 0) return <Notice tone="error" message="重复日程无法完整显示，请重试。" />;
  if (viewMode === 'month') {
    return (
      <>
        <MonthView occurrences={expansion.occurrences} membersBySpaceId={membersBySpaceId} spacesById={spacesById} showSpaceLabel={showSpaceLabel} selectedDate={selectedDate} userId={userId} onEdit={onEdit} onSelectDate={onSelectDate} />
      </>
    );
  }

  const days = viewMode === 'today' ? [selectedDate] : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDate), index));

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const dayOccurrences = sortOccurrences(expansion.occurrences.filter((occurrence) => occurrenceFallsOnDay(occurrence, day)));
        return (
          <DaySection key={day.toISOString()} day={day} occurrences={dayOccurrences} membersBySpaceId={membersBySpaceId} spacesById={spacesById} showSpaceLabel={showSpaceLabel} userId={userId} onEdit={onEdit} />
        );
      })}
    </div>
  );
}

function MonthView({
  occurrences,
  membersBySpaceId,
  spacesById,
  showSpaceLabel,
  selectedDate,
  userId,
  onEdit,
  onSelectDate,
}: {
  occurrences: CalendarOccurrence[];
  membersBySpaceId: Record<string, SpaceMember[]>;
  spacesById: Record<string, CurrentSpace>;
  showSpaceLabel: boolean;
  selectedDate: Date;
  userId: string;
  onEdit: (occurrence: CalendarOccurrence) => void;
  onSelectDate: (date: Date) => void;
}) {
  const monthStart = startOfMonth(selectedDate);
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const selectedOccurrences = sortOccurrences(occurrences.filter((occurrence) => occurrenceFallsOnDay(occurrence, selectedDate)));

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-white p-3 shadow-sm">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink/45">
          {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {cells.map((day) => {
            const dayOccurrences = occurrences.filter((occurrence) => occurrenceFallsOnDay(occurrence, day));
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
                {dayOccurrences.length > 0 && <span className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-coral'}`} />}
              </button>
            );
          })}
        </div>
      </section>
      <DaySection day={selectedDate} occurrences={selectedOccurrences} membersBySpaceId={membersBySpaceId} spacesById={spacesById} showSpaceLabel={showSpaceLabel} userId={userId} onEdit={onEdit} />
    </div>
  );
}

function DaySection({ day, occurrences, membersBySpaceId, spacesById, showSpaceLabel, userId, onEdit }: { day: Date; occurrences: CalendarOccurrence[]; membersBySpaceId: Record<string, SpaceMember[]>; spacesById: Record<string, CurrentSpace>; showSpaceLabel: boolean; userId: string; onEdit: (occurrence: CalendarOccurrence) => void }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-ink/60">{formatDay(day)}</h2>
      {occurrences.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 bg-white px-4 py-6 text-center text-sm text-ink/45">这天还没有日程</div>
      ) : (
        <div className="space-y-2">
          {occurrences.map((occurrence) => (
            <EventCard key={occurrence.occurrence_id} occurrence={occurrence} members={membersBySpaceId[occurrence.source_event.space_id] ?? []} sourceSpace={spacesById[occurrence.source_event.space_id]} showSpaceLabel={showSpaceLabel} userId={userId} onEdit={onEdit} />
          ))}
        </div>
      )}
    </section>
  );
}

function EventCard({ occurrence, members, sourceSpace, showSpaceLabel, userId, onEdit }: { occurrence: CalendarOccurrence; members: SpaceMember[]; sourceSpace: CurrentSpace; showSpaceLabel: boolean; userId: string; onEdit: (occurrence: CalendarOccurrence) => void }) {
  const event = occurrence.source_event;
  const audience = audienceFromEvent(event, userId);

  return (
    <button type="button" className={`w-full rounded-lg border-l-4 bg-white p-4 text-left shadow-sm ${audienceClass(audience)}`} onClick={() => onEdit(occurrence)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{occurrence.title}</p>
          {occurrence.description && <p className="mt-1 line-clamp-2 text-sm text-ink/55">{occurrence.description}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-current/10 px-2 py-1 text-xs font-semibold">{eventAudienceLabel(event, members)}</span>
      </div>
      <p className="mt-3 text-sm text-ink/55">
        {formatTime(occurrence.occurrence_starts_at, occurrence.all_day)}
        {occurrence.occurrence_ends_at && !occurrence.all_day ? ` - ${formatTime(occurrence.occurrence_ends_at, false)}` : ''}
      </p>
      {showSpaceLabel && <p className="mt-2 text-xs font-semibold text-teal">{spaceLabel(sourceSpace)}</p>}
    </button>
  );
}

export function EventSheet({
  target,
  space,
  userId,
  members,
  partnerId,
  onClose,
  onSaved,
  validateCreateTarget,
  showSourceSpace = false,
}: {
  target: EventEditTarget | null;
  space: Space;
  userId: string;
  members: SpaceMember[];
  partnerId: string | null;
  onClose: () => void;
  onSaved: () => void;
  validateCreateTarget: () => Promise<boolean>;
  showSourceSpace?: boolean;
}) {
  const event = target?.event ?? null;
  const occurrenceId = target?.kind === 'occurrence' ? target.occurrence.occurrence_id : null;
  const [draft, setDraft] = useState<EventDraft>(() => {
    if (!target) {
      return emptyDraft();
    }

    return draftFromEditTarget(target, draftFromEvent(target.event, userId), toDateInputValue);
  });
  const [initialDraft, setInitialDraft] = useState<EventDraft>(() => {
    if (!target) {
      return emptyDraft();
    }

    return draftFromEditTarget(target, draftFromEvent(target.event, userId), toDateInputValue);
  });
  const [endManuallyEdited, setEndManuallyEdited] = useState(() => Boolean(event));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canChoosePartner = Boolean(partnerId);
  const canManage = !event || canManageEvent(event, userId);
  const editUi = eventEditUiState(target);
  const [pendingOccurrenceAction, setPendingOccurrenceAction] = useState<OccurrenceAction | null>(null);

  useEffect(() => {
    const nextDraft = target ? draftFromEditTarget(target, draftFromEvent(target.event, userId), toDateInputValue) : emptyDraft();
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setEndManuallyEdited(Boolean(event));
    setError('');
    setBusy(false);
    setPendingOccurrenceAction(null);
  }, [event?.id, occurrenceId, userId]);

  function completeSuccessfulMutation() {
    setBusy(false);
    onClose();
    onSaved();
  }

  function updateStart(value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      startsAt: value,
      endsAt: !event && !endManuallyEdited && value ? toDateInputValue(addHours(new Date(value), 1)) : currentDraft.endsAt,
    }));
  }

  function updateEnd(value: string) {
    setEndManuallyEdited(true);
    setDraft((currentDraft) => ({ ...currentDraft, endsAt: value }));
  }

  function updateRecurrenceFrequency(frequency: RecurrenceDraft['frequency']) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      recurrence: { ...defaultRecurrenceDraft(currentDraft.startsAt), frequency },
    }));
  }

  function updateRecurrence(recurrence: RecurrenceDraft) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      recurrence,
    }));
  }

  function updateAllDay(allDay: boolean) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      allDay,
      reminderKind: mapReminderKindForAllDay(currentDraft.reminderKind, allDay),
    }));
  }

  async function executeOccurrenceAction(scope: OccurrenceScope) {
    if (target?.kind !== 'occurrence' || !pendingOccurrenceAction) {
      return;
    }

    setBusy(true);
    try {
      const result = pendingOccurrenceAction === 'save'
        ? saveMutationRoute(target, scope) === 'recurring-split'
          ? await supabase.rpc('split_recurring_event', splitRecurringEventRpcArgs(target, draft, fromDateInputValue))
          : await supabase.rpc('upsert_occurrence_override', occurrenceOverrideRpcArgs(target, draft, fromDateInputValue))
        : deleteMutationRoute(target, scope) === 'occurrence-future-delete'
          ? await supabase.rpc('delete_occurrence_and_future', deleteOccurrenceAndFutureRpcArgs(target))
          : await supabase.rpc('delete_occurrence', occurrenceDeleteRpcArgs(target));

      if (result.error) {
        setBusy(false);
        setPendingOccurrenceAction(null);
        setError(result.error.message);
        return;
      }

      completeSuccessfulMutation();
    } catch (mutationError) {
      setBusy(false);
      setPendingOccurrenceAction(null);
      setError(getErrorMessage(mutationError));
    }
  }

  async function save(formEvent: React.FormEvent) {
    formEvent.preventDefault();

    if (event && !canManage) {
      return;
    }

    setError('');

    if (target?.kind === 'occurrence') {
      setPendingOccurrenceAction('save');
      return;
    }

    const captureTimeZone = !event
      || (event.time_zone === null && (draft.reminderKind !== null || draft.recurrence.frequency !== 'none'));
    const timeZoneResult = resolveEventTimeZone(event, captureTimeZone);
    if (!timeZoneResult.ok) {
      setError(timeZoneResult.error);
      return;
    }

    const recurrenceResult = recurrenceRuleFromDraft(draft.recurrence, timeZoneResult.timeZone);
    if (!recurrenceResult.ok) {
      setError(recurrenceResult.error);
      return;
    }

    const saveDraft = draft;

    setBusy(true);

    const shouldClearDefaultAllDayEnd = !event && saveDraft.allDay && !endManuallyEdited;
    const contentPayload = {
      title: saveDraft.title.trim(),
      description: saveDraft.description.trim() || null,
      starts_at: fromDateInputValue(saveDraft.startsAt),
      ends_at: shouldClearDefaultAllDayEnd ? null : saveDraft.endsAt ? fromDateInputValue(saveDraft.endsAt) : null,
      all_day: saveDraft.allDay,
      recurrence_rule: recurrenceResult.rule,
      reminder_kind: saveDraft.reminderKind,
      time_zone: timeZoneResult.timeZone,
    };

    let result;

    if (event) {
      const updatePayload = buildEventUpdatePayload(
        event,
        initialDraft,
        saveDraft,
        recurrenceResult.rule,
        timeZoneResult.timeZone,
        fromDateInputValue,
      );
      if (Object.keys(updatePayload).length === 0) {
        completeSuccessfulMutation();
        return;
      }
      result = await supabase.from('events').update(updatePayload).eq('id', event.id);
    } else {
      try {
        if (!await validateCreateTarget()) throw new Error('此空间已不在你的成员列表中，请重新选择。');
      } catch (targetError) {
        setBusy(false);
        setError(getErrorMessage(targetError));
        return;
      }
      if (space.kind === 'shared' && draft.audience === 'partner' && !partnerId) {
        setBusy(false);
        setError('另一位成员加入空间后，才能创建其个人日程。');
        return;
      }

      result = await supabase.from('events').insert({
        ...contentPayload,
        space_id: space.id,
        ...newEventIdentity(space.kind, draft.audience, userId, partnerId),
      });
    }

    if (result.error) {
      setBusy(false);
      setError(result.error.message);
      return;
    }

    completeSuccessfulMutation();
  }

  async function deleteEvent() {
    if (!event || !canManage) {
      return;
    }

    if (target?.kind === 'occurrence') {
      setError('');
      setPendingOccurrenceAction('delete');
      return;
    }

    setBusy(true);
    const deleteResult = await supabase.from('events').delete().eq('id', event.id);

    if (deleteResult.error) {
      setBusy(false);
      setError(deleteResult.error.message);
      return;
    }

    completeSuccessfulMutation();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-ink/35 md:items-center md:px-4 md:py-6">
      <div className="mx-auto max-h-[92dvh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 shadow-soft safe-bottom md:max-h-[calc(100dvh-3rem)] md:rounded-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{event ? canManage ? editUi.isRecurringOccurrenceEdit ? '编辑此重复事件' : '编辑日程' : '日程详情' : '新建日程'}</h2>
          <button className="grid h-10 w-10 place-items-center rounded-lg bg-mist disabled:opacity-60" type="button" onClick={onClose} disabled={busy} aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        {error && <div className="mt-4"><Notice tone="error" message={error} /></div>}
        {event && showSourceSpace && <p className="mt-3 text-sm font-semibold text-teal">所属空间：{spaceLabel(space)}</p>}
        {!event && <p className="mt-3 text-sm font-semibold text-teal">保存到：{space.name}</p>}

        {event && !canManage ? (
          <div className="mt-5 space-y-4">
            <ReadOnlyField label="标题" value={event.title} />
            <ReadOnlyField label="归属" value={eventAudienceLabel(event, members)} />
            <ReadOnlyField label="开始时间" value={new Date(event.starts_at).toLocaleString('zh-CN')} />
            <ReadOnlyField label="结束时间" value={event.ends_at ? new Date(event.ends_at).toLocaleString('zh-CN') : '未设置'} />
            <ReadOnlyField label="全天" value={event.all_day ? '是' : '否'} />
            <ReadOnlyField label="提醒" value={reminderKindLabel(event.reminder_kind)} />
            <ReadOnlyField label="重复" value={recurrenceSummary(event.recurrence_rule)} />
            <ReadOnlyField label="描述" value={event.description || '无'} />
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={save}>
          {editUi.isRecurringOccurrenceEdit ? (
            <p className="rounded-lg bg-teal/10 px-4 py-3 text-sm font-semibold text-teal">
              修改或删除时，可选择仅影响当前事件，或影响当前及未来事件。
            </p>
          ) : null}
          <Field label="标题">
            <input className="w-full rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal" required value={draft.title} onChange={(inputEvent) => setDraft({ ...draft, title: inputEvent.target.value })} />
          </Field>

          {space.kind === 'shared' && <Field label="归属">
            <div className="grid grid-cols-3 gap-2">
              {(['mine', 'partner', 'shared'] as EventAudience[]).map((audience) => (
                <button
                  key={audience}
                  type="button"
                  disabled={Boolean(event) || (audience === 'partner' && !canChoosePartner)}
                  className={`h-11 rounded-lg text-sm font-semibold disabled:opacity-40 ${draft.audience === audience ? 'bg-teal text-white' : 'bg-mist text-ink/70'}`}
                  onClick={() => setDraft({ ...draft, audience })}
                >
                  {audienceLabel(audience, userId, members)}
                </button>
              ))}
            </div>
          </Field>}

          <Field label="开始时间">
            <input className="w-full rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal" type="datetime-local" required value={draft.startsAt} onChange={(inputEvent) => updateStart(inputEvent.target.value)} />
          </Field>

          <Field label="结束时间">
            <input className="w-full rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal" type="datetime-local" value={draft.endsAt} onChange={(inputEvent) => updateEnd(inputEvent.target.value)} />
          </Field>

          <label className="flex items-center gap-3 rounded-lg bg-mist px-4 py-3 text-sm font-semibold">
            <input type="checkbox" checked={draft.allDay} onChange={(inputEvent) => updateAllDay(inputEvent.target.checked)} disabled={!editUi.canEditAllDay} />
            {editUi.isRecurringOccurrenceEdit ? '全天（当前仅此事件不支持修改）' : '全天'}
          </label>

          <Field label="提醒">
            <select
              className="w-full rounded-lg border border-ink/15 bg-white px-4 py-3 outline-none focus:border-teal disabled:bg-mist disabled:text-ink/55"
              value={draft.reminderKind ?? ''}
              disabled={!editUi.canEditReminder}
              onChange={(inputEvent) => setDraft({
                ...draft,
                reminderKind: inputEvent.target.value === '' ? null : inputEvent.target.value as ReminderKind,
              })}
            >
              {(draft.allDay ? allDayReminderOptions : timedReminderOptions).map((option) => (
                <option key={option.value || 'none'} value={option.value}>{option.label}</option>
              ))}
            </select>
            {editUi.reminderHelpText && (
              <p className="mt-2 text-sm text-ink/55">{editUi.reminderHelpText}</p>
            )}
            {draft.audience === 'shared' && !editUi.isRecurringOccurrenceEdit && (
              <p className="mt-2 text-sm text-ink/55">共同日程提醒会通知当前空间成员。</p>
            )}
          </Field>

          <Field label="重复">
            {editUi.canEditRecurrence ? (
              <RecurrenceControls recurrence={draft.recurrence} onChange={updateRecurrence} onFrequencyChange={updateRecurrenceFrequency} />
            ) : (
              <p className="rounded-lg bg-mist px-4 py-3 text-ink/60">当前仅支持修改本次事件，不可修改重复规则。</p>
            )}
          </Field>

          <Field label="描述">
            <textarea className="min-h-24 w-full resize-none rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal" value={draft.description} onChange={(inputEvent) => setDraft({ ...draft, description: inputEvent.target.value })} />
          </Field>

          <div className="flex gap-3 pt-2">
            {event && (
              <button className={`${editUi.isRecurringOccurrenceEdit ? 'h-12 rounded-lg bg-coral/10 px-4 text-sm font-semibold' : 'grid h-12 w-12 place-items-center rounded-lg bg-coral/10'} text-coral`} type="button" onClick={() => void deleteEvent()} disabled={busy} aria-label={editUi.isRecurringOccurrenceEdit ? '删除此事件' : '删除日程'}>
                {editUi.isRecurringOccurrenceEdit ? '删除此事件' : <Trash2 size={20} />}
              </button>
            )}
            <button className="h-12 flex-1 rounded-lg bg-teal font-semibold text-white disabled:opacity-60" type="submit" disabled={busy}>
              {busy ? '保存中' : '保存'}
            </button>
          </div>
          </form>
        )}
      </div>
      {pendingOccurrenceAction && (
        <OccurrenceActionChooser
          action={pendingOccurrenceAction}
          scopes={editUi.occurrenceScopes}
          busy={busy}
          onCancel={() => setPendingOccurrenceAction(null)}
          onSelect={(scope) => void executeOccurrenceAction(scope)}
        />
      )}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink/55">{label}</p>
      <p className="mt-1 whitespace-pre-wrap rounded-lg bg-mist px-4 py-3 text-ink">{value}</p>
    </div>
  );
}

function OccurrenceActionChooser({ action, scopes, busy, onCancel, onSelect }: { action: OccurrenceAction; scopes: OccurrenceScope[]; busy: boolean; onCancel: () => void; onSelect: (scope: OccurrenceScope) => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-ink/35 md:items-center md:px-4" role="dialog" aria-modal="true" aria-label={occurrenceActionCopy(action, 'only-this').title}>
      <section className="w-full rounded-t-2xl bg-white p-5 shadow-soft safe-bottom md:mx-auto md:max-w-md md:rounded-lg">
        <h3 className="text-lg font-bold text-ink">{occurrenceActionCopy(action, 'only-this').title}</h3>
        <div className="mt-4 space-y-2">
          {scopes.map((scope) => (
            <button key={scope} className={`h-12 w-full rounded-lg text-sm font-semibold disabled:opacity-60 ${action === 'delete' ? 'bg-coral/10 text-coral' : 'bg-teal/10 text-teal'}`} type="button" onClick={() => onSelect(scope)} disabled={busy}>
              {occurrenceActionCopy(action, scope).label}
            </button>
          ))}
        </div>
        <button className="mt-3 h-12 w-full rounded-lg bg-mist text-sm font-semibold text-ink disabled:opacity-60" type="button" onClick={onCancel} disabled={busy}>
          取消
        </button>
      </section>
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
