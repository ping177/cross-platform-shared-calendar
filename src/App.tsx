import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMobileSwipe } from './components/useMobileSwipe';
import { createSwipeClickGuard, type SwipeClickGuard } from './lib/mobile-swipe';
import type { Session } from '@supabase/supabase-js';
import {
  CalendarDays,
  House,
  LayoutGrid,
  UserRound,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { CreateTargetSelector, type CreateTargetControl } from './components/GlobalCreateControls';
import { MyPage } from './components/MyPage';
import { SpaceManagementPage } from './components/SpaceManagementPage';
import { ModuleHub, useModuleAvailability } from './components/ModuleHub';
import { ImportantDatesPage } from './components/ImportantDatesPage';
import { loadImportantDatesEligibility, type ImportantDatesData } from './lib/important-dates-data';
import { importantDateLocalToday, type ImportantDateFilter } from './lib/important-dates';
import { CalendarImportantDateCard, CalendarImportantDateSheets, CalendarImportantDateStatus, importantDateFallsOnDay, importantDateOccurrenceKey } from './components/CalendarImportantDates';
import { useCalendarImportantDates } from './components/useCalendarImportantDates';
import { useCalendarEvents } from './components/useCalendarEvents';
import { calendarEventScopeKey, calendarEventViewKey, validCalendarEventsSnapshot, type CalendarEventPresentation, type CalendarEventsSnapshot } from './lib/calendar-event-view';
import type { ModuleEntry } from './lib/module-availability';
import type { ImportantDateOccurrence } from './lib/important-date-projection';
import { compareImportantDateCivilDates } from './lib/important-date-projection';
import { calendarImportantDateTimeZone, validCalendarImportantDatesSnapshot, type CalendarImportantDatesSnapshot, type HomeImportantDatesSnapshot } from './components/useImportantDateProjection';
import { ListsOverviewPage } from './components/ListsOverviewPage';
import { ListDetailPage } from './components/ListDetailPage';
import { ReviewHistoryPage, type ReviewHistorySnapshot } from './components/ReviewHistoryPage';
import { ReviewDetailPage } from './components/ReviewDetailPage';
import { RecurrenceControls } from './components/RecurrenceControls';
import { TasksArea } from './components/TasksArea';
import type { TaskData } from './components/useAggregateTasks';
import type { OverviewData } from './components/useListsOverview';
import { validHomeEventSnapshot, validHomeTaskSnapshot, type HomeEventSnapshot, type HomeTaskSnapshot } from './lib/home-aggregation';
import { HomePage } from './components/HomePage';
import { calendarSpaces, spaceLabel, validCalendarFilter, type CalendarFilter } from './lib/aggregate-calendar';
import { listCurrentSpaces } from './lib/current-spaces';
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
import { canConfirmCreate, canUseCreateTarget, createSubmitLock, resetEventAudienceForTarget, targetMembersValid } from './lib/global-create';
import { eventEditUiState, occurrenceActionCopy, type OccurrenceAction } from './lib/event-edit-ui';
import { memberDisplayNameForUser } from './lib/member';
import { defaultRecurrenceDraft, recurrenceDraftFromRule, recurrenceRuleFromDraft, recurrenceSummary, type RecurrenceDraft } from './lib/recurrence';
import {
  allDayReminderOptions,
  defaultReminderKind,
  mapReminderKindForAllDay,
  reminderKindLabel,
  resolveEventTimeZone,
  timedReminderOptions,
} from './lib/reminder';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { bootstrapSpaces, chooseSelectedSpaceId, clearSelectedSpaceId, ensureOnceUntilFailure, writeSelectedSpaceId } from './lib/space-selection';
import { newEventIdentity } from './lib/space-content';
import { readSpaceMembers } from './lib/space-members';
import { settleSpaceLifecycle, type SpaceLifecycleAction } from './lib/space-lifecycle';
import { createRequestGuard } from './lib/request-guard';
import { moduleEntry, sameModuleScope } from './lib/module-availability';
import type { ListFilter } from './lib/lists';
import { calendarContentSpaceId, canChangeTabFromReviewDetail, clearNavigationTarget, initialNavigation, navigationTargetForState, openCompletedTasks, openListDetail, openListsModule, openImportantDatesModule, openReviewDetail, openReviewModule, openTaskList, openTaskModule, readNavigationTarget, resolveNavigationTarget, selectTab, writeNavigationTarget, type NavigationTarget, type TopLevelTab } from './lib/navigation';
import { loadListsEligibility } from './lib/lists-data';
import type { ListDetailTarget } from './lib/lists-detail-data';
import { readReviewDetail } from './lib/review-detail-data';
import { loadReviewEligibility } from './lib/review-history-data';
import { ReviewUnavailableError, type ReviewDetailTarget } from './lib/review-detail';
import {
  registerPushServiceWorker,
} from './lib/push-notifications';
import {
  addDays,
  addHours,
  navigateCalendarPeriod,
  formatDay,
  formatMonth,
  formatTime,
  fromDateInputValue,
  isSameDay,
  occurrenceFallsOnDay,
  sortOccurrences,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  toDateInputValue,
} from './lib/date';
import type { CalendarEvent, CurrentSpace, EventAudience, EventEditTarget, Space, SpaceMember } from './types';
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

function audienceFromEvent(event: Pick<CalendarEvent, 'scope' | 'owner_user_id'>, userId: string): EventAudience {
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

function eventAudienceLabel(event: Pick<CalendarEvent, 'scope' | 'owner_user_id'>, members: SpaceMember[]) {
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
  const [authEpoch, setAuthEpoch] = useState(0);
  const [startupUserId, setStartupUserId] = useState<string | null>(null);
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStartupUserId(data.session?.user.id ?? null);
      currentUserId.current = data.session?.user.id ?? null;
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') setAuthEpoch((value) => value + 1);
      const nextUserId = nextSession?.user.id ?? null;
      if (currentUserId.current && currentUserId.current !== nextUserId) {
        const storage = sessionNavigationStorage();
        if (storage) clearNavigationTarget(storage, currentUserId.current);
      }
      currentUserId.current = nextUserId;
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

  return <CalendarApp key={`${session.user.id}:${authEpoch}`} session={session} restoreOnStartup={startupUserId === session.user.id} />;
}

function sessionNavigationStorage(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
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

function CalendarApp({ session, restoreOnStartup }: { session: Session; restoreOnStartup: boolean }) {
  const swipeClickGuard = useRef(createSwipeClickGuard()).current;
  const userId = session.user.id;
  const [spaces, setSpaces] = useState<CurrentSpace[]>([]);
  const moduleAvailability = useModuleAvailability(userId, spaces);
  const tasksEntry = useMemo(() => moduleEntry(spaces, moduleAvailability.availability, 'tasks', moduleAvailability.refreshing), [spaces, moduleAvailability.availability, moduleAvailability.refreshing]);
  const reviewEntry = useMemo(() => moduleEntry(spaces, moduleAvailability.availability, 'review', moduleAvailability.refreshing), [spaces, moduleAvailability.availability, moduleAvailability.refreshing]);
  const listsEntry = useMemo(() => moduleEntry(spaces, moduleAvailability.availability, 'lists', moduleAvailability.refreshing), [spaces, moduleAvailability.availability, moduleAvailability.refreshing]);
  const importantDatesEntry = useMemo(() => moduleEntry(spaces, moduleAvailability.availability, 'important_dates', moduleAvailability.refreshing), [spaces, moduleAvailability.availability, moduleAvailability.refreshing]);
  const tasksSnapshot = useRef<{ userId: string; data: TaskData } | null>(null);
  const listsSnapshot = useRef<{ userId: string; data: OverviewData; filter: ListFilter } | null>(null);
  const importantDatesSnapshot = useRef<{ userId: string; data: ImportantDatesData; filter: ImportantDateFilter; pastExpanded: boolean } | null>(null);
  const homeEventsSnapshot = useRef<HomeEventSnapshot | null>(null);
  const homeTasksSnapshot = useRef<HomeTaskSnapshot | null>(null);
  const homeTasksEntry = moduleEntry(spaces, moduleAvailability.availability, 'tasks', false);
  const retainedHomeEvents = validHomeEventSnapshot(homeEventsSnapshot.current, userId, spaces, new Date());
  const retainedHomeTasks = validHomeTaskSnapshot(homeTasksSnapshot.current, userId, spaces, new Date(), homeTasksEntry);
  const homeImportantDatesSnapshot = useRef<HomeImportantDatesSnapshot | null>(null);
  const calendarImportantDatesSnapshot = useRef<CalendarImportantDatesSnapshot | null>(null);
  const calendarEventsSnapshot = useRef<CalendarEventsSnapshot | null>(null);
  // Pending availability is unknown, not a confirmed loss. Existing known
  // module state and current memberships only qualify display continuity.
  const homeImportantDatesEntry = moduleEntry(spaces, moduleAvailability.availability, 'important_dates', false);
  const homeSnapshot = homeImportantDatesSnapshot.current;
  const retainedHomeImportantDates = homeSnapshot?.userId === userId
    && compareImportantDateCivilDates(homeSnapshot.today, importantDateLocalToday()) === 0
    && sameModuleScope(homeImportantDatesEntry ?? { memberSpaces: spaces, eligibleSpaces: homeSnapshot.scope.eligibleSpaces }, homeSnapshot.scope.memberSpaces, homeSnapshot.scope.eligibleSpaces)
    ? homeSnapshot : undefined;
  const retainedHome = Boolean(retainedHomeEvents || retainedHomeTasks || retainedHomeImportantDates);
  const reviewSnapshot = useRef<{ userId: string; memberSpaces: CurrentSpace[]; eligibleSpaces: CurrentSpace[]; history: ReviewHistorySnapshot } | null>(null);
  const retainedTasks = tasksSnapshot.current?.userId === userId && sameModuleScope(tasksEntry, tasksSnapshot.current.data.memberSpaces, tasksSnapshot.current.data.eligibleSpaces) ? tasksSnapshot.current.data : undefined;
  const retainedLists = listsSnapshot.current?.userId === userId && sameModuleScope(listsEntry, listsSnapshot.current.data.memberSpaces, listsSnapshot.current.data.eligibleSpaces) ? listsSnapshot.current : null;
  const retainedImportantDates = importantDatesSnapshot.current?.userId === userId && sameModuleScope(importantDatesEntry, importantDatesSnapshot.current.data.memberSpaces, importantDatesSnapshot.current.data.eligibleSpaces) ? importantDatesSnapshot.current : null;
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [myScreen, setMyScreen] = useState<'profile' | 'management' | 'detail'>('profile');
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>('all');
  const [reviewSpaceId, setReviewSpaceId] = useState<string | null>(null);
  const retainedReview = reviewSnapshot.current?.userId === userId && reviewSnapshot.current.history.selectedSpaceId === reviewSpaceId && sameModuleScope(reviewEntry, reviewSnapshot.current.memberSpaces, reviewSnapshot.current.eligibleSpaces) ? reviewSnapshot.current.history : undefined;
  useEffect(() => {
    if (tasksEntry && tasksSnapshot.current && !sameModuleScope(tasksEntry, tasksSnapshot.current.data.memberSpaces, tasksSnapshot.current.data.eligibleSpaces)) tasksSnapshot.current = null;
    if (listsEntry && listsSnapshot.current && !sameModuleScope(listsEntry, listsSnapshot.current.data.memberSpaces, listsSnapshot.current.data.eligibleSpaces)) listsSnapshot.current = null;
    if (reviewEntry && reviewSnapshot.current && !sameModuleScope(reviewEntry, reviewSnapshot.current.memberSpaces, reviewSnapshot.current.eligibleSpaces)) reviewSnapshot.current = null;
    if (importantDatesEntry && importantDatesSnapshot.current && !sameModuleScope(importantDatesEntry, importantDatesSnapshot.current.data.memberSpaces, importantDatesSnapshot.current.data.eligibleSpaces)) importantDatesSnapshot.current = null;
    if (homeEventsSnapshot.current && !retainedHomeEvents) homeEventsSnapshot.current = null;
    if (homeTasksSnapshot.current && !retainedHomeTasks) homeTasksSnapshot.current = null;
    if (homeImportantDatesSnapshot.current && !retainedHomeImportantDates) homeImportantDatesSnapshot.current = null;
  }, [tasksEntry, listsEntry, reviewEntry, importantDatesEntry, retainedHomeImportantDates, retainedHomeEvents, retainedHomeTasks]);
  const [reviewDetail, setReviewDetail] = useState<ReviewDetailTarget | null>(null);
  const [listDetail, setListDetail] = useState<ListDetailTarget | null>(null);
  const [listNotice, setListNotice] = useState('');
  const reviewDetailDirty = useRef(false);
  const listDetailLeaveGuard = useRef<(() => boolean) | null>(null);
  const [navigation, setNavigation] = useState(initialNavigation);
  const [spaceListStatus, setSpaceListStatus] = useState<'loading' | 'ready' | 'error'>('ready');
  const [spaceActionBusy, setSpaceActionBusy] = useState(false);
  const [spaceDetailRevision, setSpaceDetailRevision] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const calendarEventScope = calendarEventScopeKey(userId, spaces, calendarSpaces(spaces, calendarFilter), calendarFilter);
  const retainedCalendarEvents = validCalendarEventsSnapshot(calendarEventsSnapshot.current, calendarEventScope, calendarEventViewKey(calendarEventScope, viewMode, selectedDate));
  useEffect(() => {
    if (calendarEventsSnapshot.current && !retainedCalendarEvents) calendarEventsSnapshot.current = null;
  }, [retainedCalendarEvents]);
  const retainedCalendarImportantDates = validCalendarImportantDatesSnapshot(calendarImportantDatesSnapshot.current, userId, spaces,
    homeImportantDatesEntry, calendarFilter === 'all' ? 'all' : calendarFilter.spaceId, calendarImportantDateTimeZone());
  useEffect(() => {
    if (calendarImportantDatesSnapshot.current && !retainedCalendarImportantDates) calendarImportantDatesSnapshot.current = null;
  }, [retainedCalendarImportantDates]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [personalInitializationError, setPersonalInitializationError] = useState<Error | null>(null);
  const requestGuard = useRef(createRequestGuard());
  const ensurePersonalSpace = useRef(ensureOnceUntilFailure(async () => {
    const { error: ensureError } = await supabase.rpc('ensure_personal_space');
    if (ensureError) throw ensureError;
  }));
  const restoredNavigation = useRef(false);

  function applyRestoredTarget(target: NavigationTarget) {
    switch (target.page) {
      case 'home': setNavigation(initialNavigation); break;
      case 'calendar': setNavigation(selectTab(initialNavigation, 'calendar')); break;
      case 'modules': setNavigation(selectTab(initialNavigation, 'modules')); break;
      case 'profile': setMyScreen('profile'); setNavigation(selectTab(initialNavigation, 'me')); break;
      case 'tasks': setNavigation(openTaskModule(initialNavigation)); break;
      case 'tasks-completed': setNavigation(openCompletedTasks(initialNavigation)); break;
      case 'lists-overview': setNavigation(openListsModule(initialNavigation)); break;
      case 'important-dates': setNavigation(openImportantDatesModule(initialNavigation)); break;
      case 'lists-detail':
        setListDetail({ spaceId: target.spaceId, listId: target.listId });
        setNavigation(openListDetail(initialNavigation));
        break;
      case 'review-history':
        setReviewSpaceId(target.spaceId ?? null);
        setNavigation(openReviewModule(initialNavigation));
        break;
      case 'review-detail':
        setReviewSpaceId(target.spaceId);
        setReviewDetail({ spaceId: target.spaceId, reviewId: target.reviewId, justCreated: false });
        setNavigation(openReviewDetail(initialNavigation));
        break;
      case 'space-management': setMyScreen('management'); setNavigation(selectTab(initialNavigation, 'me')); break;
      case 'space-detail':
        setMyScreen('detail');
        setNavigation(selectTab(initialNavigation, 'me'));
        break;
    }
  }

  async function loadSpaces(): Promise<boolean> {
    const currentRequest = requestGuard.current.begin();
    setLoading(true);
    setError('');
    try {
      const storage = sessionNavigationStorage();
      if (!restoredNavigation.current && !restoreOnStartup && storage) clearNavigationTarget(storage, userId);
      const result = await bootstrapSpaces(userId, window.localStorage, {
        ensurePersonalSpace: ensurePersonalSpace.current,
        listCurrentSpaces: () => listCurrentSpaces(userId),
        currentSelectionId: selectedSpaceId,
      });
      if (!requestGuard.current.isCurrent(currentRequest)) return false;
      let restoredTarget: NavigationTarget | null = null;
      if (!restoredNavigation.current) {
        const saved = restoreOnStartup && storage ? readNavigationTarget(storage, userId) : null;
        restoredTarget = await resolveNavigationTarget(saved, result.spaces, {
          loadReviewSpaces: () => loadReviewEligibility(userId),
          canReadReview: async (space, reviewId) => {
            try { await readReviewDetail(supabase, space, reviewId, userId); return true; }
            catch (readError) { if (readError instanceof ReviewUnavailableError) return false; throw readError; }
          },
        }, {
          loadListsSpaces: async () => (await loadListsEligibility(userId)).eligibleSpaces,
          canReadList: async (space, listId) => {
            const { data, error } = await supabase.from('lists').select('id,space_id').eq('id', listId).eq('space_id', space.id).maybeSingle();
            if (error) throw error;
            return Boolean(data && data.id === listId && data.space_id === space.id);
          },
        }, {
          loadImportantDatesSpaces: async () => (await loadImportantDatesEligibility(userId)).eligibleSpaces,
        });
        if (!requestGuard.current.isCurrent(currentRequest)) return false;
        applyRestoredTarget(restoredTarget);
        restoredNavigation.current = true;
      }
      setSpaces(result.spaces);
      if (selectedSpaceId && selectedSpaceId !== result.selectedSpaceId) {
        setMyScreen((current) => current === 'detail' ? 'management' : current);
      }
      const nextSelectedSpaceId = restoredTarget?.page === 'space-detail' ? restoredTarget.spaceId : result.selectedSpaceId;
      setSelectedSpaceId(nextSelectedSpaceId);
      setPersonalInitializationError(result.personalInitializationError ?? null);
      writeSelectedSpaceId(window.localStorage, userId, nextSelectedSpaceId);
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
    if (!restoredNavigation.current) return;
    const target = navigationTargetForState(navigation, myScreen, reviewDetail, reviewSpaceId, selectedSpaceId, listDetail);
    const storage = sessionNavigationStorage();
    if (target && storage) writeNavigationTarget(storage, userId, target);
  }, [navigation, myScreen, reviewDetail, reviewSpaceId, selectedSpaceId, listDetail, userId]);

  useEffect(() => {
    void loadSpaces();
    void registerPushServiceWorker().catch((registrationError) => {
      console.warn('Push service worker registration failed.', getErrorMessage(registrationError));
    });
    return () => { requestGuard.current.invalidate(); };
  }, [userId]);

  async function selectManagedSpace(spaceId: string) {
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
        setError('此空间已不在你的成员列表中，请重新选择。');
        setSpaceListStatus('ready');
        return;
      }
      setSelectedSpaceId(spaceId);
      writeSelectedSpaceId(window.localStorage, userId, spaceId);
      setMyScreen('detail');
      setSpaceListStatus('ready');
    } catch (selectionError) {
      if (requestGuard.current.isCurrent(request)) {
        setError(getErrorMessage(selectionError));
        setSpaceListStatus('error');
      }
    }
  }

  async function refreshSpaces(preserveValidatedView = navigation.tab === 'home', expectedSpaceId?: string, selectionId = selectedSpaceId): Promise<boolean> {
    const currentRequest = requestGuard.current.begin();
    const keepPresentationVisible = preserveValidatedView && spaceListStatus === 'ready' && (navigation.tab === 'home' || retainedHome || retainedCalendarImportantDates || retainedCalendarEvents);
    if (!keepPresentationVisible) setSpaceListStatus('loading');
    setError('');
    try {
      const listed = await listCurrentSpaces(userId);
      if (expectedSpaceId && !listed.some((space) => space.id === expectedSpaceId)) {
        throw new Error('新空间未出现在你的成员列表中，请重试。');
      }
      const validatedId = chooseSelectedSpaceId(listed, selectionId);
      if (!validatedId) {
        if (!expectedSpaceId && requestGuard.current.isCurrent(currentRequest)) {
          setSpaces([]);
          setSelectedSpaceId(null);
        }
        throw new Error('未找到可用空间，请重新加载。');
      }
      if (!requestGuard.current.isCurrent(currentRequest)) return false;
      setSpaces(listed);
      if (selectionId !== validatedId) {
        setMyScreen((current) => current === 'detail' ? 'management' : current);
      }
      setSelectedSpaceId(validatedId);
      writeSelectedSpaceId(window.localStorage, userId, validatedId);
      setSpaceListStatus('ready');
      return true;
    } catch (refreshError) {
      if (requestGuard.current.isCurrent(currentRequest)) {
        if (!expectedSpaceId) setError(getErrorMessage(refreshError));
        if (!keepPresentationVisible) setSpaceListStatus(expectedSpaceId ? 'ready' : 'error');
      }
      return false;
    }
  }

  function changeTab(tab: TopLevelTab) {
    if (spaceActionBusy) return;
    if (navigation.tab === 'modules' && navigation.moduleScreen === 'lists-detail' && listDetailLeaveGuard.current && !listDetailLeaveGuard.current()) return;
    if (!canChangeTabFromReviewDetail(navigation, reviewDetailDirty.current, () => window.confirm('有未保存的回顾内容，确定离开吗？'))) return;
    reviewDetailDirty.current = false;
    requestGuard.current.invalidate();
    setNavigation((current) => selectTab(current, tab));
    if (tab === 'me') setMyScreen('profile');
    if (tab === 'calendar' || tab === 'home') void refreshSpaces((tab === 'home' && retainedHome) || (tab === 'calendar' && Boolean(retainedCalendarImportantDates || retainedCalendarEvents)));
  }

  async function managedSpaceReady(spaceId: string) {
    const ready = await refreshSpaces(false, spaceId);
    if (ready) {
      void moduleAvailability.refresh();
      setSelectedSpaceId(spaceId);
      writeSelectedSpaceId(window.localStorage, userId, spaceId);
      setMyScreen('detail');
    }
    return ready;
  }

  async function lifecycleSettled(action: SpaceLifecycleAction, failure?: string) {
    if (!failure) { calendarEventsSnapshot.current = null; calendarImportantDatesSnapshot.current = null; homeImportantDatesSnapshot.current = null; homeEventsSnapshot.current = null; homeTasksSnapshot.current = null; }
    await settleSpaceLifecycle(action, failure, {
      clearSelection: () => {
        setSelectedSpaceId(null);
        clearSelectedSpaceId(window.localStorage, userId);
      },
      closeDetail: () => setMyScreen('management'),
      refresh: (resetSelection) => refreshSpaces(false, undefined, resetSelection ? null : selectedSpaceId),
      remountDetail: () => setSpaceDetailRevision((current) => current + 1),
      showError: setError,
    });
    void moduleAvailability.refresh();
  }

  function updateSpace(updated: Space) {
    // Retained page data can contain copied Space names. Invite-only updates keep retention.
    if (spaces.some((space) => space.id === updated.id && space.name !== updated.name)) {
      tasksSnapshot.current = null;
      listsSnapshot.current = null;
      importantDatesSnapshot.current = null;
      reviewSnapshot.current = null;
      homeEventsSnapshot.current = null;
      homeTasksSnapshot.current = null;
      homeImportantDatesSnapshot.current = null;
      calendarEventsSnapshot.current = null;
      calendarImportantDatesSnapshot.current = null;
    }
    setSpaces((current) => current.map((space) => space.id === updated.id ? { ...space, ...updated } : space));
  }

  const validFilter = validCalendarFilter(calendarFilter, spaces);
  const visibleCalendarSpaces = calendarSpaces(spaces, validFilter);
  const contentSpaceId = calendarContentSpaceId(validFilter, spaces.map((space) => space.id));
  const contentSpace = spaces.find((space) => space.id === contentSpaceId) ?? null;
  useEffect(() => {
    if (navigation.tab === 'calendar' && validFilter !== calendarFilter) setCalendarFilter('all');
  }, [navigation.tab, validFilter, calendarFilter]);
  if (loading && spaces.length === 0) return <FullScreenMessage title="正在载入" body="正在确认你的空间。" />;
  if (spaces.length === 0) {
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
    <div className={`min-h-screen text-ink pb-nav ${navigation.tab === 'home' || navigation.tab === 'me' ? 'bg-ui-page' : 'bg-mist'}`} onPointerDownCapture={swipeClickGuard.onPointerDownCapture} onClickCapture={swipeClickGuard.onClickCapture}>
      {personalInitializationError && (
        <div className="bg-mist px-4 pt-4">
          <div className="mx-auto max-w-3xl rounded-lg border border-amber/40 bg-white px-4 py-3 text-sm text-ink shadow-soft" role="alert">
            <p className="font-semibold">我的空间暂时没有初始化成功。</p>
            <p className="mt-1">已有共享空间仍可正常使用。</p>
            <button className="mt-2 min-h-11 font-semibold text-teal disabled:opacity-60" type="button" disabled={loading} onClick={() => void loadSpaces()}>{loading ? '重试中…' : '重试初始化'}</button>
          </div>
        </div>
      )}
      {navigation.tab === 'calendar' && spaceListStatus !== 'ready' && <SpaceListPending status={spaceListStatus} onRetry={() => void refreshSpaces()} />}
      {navigation.tab === 'home' && spaceListStatus !== 'ready' && <SpaceListPending status={spaceListStatus} onRetry={() => void refreshSpaces()} />}
      {navigation.tab === 'modules' && spaceListStatus !== 'ready' && navigation.moduleScreen !== 'hub' && <SpaceListPending status={spaceListStatus} onRetry={() => void refreshSpaces(false)} />}
      {navigation.tab === 'home' && spaceListStatus === 'ready' && <HomePage spaces={spaces} userId={userId} EventSheetComponent={EventSheet} onMembershipRefresh={async () => { await refreshSpaces(); void moduleAvailability.refresh(); }} importantDatesEntry={homeImportantDatesEntry}
        tasksEntry={homeTasksEntry} initialEvents={retainedHomeEvents} initialTasks={retainedHomeTasks}
        onEventsValidated={(data) => { if (validHomeEventSnapshot(data, userId, spaces, new Date())) homeEventsSnapshot.current = data; }}
        onEventsInvalidate={() => { homeEventsSnapshot.current = null; }}
        onTasksValidated={(data) => { if (validHomeTaskSnapshot(data, userId, spaces, new Date(), null)) { homeTasksSnapshot.current = data; if (homeTasksEntry && !sameModuleScope(homeTasksEntry, data.scope.memberSpaces, data.scope.eligibleSpaces)) void moduleAvailability.refresh(); } }}
        onTasksInvalidate={() => { homeTasksSnapshot.current = null; }}
        initialImportantDates={retainedHomeImportantDates}
        onImportantDatesValidated={(data) => { if (data.userId === userId && sameModuleScope(homeImportantDatesEntry ?? { memberSpaces: spaces, eligibleSpaces: data.scope.eligibleSpaces }, data.scope.memberSpaces, data.scope.eligibleSpaces)) homeImportantDatesSnapshot.current = data; }}
        onImportantDatesInvalidate={() => { homeImportantDatesSnapshot.current = null; }}
        onOpenImportantDates={() => { setNavigation((current) => openImportantDatesModule(current)); }} />}
      {navigation.tab === 'modules' && (spaceListStatus === 'ready' || navigation.moduleScreen === 'hub') && (navigation.moduleScreen === 'hub'
        ? <ModuleHub userId={userId} spaces={spaces} reviewSpaceId={reviewSpaceId} availabilityPending={moduleAvailability.refreshing || spaceListStatus !== 'ready'} onOpenImportantDates={() => { setNavigation((current) => openImportantDatesModule(current)); }} availability={moduleAvailability.availability} onRefresh={() => { void moduleAvailability.refresh(); }} onOpenTasks={() => setNavigation((current) => openTaskModule(current))} onOpenReview={() => setNavigation((current) => openReviewModule(current))} onOpenLists={() => { setListNotice(''); setNavigation((current) => openListsModule(current)); }} />
        : navigation.moduleScreen === 'important-dates'
          ? <ImportantDatesPage swipeClickGuard={swipeClickGuard} key={userId} userId={userId} entry={importantDatesEntry} entryPending={moduleAvailability.refreshing}
              initialData={retainedImportantDates?.data} initialFilter={retainedImportantDates?.filter} initialPastExpanded={retainedImportantDates?.pastExpanded}
              onHubBack={() => setNavigation((current) => selectTab(current, 'modules'))}
              onValidated={(data, filter, pastExpanded) => { if (sameModuleScope(importantDatesEntry, data.memberSpaces, data.eligibleSpaces)) importantDatesSnapshot.current = { userId, data, filter, pastExpanded }; }}
              onInvalidateEligibility={() => { importantDatesSnapshot.current = null; homeImportantDatesSnapshot.current = null; moduleAvailability.invalidate(); void refreshSpaces(false); void moduleAvailability.refresh(true); }}
              onNoEligible={() => { importantDatesSnapshot.current = null; homeImportantDatesSnapshot.current = null; void moduleAvailability.refresh(true); setNavigation((current) => selectTab(current, 'modules')); }} />
        : navigation.moduleScreen === 'lists'
          ? <ListsOverviewPage swipeClickGuard={swipeClickGuard} key={userId} userId={userId} entry={listsEntry} entryPending={moduleAvailability.refreshing} initialData={retainedLists?.data} initialFilter={retainedLists?.filter} onValidated={(data, filter) => { if (sameModuleScope(listsEntry, data.memberSpaces, data.eligibleSpaces)) listsSnapshot.current = { userId, data, filter }; }} onInvalidateEligibility={() => { listsSnapshot.current = null; moduleAvailability.invalidate(); void moduleAvailability.refresh(true); }} initialNotice={listNotice} onOpenDetail={(list) => { setListNotice(''); setListDetail({ spaceId: list.space_id, listId: list.id }); setNavigation((current) => openListDetail(current)); }} onHubBack={() => setNavigation((current) => selectTab(current, 'modules'))} onNoEligible={() => { listsSnapshot.current = null; void moduleAvailability.refresh(); setNavigation((current) => selectTab(current, 'modules')); }} />
        : navigation.moduleScreen === 'lists-detail'
          ? listDetail ? <ListDetailPage key={`${userId}:${listDetail.spaceId}:${listDetail.listId}`} userId={userId} target={listDetail} onLeaveGuardChange={(guard) => { listDetailLeaveGuard.current = guard; }} onBack={() => { setListDetail(null); setNavigation((current) => openListsModule(current)); }} onUnavailable={(result) => { listsSnapshot.current = null; void moduleAvailability.refresh(); setListNotice(result.status === 'deleted' ? '此清单已删除，列表已刷新。' : '清单空间资格已变化，列表已刷新。'); setListDetail(null); setNavigation((current) => result.eligibleSpaces.length ? openListsModule(current) : selectTab(current, 'modules')); }} />
            : <main className="mx-auto max-w-3xl px-4 py-6"><p>此清单暂不可访问。</p><button className="mt-3 min-h-11 font-semibold text-teal" type="button" onClick={() => setNavigation((current) => openListsModule(current))}>返回清单总览</button></main>
        : navigation.moduleScreen === 'review'
          ? <ReviewHistoryPage swipeClickGuard={swipeClickGuard} userId={userId} entry={reviewEntry} entryPending={moduleAvailability.refreshing} initialSnapshot={retainedReview} onValidated={(history) => { if (reviewEntry && reviewSpaceId === history.selectedSpaceId) reviewSnapshot.current = { userId, memberSpaces: reviewEntry.memberSpaces, eligibleSpaces: reviewEntry.eligibleSpaces, history }; }} onInvalidateEligibility={() => { reviewSnapshot.current = null; moduleAvailability.invalidate(); void moduleAvailability.refresh(true); }} currentSpaceId={reviewSpaceId} onSpaceChange={(id) => { if (id !== reviewSpaceId) reviewSnapshot.current = null; setReviewSpaceId(id); }} onOpenDetail={(target) => { reviewDetailDirty.current = false; setReviewDetail(target); setNavigation((current) => openReviewDetail(current)); }} onHubBack={() => setNavigation((current) => selectTab(current, 'modules'))} onNoEligible={() => { reviewSnapshot.current = null; void moduleAvailability.refresh(); setReviewSpaceId(null); setNavigation((current) => selectTab(current, 'modules')); }} />
          : navigation.moduleScreen === 'review-detail'
            ? reviewDetail ? <ReviewDetailPage key={`${reviewDetail.spaceId}:${reviewDetail.reviewId}`} target={reviewDetail} userId={userId} onDirtyChange={(dirty) => { reviewDetailDirty.current = dirty; }} onBack={() => { reviewDetailDirty.current = false; setNavigation((current) => openReviewModule(current)); }} onUnavailable={(reason) => { reviewSnapshot.current = null; void moduleAvailability.refresh(); reviewDetailDirty.current = false; if (reason === 'review') setReviewSpaceId(reviewDetail.spaceId); setNavigation((current) => reason === 'space' ? selectTab(current, 'modules') : openReviewModule(current)); }} />
              : <main className="mx-auto max-w-3xl px-4 py-6"><p>这次回顾暂不可访问。</p><button className="mt-3 min-h-11 font-semibold text-teal" type="button" onClick={() => setNavigation((current) => openReviewModule(current))}>返回回顾列表</button></main>
          : <TasksArea
            swipeClickGuard={swipeClickGuard}
            key={userId}
            screen={navigation.moduleScreen}
            onScreenChange={(screen) => setNavigation((current) => screen === 'completed' ? openCompletedTasks(current) : openTaskList(current))}
            onHubBack={() => setNavigation((current) => selectTab(current, 'modules'))}
            userId={userId}
            entry={tasksEntry}
            entryPending={moduleAvailability.refreshing}
            initialData={retainedTasks}
            onValidated={(data) => { if (sameModuleScope(tasksEntry, data.memberSpaces, data.eligibleSpaces)) tasksSnapshot.current = { userId, data }; }}
            onInvalidateEligibility={() => { tasksSnapshot.current = null; moduleAvailability.invalidate(); void moduleAvailability.refresh(true); }}
          />)}
      {navigation.tab === 'calendar' && spaceListStatus === 'ready' && contentSpace && (
        <CurrentSpaceApp
          swipeClickGuard={swipeClickGuard}
          key={`calendar:${validFilter === 'all' ? 'all' : validFilter.spaceId}:${spaces.map((item) => `${item.id}:${item.membershipRole}`).sort().join(',')}`}
          session={session}
          spaces={visibleCalendarSpaces}
          allSpaces={spaces}
          importantDatesEntry={homeImportantDatesEntry}
          initialCalendarEvents={retainedCalendarEvents}
          onCalendarEventsValidated={(data) => { calendarEventsSnapshot.current = data; }}
          onCalendarEventsInvalidate={() => { calendarEventsSnapshot.current = null; }}
          initialCalendarImportantDates={retainedCalendarImportantDates}
          onCalendarImportantDatesValidated={(data) => { calendarImportantDatesSnapshot.current = data; }}
          onCalendarImportantDatesInvalidate={() => { calendarImportantDatesSnapshot.current = null; }}
          calendarFilter={validFilter}
          onCalendarFilterChange={setCalendarFilter}
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      )}
      {navigation.tab === 'me' && myScreen === 'profile' && <MyPage userId={userId} onManageSpaces={() => { setMyScreen('management'); void refreshSpaces(false); }} />}
      {navigation.tab === 'me' && myScreen !== 'profile' && (
        spaceListStatus === 'ready'
          ? <SpaceManagementPage
              spaces={spaces}
              selectedSpaceId={myScreen === 'detail' ? selectedSpaceId : null}
              userId={userId}
              detailRevision={spaceDetailRevision}
              onSelect={(spaceId) => { void selectManagedSpace(spaceId); }}
              onBack={() => setMyScreen(myScreen === 'detail' ? 'management' : 'profile')}
              onReady={managedSpaceReady}
              onSpaceChange={updateSpace}
              onLifecycleSettled={lifecycleSettled}
              onModuleChanged={(key, spaceId, state) => { if (state === 'disabled') { if (key === 'tasks') { tasksSnapshot.current = null; homeTasksSnapshot.current = null; } if (key === 'review') reviewSnapshot.current = null; if (key === 'lists') listsSnapshot.current = null; if (key === 'important_dates') { calendarImportantDatesSnapshot.current = null; importantDatesSnapshot.current = null; homeImportantDatesSnapshot.current = null; } } moduleAvailability.moduleChanged(key, spaceId, state); }}
              busy={spaceActionBusy}
              onBusyChange={setSpaceActionBusy}
            />
          : <SpaceListPending mySpaces status={spaceListStatus} onRetry={() => void refreshSpaces(false)} />
      )}
      <BottomNavigation tab={navigation.tab} onChange={changeTab} disabled={spaceActionBusy} />
      {error && <p className="nav-alert fixed left-4 right-4 z-30 rounded-lg bg-ui-danger px-4 py-3 font-ui text-sm text-ui-on-status" role="alert"><span className="font-semibold">错误：</span>{error}</p>}
    </div>
  );
}

function SpaceListPending({ status, onRetry, mySpaces = false }: { status: 'loading' | 'error'; onRetry: () => void; mySpaces?: boolean }) {
  return (
    <main className={mySpaces ? "ui-spaces-page mx-auto min-h-[100dvh] w-full max-w-3xl bg-ui-page px-ui-4 py-ui-6 font-ui text-ui-text" : "mx-auto min-h-screen max-w-3xl px-4 py-6"}>
      <h1 className={mySpaces ? "text-ui-section" : "text-xl font-bold"}>{mySpaces ? '空间管理' : '空间'}</h1>
      <p className="mt-4">{status === 'loading' ? '正在确认空间成员列表…' : '空间列表刷新失败，请重试。'}</p>
      {status === 'error' && <button className={mySpaces ? "ui-focus mt-ui-4 min-h-11 rounded-ui-control px-ui-3 text-ui-meta font-ui-semibold text-ui-accent" : "mt-4 min-h-11 rounded-lg bg-teal px-4 font-semibold text-white"} type="button" onClick={onRetry}>重试</button>}
    </main>
  );
}

function calendarPickerSheet(title: string, titleId: string, onClose: () => void, choices: React.ReactNode, container: React.RefObject<HTMLDivElement>) {
  const sheet = (
    <div ref={container} tabIndex={-1} className="fixed inset-0 z-30 flex items-end bg-ink/35 font-ui md:items-center md:px-4" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="w-full min-w-0 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 shadow-soft safe-bottom md:mx-auto md:max-w-md md:rounded-lg">
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button type="button" className="ui-focus grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-mist" aria-label={`关闭${title}`} onClick={onClose}><X size={20} /></button>
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
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const root = dialog.current;
    (root?.querySelector<HTMLElement>('button[aria-pressed="true"]') ?? root?.querySelector<HTMLElement>('button'))?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (!controls.length) { event.preventDefault(); root?.focus(); }
      else if (!root?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      if (trigger.current?.isConnected && !trigger.current.disabled) trigger.current.focus();
      else {
        const fallback = document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('main');
        if (fallback) {
          const tabIndex = fallback.getAttribute('tabindex');
          fallback.setAttribute('tabindex', '-1'); fallback.focus();
          if (tabIndex === null) fallback.removeAttribute('tabindex'); else fallback.setAttribute('tabindex', tabIndex);
        }
      }
    };
  }, [open]);
  const selectedName = filter === 'all' ? '全部空间' : spaces.find((item) => item.id === filter.spaceId)?.name ?? '全部空间';
  function choose(next: CalendarFilter) {
    onSelect(next);
    onClose();
  }

  const sheet = open && calendarPickerSheet('筛选日历', 'calendar-filter-title', onClose, <>
    <button type="button" className="ui-focus flex min-h-12 w-full min-w-0 items-center gap-3 rounded-lg px-3 text-left font-semibold hover:bg-mist" aria-label="筛选：全部空间" aria-pressed={filter === 'all'} onClick={() => choose('all')}>
      <Check size={18} className={`shrink-0 ${filter === 'all' ? 'text-teal' : 'invisible'}`} aria-hidden="true" />
      <span className="min-w-0 truncate">全部空间</span>
    </button>
    {spaces.map((item) => (
      <button key={item.id} type="button" className="ui-focus flex min-h-12 w-full min-w-0 items-center gap-3 rounded-lg px-3 text-left font-semibold hover:bg-mist" aria-label={`筛选：${item.name}`} aria-pressed={filter !== 'all' && filter.spaceId === item.id} onClick={() => choose({ spaceId: item.id })}>
        <Check size={18} className={`shrink-0 ${filter !== 'all' && filter.spaceId === item.id ? 'text-teal' : 'invisible'}`} aria-hidden="true" />
        <span className="min-w-0 break-all">{item.name}</span>
      </button>
    ))}
  </>, dialog);

  return (
    <>
      <button ref={trigger} type="button" className="ui-dropdown-trigger ui-focus flex min-h-ui-touch w-full min-w-0 items-center gap-ui-2 rounded-ui-control bg-ui-surface px-ui-3 text-ui-label text-ui-text shadow-ui-group" aria-label="筛选日历" aria-haspopup="dialog" aria-expanded={open} onClick={onOpen}>
        <span className="min-w-0 flex-1 truncate text-left">{selectedName}</span>
      </button>
      {sheet}
    </>
  );
}

export function CalendarViewPicker({ mode, onClose, onSelect }: {
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
  return (
    <div className="grid min-w-0 grid-cols-3 gap-ui-1 rounded-ui-control bg-ui-accent-soft p-ui-1" role="group" aria-label="选择日历视图">
      {(Object.keys(viewLabels) as ViewMode[]).map((option) => (
        <button key={option} type="button" className={`ui-focus min-h-ui-touch min-w-11 rounded-ui-control border-ui text-ui-meta font-ui-semibold ${mode === option ? 'border-ui-control bg-ui-surface text-ui-accent-strong shadow-ui-group' : 'border-transparent text-ui-accent hover:text-ui-accent-strong'}`}
          aria-label={`视图：${viewLabels[option]}`} aria-pressed={mode === option} onClick={() => choose(option)}>
          {option === 'today' ? '日' : option === 'week' ? '周' : '月'}
        </button>
      ))}
    </div>
  );
}

export function CalendarDateNavigation({ selectedDate, viewMode, onSelectedDateChange, today = new Date() }: {
  selectedDate: Date;
  viewMode: ViewMode;
  onSelectedDateChange: (date: Date) => void;
  today?: Date;
}) {
  const currentPeriodLabel = viewMode === 'today' ? '回到今天' : viewMode === 'week' ? '回到本周' : '回到本月';
  const navigate = (direction: -1 | 1) => onSelectedDateChange(navigateCalendarPeriod(selectedDate, viewMode, direction));
  return (
    <div className="ui-calendar-date-navigation mt-ui-2 flex items-center justify-between gap-ui-2">
      <button className="ui-focus grid h-11 w-11 shrink-0 place-items-center rounded-ui-control bg-ui-surface text-ui-accent" type="button" onClick={() => navigate(-1)} aria-label="上一段">
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <button className="ui-focus min-h-ui-touch rounded-ui-control bg-ui-surface px-ui-4 text-ui-meta font-ui-semibold text-ui-text" type="button" onClick={() => onSelectedDateChange(today)} aria-label={currentPeriodLabel}>
        {currentPeriodLabel}
      </button>
      <button className="ui-focus grid h-11 w-11 shrink-0 place-items-center rounded-ui-control bg-ui-surface text-ui-accent" type="button" onClick={() => navigate(1)} aria-label="下一段">
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

export function CurrentSpaceApp({ swipeClickGuard, session, spaces, allSpaces, importantDatesEntry = null, initialCalendarEvents, onCalendarEventsValidated, onCalendarEventsInvalidate, initialCalendarImportantDates, onCalendarImportantDatesValidated, onCalendarImportantDatesInvalidate, calendarFilter, onCalendarFilterChange, selectedDate, onSelectedDateChange, viewMode, onViewModeChange }: {
  session: Session;
  spaces: CurrentSpace[];
  allSpaces: CurrentSpace[];
  swipeClickGuard?: SwipeClickGuard;
  importantDatesEntry?: ModuleEntry | null;
  initialCalendarEvents?: CalendarEventsSnapshot;
  onCalendarEventsValidated?: (data: CalendarEventsSnapshot) => void;
  onCalendarEventsInvalidate?: () => void;
  initialCalendarImportantDates?: CalendarImportantDatesSnapshot;
  onCalendarImportantDatesValidated?: (data: CalendarImportantDatesSnapshot) => void;
  onCalendarImportantDatesInvalidate?: () => void;
  calendarFilter: CalendarFilter;
  onCalendarFilterChange: (filter: CalendarFilter) => void;
  selectedDate: Date;
  onSelectedDateChange: (date: Date) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const userId = session.user.id;
  const eventView = useCalendarEvents(userId, allSpaces, spaces, calendarFilter, viewMode, selectedDate,
    { initialData: initialCalendarEvents, onValidated: onCalendarEventsValidated, onInvalidate: onCalendarEventsInvalidate });
  const calendarStatus = eventView.status;
  const [calendarError, setCalendarError] = useState('');
  const [eventNotice, setEventNotice] = useState('');
  const eventOpening = useRef(createRequestGuard());
  const createGuard = useRef(createRequestGuard());
  const eventContext = useRef('');
  const creatingEvent = useRef(false);
  const createTargetId = useRef('');
  const contextKey = calendarEventViewKey(calendarEventScopeKey(userId, allSpaces, spaces, calendarFilter), viewMode, selectedDate);
  if (eventContext.current !== contextKey) { eventOpening.current.invalidate(); createGuard.current.invalidate(); creatingEvent.current = false; eventContext.current = contextKey; }
  const [editingTarget, setEditingTarget] = useState<EventEditTarget | null>(null);
  const [newEventTarget, setNewEventTarget] = useState<{ space: CurrentSpace; members: SpaceMember[]; spaces: CurrentSpace[]; state: CreateTargetControl['state']; error: string; selectedId: string; contextKey: string } | null>(null);
  const showNewEvent = newEventTarget?.contextKey === contextKey;
  const createBusy = showNewEvent && newEventTarget.state === 'loading';
  const [monthPopoverRequest, setMonthPopoverRequest] = useState<{ dateKey: string; contextKey: string } | null>(null);
  const [openCalendarSelector, setOpenCalendarSelector] = useState<'space' | 'view' | null>(null);
  const importantDates = useCalendarImportantDates(userId, allSpaces, spaces, viewMode, selectedDate, importantDatesEntry, calendarFilter === 'all' ? 'all' : calendarFilter.spaceId,
    { initialData: initialCalendarImportantDates, onValidated: onCalendarImportantDatesValidated, onInvalidate: onCalendarImportantDatesInvalidate });

  const calendarSwipe = useMobileSwipe({
    enabled: !openCalendarSelector && !createBusy && !editingTarget && !showNewEvent && !importantDates.editor.editor
      && !importantDates.editor.deleting && !importantDates.editor.busy && !importantDates.editor.targetRead.loading,
    scope: contextKey, direction: 'both', clickGuard: swipeClickGuard,
    onSwipe: (direction) => onSelectedDateChange(navigateCalendarPeriod(selectedDate, viewMode, direction === 'right' ? -1 : 1)),
  });

  const sheetSpace = editingTarget
    ? allSpaces.find((item) => item.id === editingTarget.event.space_id) ?? null
    : showNewEvent ? newEventTarget.space : null;
  const sheetMembers = editingTarget && sheetSpace ? eventView.membersBySpaceId[sheetSpace.id] ?? [] : showNewEvent ? newEventTarget.members : [];
  const sheetPartner = sheetMembers.find((member) => member.user_id !== userId) ?? null;
  const visibleExpansion = { occurrences: eventView.presentation?.items ?? [], errors: [] };
  useEffect(() => () => { eventOpening.current.invalidate(); createGuard.current.invalidate(); }, []);
  useEffect(() => {
    if (monthPopoverRequest && monthPopoverRequest.contextKey !== contextKey) setMonthPopoverRequest(null);
  }, [contextKey, monthPopoverRequest]);
  useEffect(() => { setNewEventTarget(null); setEditingTarget(null); setEventNotice(''); setCalendarError(''); }, [contextKey]);

  useEffect(() => {
    if (!openCalendarSelector) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (!event.isComposing && event.keyCode !== 229 && event.key === 'Escape') setOpenCalendarSelector(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [openCalendarSelector]);

  async function openEvent(row: CalendarEventPresentation) {
    importantDates.editor.close(); createGuard.current.invalidate(); setNewEventTarget(null);
    const request = eventOpening.current.begin();
    setEventNotice(calendarStatus === 'loading' ? '正在确认日程…' : '');
    const fresh = await eventView.qualify(row);
    if (!eventOpening.current.isCurrent(request) || eventContext.current !== contextKey || eventView.authLost) return;
    if (!fresh?.isCurrent()) { setEventNotice('日程已变化或暂时无法确认，请刷新后重试。'); return; }
    setEventNotice('');
    setEditingTarget(fresh.occurrence.source_event.recurrence_rule === null
      ? eventEditTargetForEvent(fresh.occurrence.source_event) : eventEditTargetForOccurrence(fresh.occurrence));
  }

  async function verifiedCreateSpace(spaceId: string, relatedUserId?: string | null) {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId) throw new Error('登录状态已变化，请重新登录。');
    const listed = await listCurrentSpaces(userId);
    const space = listed.find((item) => item.id === spaceId && (item.kind === 'shared' || item.created_by === userId));
    if (!space?.id) throw new Error('此空间已不在你的成员列表中，请重新选择。');
    const members = await readSpaceMembers(space.id);
    if (!targetMembersValid(members, space.id, userId, relatedUserId)) throw new Error('空间成员资料已变化，请重试。');
    const current = await supabase.auth.getUser();
    if (current.error || current.data.user?.id !== userId) throw new Error('登录状态已变化，请重新登录。');
    return { space, members, listed };
  }

  async function verifyCreateTarget(spaceId: string, relatedUserId?: string | null) {
    const request = createGuard.current.begin();
    try {
      await verifiedCreateSpace(spaceId, relatedUserId);
      return createGuard.current.isCurrent(request) && eventContext.current === contextKey && createTargetId.current === spaceId;
    } catch { return false; }
  }

  function cancelCreate() {
    createGuard.current.invalidate(); creatingEvent.current = false; createTargetId.current = '';
    setNewEventTarget(null);
  }

  async function loadCreateTarget(spaceId: string) {
    createTargetId.current = spaceId;
    const request = createGuard.current.begin();
    const isCurrent = () => createGuard.current.isCurrent(request) && eventContext.current === contextKey && createTargetId.current === spaceId;
    setNewEventTarget((current) => current && ({ ...current, selectedId: spaceId, state: 'loading', error: '' }));
    try {
      const target = await verifiedCreateSpace(spaceId);
      const listed = target.listed.filter((item) => item.id && (item.kind === 'shared' || item.created_by === userId));
      if (!listed.some((item) => item.id === spaceId)) throw new Error('此空间已不在你的成员列表中，请重新选择。');
      if (isCurrent()) setNewEventTarget((current) => current && ({ ...current, ...target, spaces: listed, state: 'ready', error: '' }));
    } catch (error) {
      if (isCurrent()) setNewEventTarget((current) => current && ({ ...current, members: [], state: 'error', error: getErrorMessage(error) }));
    }
  }

  function openNewEvent() {
    if (creatingEvent.current || showNewEvent || eventView.authLost) return;
    const choices = allSpaces.filter((item) => item.id && (item.kind === 'shared' || item.created_by === userId));
    const initial = calendarFilter === 'all' ? choices.find((item) => item.kind === 'personal') : choices.find((item) => item.id === calendarFilter.spaceId);
    const anchor = initial ?? choices[0];
    if (!anchor) { setCalendarError('没有可用空间，暂时无法创建日程。'); return; }
    creatingEvent.current = true; setCalendarError('');
    eventOpening.current.invalidate(); importantDates.editor.close(); setEditingTarget(null);
    createTargetId.current = initial?.id ?? '';
    setNewEventTarget({ space: anchor, members: [], spaces: choices, selectedId: initial?.id ?? '', contextKey,
      state: initial ? 'loading' : 'error', error: initial ? '' : '默认空间不可用，请选择合法的保存空间。' });
    if (initial) void loadCreateTarget(initial.id);
  }

  const calendarCreateTarget: CreateTargetControl | undefined = showNewEvent ? {
    spaces: newEventTarget.spaces, selectedId: newEventTarget.selectedId, state: newEventTarget.state, error: newEventTarget.error,
    onSelect: (id) => { if (newEventTarget.spaces.some((item) => item.id === id)) void loadCreateTarget(id); },
    onRetry: () => { if (createTargetId.current) void loadCreateTarget(createTargetId.current); },
  } : undefined;

  const weekStart = startOfWeek(selectedDate);
  const weekEnd = addDays(weekStart, 6);
  const crossesYear = weekStart.getFullYear() !== weekEnd.getFullYear();
  const dateSubtitle = viewMode === 'today' ? `${selectedDate.getFullYear()}年${formatDay(selectedDate)}`
    : viewMode === 'week' ? `${weekStart.getFullYear()}年${weekStart.getMonth() + 1}月${weekStart.getDate()}日 — ${crossesYear ? `${weekEnd.getFullYear()}年` : ''}${weekEnd.getMonth() + 1}月${weekEnd.getDate()}日`
    : formatMonth(selectedDate);

  return (
    <main {...calendarSwipe} className="ui-calendar-shell min-h-screen bg-ui-page text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
        <header className="ui-calendar-header sticky top-0 z-10 border-b border-ui-border bg-ui-page/95 px-ui-4 pb-ui-3 pt-ui-4 font-ui text-ui-text backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-ui-page-title">日历</h1>
            <div className="flex items-center gap-2">
              <button className="ui-focus grid h-11 w-11 shrink-0 place-items-center text-ui-accent disabled:text-ui-muted" type="button" disabled={createBusy || showNewEvent || eventView.authLost || allSpaces.length === 0} onClick={() => void openNewEvent()} aria-label="新建日程">
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <p className="ui-calendar-subtitle mt-ui-1 break-words text-ui-meta text-ui-muted">{dateSubtitle}</p>

          <div className="ui-calendar-controls mt-ui-3 grid w-full items-center gap-ui-2">
            <div className="min-w-0">
              <CalendarFilterPicker spaces={allSpaces} filter={calendarFilter} open={openCalendarSelector === 'space'} onOpen={() => setOpenCalendarSelector('space')} onClose={() => setOpenCalendarSelector(null)} onSelect={onCalendarFilterChange} />
            </div>
            <div className="min-w-0">
              <CalendarViewPicker mode={viewMode} open={openCalendarSelector === 'view'} onOpen={() => setOpenCalendarSelector('view')} onClose={() => setOpenCalendarSelector(null)} onSelect={onViewModeChange} />
            </div>
          </div>

          <CalendarDateNavigation selectedDate={selectedDate} viewMode={viewMode} onSelectedDateChange={onSelectedDateChange} />
        </header>

        <section className={`flex-1 px-4 py-4 safe-bottom ${viewMode === 'month' ? 'ui-month-content' : ''}`}>
          {allSpaces.length === 0 && <p role="status" className="font-ui text-ui-meta text-ui-muted">没有可用空间，暂时无法创建日程。</p>}
          {createBusy && <p role="status" className="font-ui text-ui-meta text-ui-muted">正在确认保存空间…</p>}
          {eventView.syncError && <Notice ui={viewMode !== 'month'} tone="error" message={eventView.syncError} />}
          {calendarStatus === 'loading' && !eventView.presentation && <p role="status" className={viewMode === 'month' ? undefined : 'font-ui text-ui-meta text-ui-muted'}>正在读取日程…</p>}
          {eventNotice && <p role="status" className={viewMode === 'month' ? 'text-sm text-ink/60' : 'font-ui text-ui-meta text-ui-muted'}>{eventNotice}</p>}
          {calendarError && <Notice ui={viewMode !== 'month'} tone="error" message={calendarError} />}
          {calendarStatus === 'error' && <div role="alert"><Notice ui={viewMode !== 'month'} tone="error" message={eventView.error || eventView.syncError || '日历读取失败，请重试。'} /><button type="button" className={viewMode === 'month' ? 'min-h-11 rounded-lg bg-teal px-4 font-semibold text-white' : 'ui-focus min-h-ui-touch rounded-ui-control bg-ui-accent px-ui-4 font-ui text-ui-meta text-ui-on-accent'} onClick={eventView.retry}>重试</button></div>}
          {viewMode === 'month' ? <CalendarImportantDateStatus interaction={importantDates} /> : <div className="ui-calendar-status font-ui"><CalendarImportantDateStatus interaction={importantDates} /></div>}
          {(eventView.presentation || importantDates.items.length > 0) && <CalendarViews
            monthContextKey={contextKey}
            initialMonthPopoverDate={monthPopoverRequest?.contextKey === contextKey ? monthPopoverRequest.dateKey : null}
            onMonthPopoverClose={() => setMonthPopoverRequest(null)}
            expansion={visibleExpansion}
            importantDates={importantDates.items}
            importantDatesComplete={importantDates.state.calendarComplete === true}
            onOpenImportantDate={(item) => {
              eventOpening.current.invalidate(); setEventNotice(''); createGuard.current.invalidate(); setNewEventTarget(null); setEditingTarget(null);
              importantDates.open(item);
            }}
            membersBySpaceId={eventView.presentation?.membersBySpaceId ?? {}}
            spacesById={Object.fromEntries(allSpaces.map((item) => [item.id, item]))}
            showSpaceLabel={calendarFilter === 'all'}
            selectedDate={selectedDate}
            viewMode={viewMode}
            userId={userId}
            onEdit={(occurrence) => { void openEvent(occurrence); }}
            onSelectDate={(day) => {
              setMonthPopoverRequest({ dateKey: toDateInputValue(day).slice(0, 10), contextKey: calendarEventViewKey(calendarEventScopeKey(userId, allSpaces, spaces, calendarFilter), 'month', day) });
              onSelectedDateChange(day);
            }}
          />}
        </section>
      </div>

      <CalendarImportantDateSheets interaction={importantDates} />
      {(showNewEvent || editingTarget) && !eventView.authLost && sheetSpace && (showNewEvent || sheetMembers.length > 0) && (
        <EventSheet
          target={editingTarget}
          createTarget={calendarCreateTarget}
          space={sheetSpace}
          userId={userId}
          members={sheetMembers}
          partnerId={sheetPartner?.user_id ?? null}
          onClose={() => {
            eventOpening.current.invalidate();
            cancelCreate();
            setEditingTarget(null);
          }}
          onSaved={eventView.refresh}
          validateCreateTarget={(ownerId) => verifyCreateTarget(sheetSpace.id, ownerId)}
          showSourceSpace={calendarFilter === 'all'}
        />
      )}

    </main>
  );
}

function Notice({ tone, message, ui = false }: { tone: 'error' | 'success'; message: string; ui?: boolean }) {
  return (
    <p className={ui ? `mb-ui-3 rounded-ui-control px-ui-3 py-ui-3 font-ui text-ui-meta ${tone === 'error' ? 'bg-ui-danger-soft text-ui-danger' : 'bg-ui-success-soft text-ui-success'}` : `mb-4 rounded-lg px-4 py-3 text-sm ${tone === 'error' ? 'bg-ui-danger-soft text-ui-danger' : 'bg-teal/10 text-teal'}`}>
      {message}
    </p>
  );
}

export function BottomNavigation({ tab, onChange, disabled = false }: { tab: TopLevelTab; onChange: (tab: TopLevelTab) => void; disabled?: boolean }) {
  const tabs = [
    { id: 'home', label: '首页', Icon: House },
    { id: 'calendar', label: '日历', Icon: CalendarDays },
    { id: 'modules', label: '功能中心', Icon: LayoutGrid },
    { id: 'me', label: '我的', Icon: UserRound },
  ] as const;
  return (
    <nav className="ui-bottom-nav fixed inset-x-0 bottom-0 z-10 border-t border-ui-border bg-ui-surface font-ui" aria-label="一级导航">
      <div className="mx-auto grid max-w-3xl grid-cols-4">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} type="button" className={`ui-focus flex h-12 min-h-12 flex-col items-center justify-center gap-ui-1 px-ui-2 text-ui-label ${tab === id ? 'text-ui-accent' : 'text-ui-muted'}`} onClick={() => onChange(id)} disabled={disabled} aria-current={tab === id ? 'page' : undefined}>
            <Icon size={20} strokeWidth={tab === id ? 2.5 : 1.75} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function CalendarViews({
  expansion,
  monthContextKey,
  initialMonthPopoverDate = null,
  onMonthPopoverClose = () => undefined,
  importantDates = [],
  importantDatesComplete = true,
  onOpenImportantDate = () => undefined,
  membersBySpaceId,
  spacesById,
  showSpaceLabel,
  selectedDate,
  viewMode,
  userId,
  onEdit,
  onSelectDate,
}: {
  monthContextKey?: string;
  initialMonthPopoverDate?: string | null;
  onMonthPopoverClose?: () => void;
  expansion: { occurrences: CalendarEventPresentation[]; errors: Array<{ source_event_id: string; error: string }> };
  importantDates?: ImportantDateOccurrence[];
  importantDatesComplete?: boolean;
  onOpenImportantDate?: (item: ImportantDateOccurrence) => void;
  membersBySpaceId: Record<string, SpaceMember[]>;
  spacesById: Record<string, CurrentSpace>;
  showSpaceLabel: boolean;
  selectedDate: Date;
  viewMode: ViewMode;
  userId: string;
  onEdit: (occurrence: CalendarEventPresentation) => void;
  onSelectDate: (date: Date) => void;
}) {
  if (expansion.errors.length > 0) return <Notice tone="error" message="重复日程无法完整显示，请重试。" />;
  if (viewMode === 'month') {
    return (
      <>
        <MonthView key={monthContextKey} initialOpenDateKey={initialMonthPopoverDate} onPopoverClose={onMonthPopoverClose} importantDatesComplete={importantDatesComplete} importantDates={importantDates} onOpenImportantDate={onOpenImportantDate} occurrences={expansion.occurrences} membersBySpaceId={membersBySpaceId} spacesById={spacesById} showSpaceLabel={showSpaceLabel} selectedDate={selectedDate} userId={userId} onEdit={onEdit} onSelectDate={onSelectDate} />
      </>
    );
  }

  const days = viewMode === 'today' ? [selectedDate] : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDate), index));
  const spaceDotClasses = calendarSpaceDotClasses(Object.keys(spacesById));

  return (
    <div className={`font-ui text-ui-text ${viewMode === 'week' ? 'ui-calendar-week' : 'ui-calendar-day'}`}>
      {days.map((day) => {
        const dayOccurrences = sortOccurrences(expansion.occurrences.filter((occurrence) => occurrenceFallsOnDay(occurrence, day)));
        return (
          <DaySection key={day.toISOString()} variant={viewMode} spaceDotClasses={spaceDotClasses} importantDatesComplete={importantDatesComplete} day={day} importantDates={importantDates.filter((item) => importantDateFallsOnDay(item, day))} onOpenImportantDate={onOpenImportantDate} occurrences={dayOccurrences} membersBySpaceId={membersBySpaceId} spacesById={spacesById} showSpaceLabel={showSpaceLabel} userId={userId} onEdit={onEdit} />
        );
      })}
    </div>
  );
}

function MonthView({
  initialOpenDateKey = null,
  onPopoverClose = () => undefined,
  importantDatesComplete,
  importantDates,
  onOpenImportantDate,
  occurrences,
  membersBySpaceId,
  spacesById,
  showSpaceLabel,
  selectedDate,
  userId,
  onEdit,
  onSelectDate,
}: {
  importantDatesComplete: boolean;
  importantDates: ImportantDateOccurrence[];
  onOpenImportantDate: (item: ImportantDateOccurrence) => void;
  occurrences: CalendarEventPresentation[];
  membersBySpaceId: Record<string, SpaceMember[]>;
  spacesById: Record<string, CurrentSpace>;
  showSpaceLabel: boolean;
  selectedDate: Date;
  userId: string;
  onEdit: (occurrence: CalendarEventPresentation) => void;
  onSelectDate: (date: Date) => void;
  initialOpenDateKey?: string | null;
  onPopoverClose?: () => void;
}) {
  const monthStart = startOfMonth(selectedDate);
  const gridStart = startOfWeek(monthStart);
  const weekCount = Math.round((startOfWeek(endOfMonth(selectedDate)).getTime() - gridStart.getTime()) / (7 * 86400000)) + 1;
  const cells = Array.from({ length: weekCount * 7 }, (_, index) => addDays(gridStart, index));
  const spaceDotClasses = calendarSpaceDotClasses(Object.keys(spacesById));
  const selectedKey = toDateInputValue(selectedDate).slice(0, 10);
  const [openDateKey, setOpenDateKey] = useState<string | null>(initialOpenDateKey);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const popover = useRef<HTMLDivElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState({ left: 16, top: 200, maxHeight: 320, width: 288 });
  const open = openDateKey === selectedKey;
  const selectedOccurrences = sortOccurrences(occurrences.filter((occurrence) => occurrenceFallsOnDay(occurrence, selectedDate)));
  const selectedImportantDates = importantDates.filter((item) => importantDateFallsOnDay(item, selectedDate));

  function closePopover(restoreFocus = false) {
    setOpenDateKey(null);
    onPopoverClose();
    if (restoreFocus) anchor.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (openDateKey && openDateKey !== selectedKey) setOpenDateKey(null);
  }, [selectedKey, openDateKey]);

  useEffect(() => {
    if (!open) return;
    function placePopover() {
      anchor.current ??= popover.current?.parentElement?.querySelector<HTMLButtonElement>(`[data-month-date="${selectedKey}"]`) ?? null;
      if (!anchor.current || !popover.current) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const headerBottom = anchor.current.closest('main')?.querySelector('header')?.getBoundingClientRect().bottom ?? viewportTop;
      const minTop = Math.max(viewportTop + 12, headerBottom + 8);
      const navTop = document.querySelector('.ui-bottom-nav')?.getBoundingClientRect().top ?? viewportTop + height - 64;
      const bottom = Math.min(viewportTop + height - 16, navTop - 16);
      const maxHeight = Math.max(44, Math.min(416, bottom - minTop));
      const rect = anchor.current.getBoundingClientRect();
      const bounds = popover.current.getBoundingClientRect();
      const left = Math.max(16, Math.min(rect.left + rect.width / 2 - bounds.width / 2, width - bounds.width - 16));
      const preferredTop = rect.bottom + 8 + bounds.height <= bottom ? rect.bottom + 8 : rect.top - bounds.height - 8;
      const top = Math.max(minTop, Math.min(preferredTop, bottom - Math.min(bounds.height, maxHeight)));
      setPosition({ left, top, maxHeight, width: Math.min(360, width - 32) });
    }
    const outside = (event: PointerEvent) => {
      if (!popover.current?.contains(event.target as Node)) closePopover();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePopover(true); }
    };
    const focusOutside = (event: FocusEvent) => {
      if (!popover.current?.contains(event.target as Node) && event.target !== anchor.current) closePopover();
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(placePopover);
    if (popover.current) observer?.observe(popover.current);
    placePopover();
    closeButton.current?.focus({ preventScroll: true });
    window.addEventListener('resize', placePopover);
    window.addEventListener('scroll', placePopover, true);
    window.visualViewport?.addEventListener('resize', placePopover);
    window.visualViewport?.addEventListener('scroll', placePopover);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    document.addEventListener('focusin', focusOutside);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', placePopover);
      window.removeEventListener('scroll', placePopover, true);
      window.visualViewport?.removeEventListener('resize', placePopover);
      window.visualViewport?.removeEventListener('scroll', placePopover);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('focusin', focusOutside);
    };
  }, [openDateKey, open]);

  return (
    <div className="ui-calendar-month font-ui text-ui-text">
      <section className="rounded-ui-group bg-ui-surface p-ui-2 shadow-ui-group" aria-label={formatMonth(selectedDate)}>
        <div className="grid grid-cols-7 py-ui-2 text-center text-ui-label text-ui-muted" aria-hidden="true">
          {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="ui-month-grid grid grid-cols-7 gap-1">
          {cells.map((day) => {
            const dayOccurrences = sortOccurrences(occurrences.filter((occurrence) => occurrenceFallsOnDay(occurrence, day)));
            const dateItems = importantDates.filter((item) => importantDateFallsOnDay(item, day));
            const items = [
              ...dateItems.map((item) => ({ key: importantDateOccurrenceKey(item), title: item.name, spaceId: item.spaceId })),
              ...dayOccurrences.map((item) => ({ key: item.occurrence_id, title: item.title, spaceId: item.source_event.space_id })),
            ];
            const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const dayKey = toDateInputValue(day).slice(0, 10);
            return (
              <button
                key={dayKey}
                data-month-date={dayKey}
                data-swipe-start
                type="button"
                aria-label={`${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}，${dayOccurrences.length} 个日程，${importantDatesComplete ? `${dateItems.length} 个重要日` : '重要日尚未完整确认'}`}
                aria-current={isToday ? 'date' : undefined}
                aria-expanded={open && isSelected}
                aria-controls={open && isSelected ? 'calendar-date-popover' : undefined}
                aria-haspopup="dialog"
                className={`ui-month-cell ui-focus min-h-ui-touch w-full min-w-0 rounded-ui-control text-left ${isSelected ? 'ui-month-selected' : ''} ${isCurrentMonth ? 'ui-month-current' : 'ui-month-outside'}`}
                onClick={(event) => {
                  anchor.current = event.currentTarget;
                  setOpenDateKey(dayKey);
                  onSelectDate(day);
                }}
              >
                <span className={`ui-month-number ${isToday ? 'ui-month-today' : ''}`}>{day.getDate()}</span>
                <span className="mt-ui-1 block min-w-0" aria-hidden="true">
                  {items.slice(0, 2).map((item) => <span key={item.key} data-month-item={item.key} className="ui-month-item">
                    <span className={`ui-month-dot ${spaceDotClasses[item.spaceId] ?? 'ui-calendar-space-green'}`} />
                    <span className="min-w-0 truncate text-ui-text">{item.title}</span>
                  </span>)}
                  {items.length > 2 && <span data-month-more className="block text-ui-label-small text-ui-muted" aria-label={`还有 ${items.length - 2} 项事项`}>+{items.length - 2}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      {open && <div ref={popover} id="calendar-date-popover" role="dialog" aria-labelledby="calendar-date-popover-title" data-no-swipe
        className="ui-month-popover fixed z-20 flex flex-col rounded-ui-sheet border border-ui-border bg-ui-surface text-ui-text shadow-ui-sheet"
        style={position}>
        <div className="flex shrink-0 items-center justify-between gap-ui-2 px-ui-4 py-ui-2">
          <h2 id="calendar-date-popover-title" className="min-w-0 text-ui-bar">{formatDay(selectedDate)}</h2>
          <button ref={closeButton} type="button" className="ui-focus grid h-11 w-11 shrink-0 place-items-center rounded-ui-control text-ui-muted" aria-label="关闭日期详情" onClick={() => closePopover(true)}><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="ui-month-popover-body min-h-0 overflow-y-auto overscroll-contain px-ui-4 pb-ui-4">
          <DaySection variant="month" spaceDotClasses={spaceDotClasses} importantDatesComplete={importantDatesComplete} day={selectedDate}
            importantDates={selectedImportantDates} onOpenImportantDate={(item) => { closePopover(true); onOpenImportantDate(item); }}
            occurrences={selectedOccurrences} membersBySpaceId={membersBySpaceId} spacesById={spacesById} showSpaceLabel userId={userId}
            onEdit={(item) => { closePopover(true); onEdit(item); }} />
        </div>
      </div>}
    </div>
  );
}

// Deterministic for the complete membership set, regardless of filter or read order.
// Membership changes can reassign collisions; without persistence this is not permanent identity.
export function calendarSpaceDotClasses(spaceIds: string[]): Record<string, string> {
  const palette = ['ui-calendar-space-green', 'ui-calendar-space-blue', 'ui-calendar-space-orange', 'ui-calendar-space-purple', 'ui-calendar-space-rose', 'ui-calendar-space-cyan'];
  const used = new Set<number>();
  const assignments: Record<string, string> = {};
  for (const id of [...new Set(spaceIds)].sort()) {
    const hash = Array.from(id).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
    let index = hash % palette.length;
    if (used.size < palette.length) {
      while (used.has(index)) index = (index + 1) % palette.length;
    }
    used.add(index);
    assignments[id] = palette[index];
  }
  return assignments;
}

function DaySection({ variant, spaceDotClasses = {}, day, importantDatesComplete, importantDates, onOpenImportantDate, occurrences, membersBySpaceId, spacesById, showSpaceLabel, userId, onEdit }: { variant?: 'today' | 'week' | 'month'; spaceDotClasses?: Record<string, string>; day: Date; importantDatesComplete: boolean; importantDates: ImportantDateOccurrence[]; onOpenImportantDate: (item: ImportantDateOccurrence) => void; occurrences: CalendarEventPresentation[]; membersBySpaceId: Record<string, SpaceMember[]>; spacesById: Record<string, CurrentSpace>; showSpaceLabel: boolean; userId: string; onEdit: (occurrence: CalendarEventPresentation) => void }) {
  if (variant) {
    const empty = occurrences.length === 0 && importantDates.length === 0;
    const content = <>
      {(variant !== 'week' || empty) && <div className="mb-ui-2">
        {variant !== 'month' && variant !== 'week' && <h2 className={variant === 'today' ? 'sr-only' : 'text-ui-bar'}>{formatDay(day)}</h2>}
        {empty && <p className={variant === 'week' ? 'text-ui-meta text-ui-muted' : 'py-ui-6 text-ui-meta text-ui-muted'}>{importantDatesComplete ? '暂无日程' : '重要日尚未完整确认'}</p>}
      </div>}
      {!empty && <>
        {(variant !== 'week' || importantDates.length > 0) && <div className="space-y-ui-2">
          {importantDates.map((item) => <div key={importantDateOccurrenceKey(item)} className={`ui-calendar-important-date mb-ui-2 ${spaceDotClasses[item.spaceId] ?? 'ui-calendar-space-green'}`}>
            <CalendarImportantDateCard item={item} space={spacesById[item.spaceId]} showSpaceLabel={showSpaceLabel} onOpen={onOpenImportantDate} />
          </div>)}
        </div>}
        <div className={variant === 'today' ? 'ui-calendar-timeline space-y-ui-3' : 'space-y-ui-2'}>
          {occurrences.map((occurrence) => <EventCard key={occurrence.occurrence_id} variant={variant} spaceDotClasses={spaceDotClasses} occurrence={occurrence} members={membersBySpaceId[occurrence.source_event.space_id] ?? []} sourceSpace={spacesById[occurrence.source_event.space_id]} showSpaceLabel={showSpaceLabel} userId={userId} onEdit={onEdit} />)}
        </div>
      </>}
    </>;
    return <section data-calendar-day={toDateInputValue(day).slice(0, 10)} className={variant === 'week' ? 'ui-week-day' : undefined} aria-label={variant === 'week' ? formatDay(day) : undefined}>
      {variant === 'week' && <h2 className={`ui-week-date ${isSameDay(day, new Date()) ? 'ui-week-today' : day.getDay() === 0 ? 'ui-week-sunday' : ''}`}>
        <time dateTime={toDateInputValue(day).slice(0, 10)} aria-current={isSameDay(day, new Date()) ? 'date' : undefined}>
          <span className="ui-week-number">{day.getDate()}</span>
          <span className="block text-ui-label font-ui-medium">{['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day.getDay()]}</span>
        </time>
      </h2>}
      {variant === 'week' ? <div className="ui-week-content min-w-0">{content}</div> : content}
    </section>;
  }
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-ink/60">{formatDay(day)}</h2>
      {occurrences.length === 0 && importantDates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 bg-white px-4 py-6 text-center text-sm text-ink/45">{importantDatesComplete ? '这天还没有日程' : '重要日尚未完整确认'}</div>
      ) : (
        <div className="space-y-2">
          {importantDates.map((item) => <CalendarImportantDateCard key={importantDateOccurrenceKey(item)} item={item} space={spacesById[item.spaceId]} showSpaceLabel={showSpaceLabel} onOpen={onOpenImportantDate} />)}
          {occurrences.map((occurrence) => (
            <EventCard key={occurrence.occurrence_id} occurrence={occurrence} members={membersBySpaceId[occurrence.source_event.space_id] ?? []} sourceSpace={spacesById[occurrence.source_event.space_id]} showSpaceLabel={showSpaceLabel} userId={userId} onEdit={onEdit} />
          ))}
        </div>
      )}
    </section>
  );
}

function EventCard({ variant, spaceDotClasses = {}, occurrence, members, sourceSpace, showSpaceLabel, userId, onEdit }: { variant?: 'today' | 'week' | 'month'; spaceDotClasses?: Record<string, string>; occurrence: CalendarEventPresentation; members: SpaceMember[]; sourceSpace: CurrentSpace; showSpaceLabel: boolean; userId: string; onEdit: (occurrence: CalendarEventPresentation) => void }) {
  const event = occurrence.source_event;
  const audience = audienceFromEvent(event, userId);

  if (variant) {
    const crossesDate = occurrence.occurrence_ends_at && !isSameDay(new Date(occurrence.occurrence_starts_at), new Date(occurrence.occurrence_ends_at));
    return <button data-swipe-start data-calendar-event-id={occurrence.occurrence_id} type="button" className="ui-calendar-event ui-focus min-h-ui-touch w-full min-w-0 text-left" onClick={() => onEdit(occurrence)}>
      <span className={`ui-calendar-time pt-ui-2 text-ui-list font-ui-semibold ${spaceDotClasses[event.space_id] ?? 'ui-calendar-space-green'}`}>
        <span className="block text-ui-text">{formatTime(occurrence.occurrence_starts_at, occurrence.all_day)}</span>
        {occurrence.occurrence_ends_at && !occurrence.all_day && <span className="mt-ui-1 block text-ui-label text-ui-muted">{formatTime(occurrence.occurrence_ends_at, false)}</span>}
      </span>
      <span className="ui-calendar-event-content min-w-0 py-ui-2">
        <span className="flex min-w-0 items-start gap-ui-2"><span className="min-w-0 flex-1 break-words text-ui-list font-ui-semibold text-ui-text line-clamp-2">{occurrence.title}</span>{variant === 'month' && <ChevronRight size={16} className="mt-ui-1 shrink-0 text-ui-muted" aria-hidden="true" />}</span>
        {occurrence.description && <span className="mt-ui-1 block break-words text-ui-meta text-ui-muted line-clamp-2">{occurrence.description}</span>}
        {crossesDate && <span className="mt-ui-1 block break-words text-ui-label text-ui-muted">跨日期 · {formatDay(new Date(occurrence.occurrence_starts_at))} — {formatDay(new Date(occurrence.occurrence_ends_at!))}</span>}
        <span className="mt-ui-1 flex flex-wrap gap-x-ui-2 text-ui-label text-ui-muted">
          <span className="min-w-0 break-words">{eventAudienceLabel(event, members)}</span>
          {showSpaceLabel && <span className="min-w-0 break-words">{spaceLabel(sourceSpace)}</span>}
        </span>
      </span>
    </button>;
  }
  return (
    <button data-swipe-start type="button" className={`w-full rounded-lg border-l-4 bg-white p-4 text-left shadow-sm ${audienceClass(audience)}`} onClick={() => onEdit(occurrence)}>
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

export type EventSheetProps = {
  target: EventEditTarget | null;
  space: Space;
  userId: string;
  members: SpaceMember[];
  partnerId: string | null;
  onClose: () => void;
  onSaved: () => void;
  validateCreateTarget: (ownerUserId?: string | null) => Promise<boolean>;
  createTarget?: CreateTargetControl;
  showSourceSpace?: boolean;
  sourceSpaceLabel?: string;
};

export function EventSheet({
  target,
  space,
  userId,
  members,
  partnerId,
  onClose,
  onSaved,
  validateCreateTarget,
  createTarget,
  showSourceSpace = false,
  sourceSpaceLabel,
}: EventSheetProps) {
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
  const [confirmingCreateTargetId, setConfirmingCreateTargetId] = useState<string | null>(null);
  const submitLock = useRef(createSubmitLock());
  const previousCreateSpaceId = useRef(space.id);
  const createHeading = useRef<HTMLHeadingElement>(null);
  const canChoosePartner = Boolean(partnerId);
  const canManage = !event || canManageEvent(event, userId);
  const editUi = eventEditUiState(target);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const keyboard = useRef({ busy, cancel: () => {} });
  const [pendingOccurrenceAction, setPendingOccurrenceAction] = useState<OccurrenceAction | null>(null);
  const createReady = !createTarget || canUseCreateTarget(createTarget.state, createTarget.selectedId, space.id, members, userId);

  useEffect(() => {
    if (!createTarget || previousCreateSpaceId.current === space.id) return;
    previousCreateSpaceId.current = space.id;
    setDraft(resetEventAudienceForTarget);
  }, [createTarget, space.id]);

  useEffect(() => { setConfirmingCreateTargetId(null); }, [createTarget?.selectedId, createTarget?.state, userId]);
  keyboard.current = { busy, cancel: () => {
    if (pendingOccurrenceAction) setPendingOccurrenceAction(null);
    else if (confirmingDelete) setConfirmingDelete(false);
    else if (confirmingCreateTargetId) setConfirmingCreateTargetId(null);
    else onClose();
  } };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = dialog.current;
    createHeading.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (!keyboard.current.busy) keyboard.current.cancel();
      }
      if (event.key !== 'Tab') return;
      const active = root?.querySelector<HTMLElement>('[data-event-scope-dialog]') ?? root;
      const controls = Array.from(active?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (!controls.includes(document.activeElement as HTMLElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
        if (!first) createHeading.current?.focus();
      }
    };
    root?.addEventListener('keydown', keydown);
    return () => { root?.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    if (!pendingOccurrenceAction && !confirmingDelete && !confirmingCreateTargetId) return;
    const previous = document.activeElement as HTMLElement | null;
    const scope = dialog.current?.querySelector<HTMLElement>('[data-event-scope-dialog]');
    if (scope) scope.querySelector<HTMLElement>('[data-confirm-cancel]')?.focus();
    else if (confirmingDelete || confirmingCreateTargetId) dialog.current?.querySelector<HTMLElement>('[data-confirm-cancel]')?.focus();
    return () => {
      if (previous?.isConnected && dialog.current?.contains(previous)) previous.focus();
      else if (dialog.current?.isConnected) createHeading.current?.focus();
    };
  }, [pendingOccurrenceAction, confirmingDelete, confirmingCreateTargetId]);

  useEffect(() => {
    const nextDraft = target ? draftFromEditTarget(target, draftFromEvent(target.event, userId), toDateInputValue) : emptyDraft();
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setEndManuallyEdited(Boolean(event));
    setError('');
    setBusy(false);
    setPendingOccurrenceAction(null);
    setConfirmingDelete(false);
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

  async function save(formEvent?: React.FormEvent, confirmed = false) {
    formEvent?.preventDefault();

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

    if (!event && createTarget) {
      if (!createReady) { setError('请先确认保存空间及成员。'); return; }
      if (!confirmed) { setConfirmingCreateTargetId(space.id); return; }
      if (!canConfirmCreate(confirmingCreateTargetId, createTarget.selectedId, space.id)) return;
    }

    if (!event && !submitLock.current.acquire()) return;
    setBusy(true);
    let createdSuccessfully = false;

    try {
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
          const identity = newEventIdentity(space.kind, saveDraft.audience, userId, partnerId);
          if (!await validateCreateTarget(identity.owner_user_id)) throw new Error('此空间已不在你的成员列表中，请重新选择。');
        } catch (targetError) {
          setBusy(false);
          const message = getErrorMessage(targetError);
          setError(createTarget && !/[\u3400-\u9fff]/.test(message) ? '无法确认保存空间及成员，请重试。' : message);
          setConfirmingCreateTargetId(null);
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
          ...newEventIdentity(space.kind, saveDraft.audience, userId, partnerId),
        });
      }

      if (result.error) {
        setBusy(false);
        setError(createTarget ? '保存失败，空间或成员权限可能已变化。请确认目标空间后重试。' : result.error.message);
        setConfirmingCreateTargetId(null);
        return;
      }

      createdSuccessfully = !event && Boolean(createTarget);
      completeSuccessfulMutation();
    } catch (saveError) {
      setBusy(false);
      setConfirmingCreateTargetId(null);
      setError(createTarget ? '保存失败，请确认目标空间及成员后重试。' : getErrorMessage(saveError));
    } finally {
      if (!event && !createdSuccessfully) submitLock.current.release();
    }
  }

  async function deleteEvent(confirmed = false) {
    if (!event || !canManage) {
      return;
    }

    if (target?.kind === 'occurrence') {
      setError('');
      setPendingOccurrenceAction('delete');
      return;
    }

    if (!confirmed) { setConfirmingDelete(true); return; }
    if (busy) return;
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
    <div ref={dialog} className="ui-event-sheet fixed inset-0 z-20 flex items-end bg-ink/35 font-ui text-ui-text md:items-center md:px-4 md:py-6">
      <div role="dialog" aria-modal="true" aria-labelledby="event-sheet-title" className="ui-event-sheet-panel mx-auto max-h-[92dvh] w-full max-w-3xl md:max-h-[calc(100dvh-3rem)]">
        <header className="ui-event-sheet-header">
          <button className="ui-focus grid h-11 w-11 place-items-center disabled:opacity-60" type="button" onClick={onClose} disabled={busy} aria-label="关闭">
            <X size={20} aria-hidden="true" />
          </button>
          <h2 id="event-sheet-title" ref={createHeading} tabIndex={-1} className="min-w-0 text-ui-bar">{event ? canManage ? editUi.isRecurringOccurrenceEdit ? '编辑此重复事件' : '编辑日程' : '日程详情' : '新建日程'}</h2>
          {canManage && <button className="ui-focus text-ui-accent text-ui-meta font-ui-semibold disabled:opacity-60" type="submit" form="event-sheet-form" disabled={busy || !createReady || confirmingDelete || Boolean(confirmingCreateTargetId) || Boolean(pendingOccurrenceAction)}>{busy ? '保存中' : '保存'}</button>}
        </header>
        <div className="ui-event-sheet-body">

        {error && <div className="mt-4"><Notice tone="error" message={error} /></div>}
        {event && showSourceSpace && <p className="mt-3 text-sm font-semibold text-teal">所属空间：{sourceSpaceLabel ?? spaceLabel(space)}</p>}
        {!event && (createTarget
          ? <div className="mt-4"><CreateTargetSelector control={{ ...createTarget, onSelect: (id) => { setDraft(resetEventAudienceForTarget); setConfirmingCreateTargetId(null); createTarget.onSelect(id); } }} kind="event" disabled={busy} /></div>
          : <p className="mt-3 text-sm font-semibold text-teal">保存到：{space.name}</p>)}

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
        ) : confirmingDelete && event ? (
          <div className="mt-5 space-y-4">
            <p className="break-words text-sm text-ink/70">确定删除「{event.title}」吗？删除后无法恢复。</p>
            <div className="flex gap-3">
              <button data-confirm-cancel className="h-12 flex-1 rounded-lg bg-mist font-semibold disabled:opacity-60" type="button" disabled={busy} onClick={() => setConfirmingDelete(false)}>取消</button>
              <button className="h-12 flex-1 rounded-lg bg-coral font-semibold text-white disabled:opacity-60" type="button" disabled={busy || !canManage} onClick={() => void deleteEvent(true)}>{busy ? '删除中' : '确认删除'}</button>
            </div>
          </div>
        ) : confirmingCreateTargetId && !event ? (
          <div className="mt-5 space-y-4">
            <h3 className="text-lg font-bold">确认保存？</h3>
            <p className="text-sm text-ink/70">将保存到：<strong className="block break-words text-base text-ink">{space.name}</strong></p>
            <div className="flex gap-3">
              <button data-confirm-cancel className="h-12 flex-1 rounded-lg bg-mist font-semibold" type="button" disabled={busy} onClick={() => setConfirmingCreateTargetId(null)}>取消</button>
              <button className="h-12 flex-1 rounded-lg bg-teal font-semibold text-white disabled:opacity-50" type="button" disabled={busy || !createReady} onClick={() => void save(undefined, true)}>{busy ? '保存中' : '确认保存'}</button>
            </div>
          </div>
        ) : (
          <form id="event-sheet-form" className="mt-5 space-y-4" onSubmit={save}>
          {editUi.isRecurringOccurrenceEdit ? (
            <p className="rounded-lg bg-teal/10 px-4 py-3 text-sm font-semibold text-teal">
              修改或删除时，可选择仅影响当前事件，或影响当前及未来事件。
            </p>
          ) : null}
          <Field label="标题">
            <input className="w-full rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal" required value={draft.title} onChange={(inputEvent) => setDraft({ ...draft, title: inputEvent.target.value })} />
          </Field>

          {space.kind === 'shared' && (!createTarget || createReady) && <Field label="归属">
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
          </div>
          </form>
        )}
        </div>
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
    <div className="fixed inset-0 z-30 flex items-end bg-ink/35 md:items-center md:px-4" data-event-scope-dialog role="dialog" aria-modal="true" aria-label={occurrenceActionCopy(action, 'only-this').title}>
      <section className="w-full rounded-t-2xl bg-white p-5 shadow-soft safe-bottom md:mx-auto md:max-w-md md:rounded-lg">
        <h3 className="text-lg font-bold text-ink">{occurrenceActionCopy(action, 'only-this').title}</h3>
        <div className="mt-4 space-y-2">
          {scopes.map((scope) => (
            <button key={scope} className={`h-12 w-full rounded-lg text-sm font-semibold disabled:opacity-60 ${action === 'delete' ? 'bg-coral/10 text-coral' : 'bg-teal/10 text-teal'}`} type="button" onClick={() => onSelect(scope)} disabled={busy}>
              {occurrenceActionCopy(action, scope).label}
            </button>
          ))}
        </div>
        <button data-confirm-cancel className="mt-3 h-12 w-full rounded-lg bg-mist text-sm font-semibold text-ink disabled:opacity-60" type="button" onClick={onCancel} disabled={busy}>
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
