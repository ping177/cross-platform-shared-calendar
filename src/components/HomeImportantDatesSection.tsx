import { useEffect, useState } from 'react';
import { importantDateLocalToday } from '../lib/important-dates';
import type { ModuleEntry } from '../lib/module-availability';
import type { CurrentSpace } from '../types';
import { ImportantDateIcon } from './ImportantDatesPage';
import type { ImportantDateIdentityHandoff } from './useImportantDateHandoff';
import { useImportantDateProjection } from './useImportantDateProjection';

export function HomeImportantDatesSection({ userId, spaces, entry = null, onViewAll, onOpen }: {
  userId: string; spaces: CurrentSpace[]; entry?: ModuleEntry | null; onViewAll: () => void;
  onOpen: (target: ImportantDateIdentityHandoff) => void;
}) {
  const [today, setToday] = useState(importantDateLocalToday);
  // App's membership/module hints only invalidate the request context. The
  // T1 reader independently confirms eligibility before and after its read.
  const { state, refresh } = useImportantDateProjection(userId, { kind: 'home', today }, {
    memberSpaces: spaces, eligibleSpaces: entry?.eligibleSpaces ?? [],
  });
  useEffect(() => {
    const syncToday = () => setToday((current) => {
      const next = importantDateLocalToday();
      return current.year === next.year && current.month === next.month && current.day === next.day ? current : next;
    });
    const onVisible = () => { if (document.visibilityState === 'visible') syncToday(); };
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(syncToday, midnight.getTime() - now.getTime() + 20);
    window.addEventListener('focus', syncToday);
    window.addEventListener('online', syncToday);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', syncToday);
      window.removeEventListener('online', syncToday);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [today]);

  if (state.scope && !state.scope.eligibleSpaces.length) return null;
  const items = state.view?.kind === 'home' ? state.view.items : [];
  const eligible = state.scope?.eligibleSpaces ?? [];
  return <section className="space-y-3" aria-label="重要日">
    <div className="flex items-center justify-between gap-3">
      <h2 className="min-w-0 text-lg font-bold"><button className="min-h-11 text-left" type="button" aria-label="进入重要日" onClick={onViewAll}>重要日</button></h2>
      <button className="min-h-11 shrink-0 text-sm font-semibold text-teal" type="button" aria-label="查看全部重要日" onClick={onViewAll}>查看全部</button>
    </div>
    {state.status === 'loading' && <p className="rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm" role="status">正在读取重要日…</p>}
    {state.status === 'error' && <div className="rounded-lg bg-white px-4 py-5 shadow-sm" role="alert"><p className="text-sm text-coral">重要日暂时无法加载，请重试。</p><button className="mt-2 min-h-11 font-semibold text-teal" type="button" onClick={() => void refresh()}>重试</button></div>}
    {state.status === 'success' && (items.length ? <ul className="space-y-2">{items.map((item) => {
      const space = eligible.find((space) => space.id === item.spaceId);
      return <li key={JSON.stringify([item.spaceId, item.importantDateId])} data-important-date-id={item.importantDateId} data-space-id={item.spaceId}>
        <button className="flex min-h-14 w-full min-w-0 items-start gap-3 rounded-lg bg-white px-4 py-3 text-left shadow-sm" type="button" aria-label={`打开重要日 ${item.name}`}
          onClick={() => onOpen({ spaceId: item.spaceId, importantDateId: item.importantDateId, returnTo: 'home' })}>
          <span className="mt-1 shrink-0"><ImportantDateIcon emoji={item.emoji} /></span>
          <span className="min-w-0 flex-1"><span className="block break-words font-semibold">{item.name}</span>
            <span className="mt-1 block font-semibold text-teal">{item.primary}</span>
            {item.secondary && <span className="mt-1 block text-sm text-ink/65">{item.secondary}</span>}
            <span className="mt-1 block break-words text-xs text-ink/60">{space?.kind === 'personal' ? '我的空间' : space?.name}</span>
          </span>
        </button>
      </li>;
    })}</ul> : <p className="rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm">暂无重要日</p>)}
  </section>;
}
