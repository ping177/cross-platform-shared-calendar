import { useEffect, useRef, useState } from 'react';
import { BookOpen, CalendarHeart, ChevronRight, ListChecks, ListTodo } from 'lucide-react';
import { loadReviewEligibility } from '../lib/review-history-data';
import { loadImportantDatesEligibility } from '../lib/important-dates-data';
import { loadListsEligibility } from '../lib/lists-data';
import { loadTaskEligibility } from '../lib/aggregate-tasks-data';
import { createRequestGuard } from '../lib/request-guard';
import { applyModuleToggle, mergeModuleAvailability, type ModuleAvailability, type ModuleKey, type ModuleRead } from '../lib/module-availability';
import type { CurrentSpace } from '../types';
import { useModuleOverview } from './useModuleOverview';
import { pendingOverview, type ModuleOverview } from '../lib/module-overview';

export async function resolveHubEligibility(
  readTasks: () => Promise<{ eligibleSpaces: CurrentSpace[] }>,
  readReview: () => Promise<CurrentSpace[]>,
  readLists: () => Promise<{ eligibleSpaces: CurrentSpace[] }>,
  readImportantDates: () => Promise<{ eligibleSpaces: CurrentSpace[] }>,
): Promise<ModuleRead> {
  const [tasks, review, lists, importantDates] = await Promise.allSettled([readTasks(), readReview(), readLists(), readImportantDates()]);
  return {
    tasksIds: tasks.status === 'fulfilled' ? tasks.value.eligibleSpaces.map((space) => space.id) : null,
    reviewIds: review.status === 'fulfilled' ? review.value.map((space) => space.id) : null,
    listsIds: lists.status === 'fulfilled' ? lists.value.eligibleSpaces.map((space) => space.id) : null,
    importantDatesIds: importantDates.status === 'fulfilled' ? importantDates.value.eligibleSpaces.map((space) => space.id) : null,
  };
}

// CalendarApp owns this hook for the lifetime of one authenticated user session.
export function useModuleAvailability(userId: string, spaces: CurrentSpace[]) {
  const [availability, setAvailability] = useState<ModuleAvailability | null>(null);
  const [validatedSpacesKey, setValidatedSpacesKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const guard = useRef(createRequestGuard());
  const pending = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const spacesKey = spaces.map((space) => `${space.id}:${space.membershipRole}`).join(',');
  const latestSpacesKey = useRef(spacesKey);
  latestSpacesKey.current = spacesKey;
  function invalidate() {
    guard.current.invalidate();
    pending.current = null;
    setValidatedSpacesKey(null);
  }
  function refresh(force = false): Promise<void> {
    if (!force && pending.current?.key === spacesKey) return pending.current.promise;
    const request = guard.current.begin();
    setRefreshing(true);
    const operation = resolveHubEligibility(() => loadTaskEligibility(userId), () => loadReviewEligibility(userId), () => loadListsEligibility(userId), () => loadImportantDatesEligibility(userId)).then((read) => {
      if (!guard.current.isCurrent(request) || latestSpacesKey.current !== spacesKey) return;
      setAvailability((previous) => mergeModuleAvailability(previous, read));
      setValidatedSpacesKey(spacesKey);
      setRefreshing(false);
    });
    pending.current = { key: spacesKey, promise: operation };
    void operation.then(() => { if (pending.current?.promise === operation) pending.current = null; });
    return operation;
  }
  function moduleChanged(key: ModuleKey, spaceId: string, state: 'enabled' | 'disabled') {
    invalidate();
    setAvailability((previous) => applyModuleToggle(previous, key, spaceId, state));
    void refresh(true);
  }
  useEffect(() => {
    if (!spaces.length) return;
    void refresh();
    const onForeground = () => { if (document.visibilityState === 'visible') void refresh(); };
    const onOnline = () => { void refresh(); };
    window.addEventListener('focus', onForeground);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onForeground);
    return () => {
      window.removeEventListener('focus', onForeground);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onForeground);
      guard.current.invalidate();
      pending.current = null;
    };
  }, [userId, spacesKey]);
  return { availability, refreshing: refreshing || validatedSpacesKey !== spacesKey, refresh, invalidate, moduleChanged };
}

export function ModuleHub({ availability, onRefresh, onOpenTasks, onOpenReview, onOpenLists, onOpenImportantDates, userId, spaces = [], reviewSpaceId = null, availabilityPending = false }: {
  availability: ModuleAvailability | null; onRefresh: () => void;
  onOpenTasks: () => void; onOpenReview: () => void; onOpenLists: () => void; onOpenImportantDates: () => void;
  userId?: string; spaces?: CurrentSpace[]; reviewSpaceId?: string | null; availabilityPending?: boolean;
}) {
  const overview = useModuleOverview(userId && availability ? { userId, spaces, availability, reviewSpaceId } : null, availabilityPending);
  function retry() { onRefresh(); overview.retry(); }
  return <ModuleHubContent loading={availability === null} overview={overview.data} onRetryOverview={retry}
    tasksAvailable={(availability?.tasksIds?.length ?? 0) > 0} tasksError={availability?.tasksError ?? false}
    reviewAvailable={(availability?.reviewIds?.length ?? 0) > 0} reviewError={availability?.reviewError ?? false}
    listsAvailable={(availability?.listsIds?.length ?? 0) > 0} listsError={availability?.listsError ?? false}
    importantDatesAvailable={(availability?.importantDatesIds?.length ?? 0) > 0} importantDatesError={availability?.importantDatesError ?? false}
    onOpenImportantDates={onOpenImportantDates} onRetryImportantDates={retry}
    onOpenTasks={onOpenTasks} onOpenReview={onOpenReview} onOpenLists={onOpenLists}
    onRetryTasks={retry} onRetryReview={retry} onRetryLists={retry} />;
}

function overviewText(overview: ModuleOverview) {
  return {
    tasks: overview.tasks.state === 'ready' ? [overview.tasks.value + ' 项', ''] : null,
    lists: overview.lists.state === 'ready' ? [overview.lists.value + ' 个', ''] : null,
    review: overview.review.state === 'ready' ? [overview.review.value.date ?? '暂无回顾记录', overview.review.value.spaceName] : null,
    importantDates: overview.importantDates.state === 'ready' ? [overview.importantDates.value?.name ?? '暂无未来重要日', overview.importantDates.value?.date ?? ''] : null,
  };
}

export function ModuleHubContent({ loading, tasksAvailable, tasksError, reviewAvailable, reviewError, listsAvailable, listsError, onOpenTasks, onOpenReview, onOpenLists, onRetryTasks, onRetryReview, onRetryLists, importantDatesAvailable = false, importantDatesError = false, onOpenImportantDates, onRetryImportantDates, overview = pendingOverview(), onRetryOverview }: {
  loading: boolean; tasksAvailable: boolean; tasksError: boolean; reviewAvailable: boolean; reviewError: boolean;
  listsAvailable: boolean; listsError: boolean; importantDatesAvailable?: boolean; importantDatesError?: boolean;
  onOpenImportantDates?: () => void; onRetryImportantDates?: () => void;
  onOpenTasks: () => void; onOpenReview: () => void; onOpenLists: () => void;
  onRetryTasks: () => void; onRetryReview: () => void; onRetryLists: () => void;
  overview?: ModuleOverview; onRetryOverview?: () => void;
}) {
  const rows = [
    { key: 'tasks', title: '任务', description: '查看各空间的任务', Icon: ListTodo, available: tasksAvailable, error: tasksError, open: onOpenTasks, retry: onRetryTasks, color: 'text-ui-accent' },
    { key: 'review', title: '回顾', description: '查看空间的历史回顾', Icon: BookOpen, available: reviewAvailable, error: reviewError, open: onOpenReview, retry: onRetryReview, color: 'text-ui-auxiliary' },
    { key: 'lists', title: '清单', description: '查看各空间的清单', Icon: ListChecks, available: listsAvailable, error: listsError, open: onOpenLists, retry: onRetryLists, color: 'text-ui-accent' },
    { key: 'importantDates', title: '重要日', description: '查看各空间的重要日', Icon: CalendarHeart, available: importantDatesAvailable, error: importantDatesError, open: onOpenImportantDates, retry: onRetryImportantDates, color: 'text-ui-auxiliary' },
  ] as const;
  const text = overviewText(overview);
  return <main className="ui-module-hub mx-auto min-h-screen w-full max-w-3xl bg-ui-page px-ui-4 py-ui-6 font-ui text-ui-text safe-bottom">
    <h1 className="text-ui-page-title">功能中心</h1>
    <p className="mt-ui-1 text-ui-meta text-ui-muted">快速进入各项功能</p>
    <section aria-label="功能概览" aria-live="polite" className="mt-ui-6">
      <dl className="ui-module-overview grid grid-cols-2 overflow-hidden rounded-ui-group bg-ui-surface">
        {rows.map(({ key, Icon, available, error, color }) => {
          const state = loading ? 'loading' : error ? 'error' : !available ? 'unavailable' : overview[key].state;
          const value = state === 'ready' ? text[key]![0] : state === 'loading' ? '加载中…' : state === 'error' ? '读取失败' : '当前不可用';
          const detail = state === 'ready' ? text[key]![1] : state === 'unavailable' ? '暂无已开启的空间' : '';
          const name = { tasks: '未完成任务', review: '最近回顾', lists: '清单总数', importantDates: '下个重要日' }[key];
          return <div key={key} className="ui-module-metric min-w-0 text-left" data-overview-metric={key} data-overview-state={state}>
            <dt className="flex items-center gap-ui-2 text-ui-meta font-ui-medium"><Icon size={18} className={'shrink-0 ' + color} aria-hidden="true" />{name}</dt>
            <dd className="ui-module-metric-content mt-ui-2 w-full min-w-0"><span className="ui-module-metric-value font-ui-semibold" title={value}>{value}</span>{detail && <span className="block truncate text-ui-label text-ui-muted" title={detail}>{detail}</span>}</dd>
          </div>;
        })}
      </dl>
      {!loading && Object.values(overview).some(metric => metric.state === 'error') && <button type="button" onClick={onRetryOverview} className="ui-focus mt-ui-3 min-h-ui-touch text-ui-meta font-ui-semibold text-ui-accent">重试概览</button>}
    </section>
    {loading ? <p className="mt-ui-6 text-ui-meta text-ui-muted" role="status">正在读取功能模块…</p> : <>
      {rows.some(row => row.available) && <nav aria-label="功能模块" className="mt-ui-6 overflow-hidden rounded-ui-group border border-ui-border bg-ui-surface">
        {rows.filter(row => row.available).map(({ key, title, description, Icon, open, color }) => <button key={key} type="button" aria-label={'进入' + title} onClick={open}
          className="ui-focus ui-module-entry flex min-h-ui-touch w-full min-w-0 items-center gap-ui-3 px-ui-4 py-ui-5 text-left">
          <Icon size={24} className={'shrink-0 ' + color} aria-hidden="true" />
          <span className="min-w-0 flex-1"><span className="block text-ui-list font-ui-semibold">{title}</span><span className="mt-ui-1 block text-ui-meta text-ui-muted">{description}</span></span>
          <ChevronRight size={18} className="shrink-0 text-ui-muted" aria-hidden="true" />
        </button>)}
      </nav>}
      {!rows.some(row => row.available || row.error) && <p className="mt-ui-6 text-ui-meta text-ui-muted">暂无已开启的功能模块。</p>}
      {rows.filter(row => row.error).map(({ key, title, retry }) => <p key={key} className="mt-ui-3 text-ui-meta text-ui-danger" role="alert">{title}模块状态读取失败。<button className="ui-focus ml-ui-2 min-h-ui-touch min-w-11 font-ui-semibold text-ui-accent" type="button" onClick={retry}>重试</button></p>)}
    </>}
  </main>;
}
