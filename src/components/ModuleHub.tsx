import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronRight, ListTodo } from 'lucide-react';
import { loadReviewEligibility } from '../lib/review-history-data';
import { createRequestGuard } from '../lib/request-guard';

export function ModuleHub({ userId, onOpenTasks, onOpenReview }: { userId: string; onOpenTasks: () => void; onOpenReview: () => void }) {
  const [reviewAvailable, setReviewAvailable] = useState(false);
  const [reviewError, setReviewError] = useState(false);
  const guard = useRef(createRequestGuard());
  async function refreshReview() {
    const request = guard.current.begin();
    setReviewError(false);
    try {
      const spaces = await loadReviewEligibility(userId);
      if (guard.current.isCurrent(request)) setReviewAvailable(spaces.length > 0);
    } catch {
      if (guard.current.isCurrent(request)) { setReviewAvailable(false); setReviewError(true); }
    }
  }
  useEffect(() => {
    void refreshReview();
    const onFocus = () => { void refreshReview(); };
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); guard.current.invalidate(); };
  }, [userId]);
  return <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-4 safe-bottom">
    <h1 className="text-xl font-bold">功能中心</h1>
    <button className="mt-4 flex min-h-16 w-full min-w-0 items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-left shadow-sm" type="button" onClick={onOpenTasks} aria-label="进入任务">
      <span className="flex min-w-0 items-center gap-3">
        <ListTodo size={20} className="shrink-0 text-teal" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block font-semibold">任务</span>
          <span className="block text-sm text-ink/60">查看各空间的任务</span>
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-ink/45" aria-hidden="true" />
    </button>
    {reviewAvailable && <button className="mt-3 flex min-h-16 w-full min-w-0 items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-left shadow-sm" type="button" onClick={onOpenReview} aria-label="进入回顾">
      <span className="flex min-w-0 items-center gap-3"><BookOpen size={20} className="shrink-0 text-teal" aria-hidden="true" /><span className="min-w-0"><span className="block font-semibold">回顾</span><span className="block text-sm text-ink/60">查看空间的历史回顾</span></span></span>
      <ChevronRight size={18} className="shrink-0 text-ink/45" aria-hidden="true" />
    </button>}
    {reviewError && <p className="mt-3 text-sm text-coral" role="alert">回顾模块状态读取失败。<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={() => void refreshReview()}>重试</button></p>}
  </main>;
}
