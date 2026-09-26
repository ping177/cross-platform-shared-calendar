import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronRight, ListChecks, ListTodo } from 'lucide-react';
import { loadReviewEligibility } from '../lib/review-history-data';
import { loadListsEligibility } from '../lib/lists-data';
import { loadTaskEligibility } from '../lib/aggregate-tasks-data';
import { createRequestGuard } from '../lib/request-guard';
import { applyModuleToggle, mergeModuleAvailability, type ModuleAvailability, type ModuleKey, type ModuleRead } from '../lib/module-availability';
import type { CurrentSpace } from '../types';

export async function resolveHubEligibility(
  readTasks: () => Promise<{ eligibleSpaces: CurrentSpace[] }>,
  readReview: () => Promise<CurrentSpace[]>,
  readLists: () => Promise<{ eligibleSpaces: CurrentSpace[] }>,
): Promise<ModuleRead> {
  const [tasks, review, lists] = await Promise.allSettled([readTasks(), readReview(), readLists()]);
  return {
    tasksIds: tasks.status === 'fulfilled' ? tasks.value.eligibleSpaces.map((space) => space.id) : null,
    reviewIds: review.status === 'fulfilled' ? review.value.map((space) => space.id) : null,
    listsIds: lists.status === 'fulfilled' ? lists.value.eligibleSpaces.map((space) => space.id) : null,
  };
}

// CalendarApp owns this hook for the lifetime of one authenticated user session.
export function useModuleAvailability(userId: string, ready: boolean) {
  const [availability, setAvailability] = useState<ModuleAvailability | null>(null);
  const guard = useRef(createRequestGuard());
  async function refresh() {
    const request = guard.current.begin();
    const read = await resolveHubEligibility(() => loadTaskEligibility(userId), () => loadReviewEligibility(userId), () => loadListsEligibility(userId));
    if (guard.current.isCurrent(request)) setAvailability((previous) => mergeModuleAvailability(previous, read));
  }
  function moduleChanged(key: ModuleKey, spaceId: string, state: 'enabled' | 'disabled') {
    guard.current.invalidate();
    setAvailability((previous) => applyModuleToggle(previous, key, spaceId, state));
    void refresh();
  }
  useEffect(() => {
    if (!ready) return;
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
    };
  }, [userId, ready]);
  return { availability, refresh, moduleChanged };
}

export function ModuleHub({ availability, onRefresh, onOpenTasks, onOpenReview, onOpenLists }: {
  availability: ModuleAvailability | null; onRefresh: () => void;
  onOpenTasks: () => void; onOpenReview: () => void; onOpenLists: () => void;
}) {
  return <ModuleHubContent loading={availability === null}
    tasksAvailable={(availability?.tasksIds?.length ?? 0) > 0} tasksError={availability?.tasksError ?? false}
    reviewAvailable={(availability?.reviewIds?.length ?? 0) > 0} reviewError={availability?.reviewError ?? false}
    listsAvailable={(availability?.listsIds?.length ?? 0) > 0} listsError={availability?.listsError ?? false}
    onOpenTasks={onOpenTasks} onOpenReview={onOpenReview} onOpenLists={onOpenLists}
    onRetryTasks={onRefresh} onRetryReview={onRefresh} onRetryLists={onRefresh} />;
}

export function ModuleHubContent({ loading, tasksAvailable, tasksError, reviewAvailable, reviewError, listsAvailable, listsError, onOpenTasks, onOpenReview, onOpenLists, onRetryTasks, onRetryReview, onRetryLists }: {
  loading: boolean; tasksAvailable: boolean; tasksError: boolean; reviewAvailable: boolean; reviewError: boolean;
  listsAvailable: boolean; listsError: boolean;
  onOpenTasks: () => void; onOpenReview: () => void; onOpenLists: () => void;
  onRetryTasks: () => void; onRetryReview: () => void; onRetryLists: () => void;
}) {
  return <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-4 safe-bottom">
    <h1 className="text-xl font-bold">功能中心</h1>
    {loading ? <p className="mt-4 rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm" role="status">正在读取功能模块…</p> : <>
    {tasksAvailable && <button className="mt-4 flex min-h-16 w-full min-w-0 items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-left shadow-sm" type="button" onClick={onOpenTasks} aria-label="进入任务">
      <span className="flex min-w-0 items-center gap-3">
        <ListTodo size={20} className="shrink-0 text-teal" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block font-semibold">任务</span>
          <span className="block text-sm text-ink/60">查看各空间的任务</span>
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-ink/45" aria-hidden="true" />
    </button>}
    {reviewAvailable && <button className={`${tasksAvailable ? 'mt-3' : 'mt-4'} flex min-h-16 w-full min-w-0 items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-left shadow-sm`} type="button" onClick={onOpenReview} aria-label="进入回顾">
      <span className="flex min-w-0 items-center gap-3"><BookOpen size={20} className="shrink-0 text-teal" aria-hidden="true" /><span className="min-w-0"><span className="block font-semibold">回顾</span><span className="block text-sm text-ink/60">查看空间的历史回顾</span></span></span>
      <ChevronRight size={18} className="shrink-0 text-ink/45" aria-hidden="true" />
    </button>}
    {listsAvailable && <button className={`${tasksAvailable || reviewAvailable ? 'mt-3' : 'mt-4'} flex min-h-16 w-full min-w-0 items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-left shadow-sm`} type="button" onClick={onOpenLists} aria-label="进入清单">
      <span className="flex min-w-0 items-center gap-3"><ListChecks size={20} className="shrink-0 text-teal" aria-hidden="true" /><span className="min-w-0"><span className="block font-semibold">清单</span><span className="block text-sm text-ink/60">查看各空间的清单</span></span></span>
      <ChevronRight size={18} className="shrink-0 text-ink/45" aria-hidden="true" />
    </button>}
    {!tasksAvailable && !reviewAvailable && !listsAvailable && !tasksError && !reviewError && !listsError && <p className="mt-4 rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm">暂无已开启的功能模块。</p>}
    {tasksError && <p className="mt-3 text-sm text-coral" role="alert">任务模块状态读取失败。<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={onRetryTasks}>重试</button></p>}
    {reviewError && <p className="mt-3 text-sm text-coral" role="alert">回顾模块状态读取失败。<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={onRetryReview}>重试</button></p>}
    {listsError && <p className="mt-3 text-sm text-coral" role="alert">清单模块状态读取失败。<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={onRetryLists}>重试</button></p>}
    </>}
  </main>;
}
