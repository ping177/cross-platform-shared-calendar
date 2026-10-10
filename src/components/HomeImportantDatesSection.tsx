import { useEffect, useState } from 'react';
import { importantDateLabel, importantDateLocalToday } from '../lib/important-dates';
import type { ModuleEntry } from '../lib/module-availability';
import type { CurrentSpace } from '../types';
import { CalendarHeart, ChevronRight } from 'lucide-react';
import type { ImportantDateIdentity } from './useImportantDateTarget';
import { useImportantDateProjection, type HomeImportantDatesSnapshot } from './useImportantDateProjection';

export function HomeImportantDatesSection({ userId, spaces, entry = null, initialData, onValidated, onInvalidate, onViewAll, onOpen, onRefreshReady }: {
  userId: string; spaces: CurrentSpace[]; entry?: ModuleEntry | null; onViewAll: () => void;
  onRefreshReady?: (refresh: () => void) => void;
  onOpen: (target: ImportantDateIdentity) => void;
  initialData?: HomeImportantDatesSnapshot; onValidated?: (data: HomeImportantDatesSnapshot) => void; onInvalidate?: () => void;
}) {
  const [today, setToday] = useState(importantDateLocalToday);
  // App's membership/module hints only invalidate the request context. The
  // T1 reader independently confirms eligibility before and after its read.
  const { state, refresh } = useImportantDateProjection(userId, { kind: 'home', today }, entry,
    { memberSpaces: spaces, initialData, onValidated, onInvalidate });
  useEffect(() => { onRefreshReady?.(() => { void refresh(); }); }, [refresh, onRefreshReady]);
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
  return <section className="rounded-ui-group bg-ui-surface p-ui-4 shadow-ui-group" aria-label="重要日">
    <div className="mb-ui-2 flex min-h-ui-touch items-center justify-between gap-ui-3">
      <h2 className="min-w-0 text-ui-section"><button className="ui-focus min-h-ui-touch text-left" type="button" aria-label="进入重要日" onClick={onViewAll}>临近重要日</button></h2>
      <button className="ui-focus min-h-ui-touch shrink-0 text-ui-label text-ui-accent" type="button" aria-label="查看全部重要日" onClick={onViewAll}>查看全部</button>
    </div>
    {state.status === 'loading' && <p className="py-ui-3 text-ui-meta text-ui-muted" role="status">正在读取重要日…</p>}
    {state.status === 'error' && <div className="py-ui-3" role="alert"><p className="text-ui-meta text-ui-danger">{state.view ? '更新失败，显示上次已读取的内容。' : '重要日暂时无法加载，请重试。'}</p><button className="ui-focus mt-ui-2 min-h-ui-touch min-w-11 font-ui-semibold text-ui-accent" type="button" onClick={() => void refresh()}>重试</button></div>}
    {state.view && (items.length ? <ul className="ui-home-list">{items.map((item) => {
      const space = eligible.find((space) => space.id === item.spaceId);
      return <li key={JSON.stringify([item.spaceId, item.importantDateId])} data-important-date-id={item.importantDateId} data-space-id={item.spaceId}>
        <button className="ui-home-row ui-focus flex min-h-ui-touch w-full min-w-0 items-center gap-ui-3 py-ui-3 text-left" type="button" aria-label={`打开重要日 ${item.name}`}
          onClick={() => onOpen({ spaceId: item.spaceId, importantDateId: item.importantDateId })}>
          <span className="grid h-11 w-11 shrink-0 place-items-center text-ui-accent" aria-hidden="true">{item.emoji ? <span className="text-ui-section">{item.emoji}</span> : <CalendarHeart size={22} />}</span>
          <span className="min-w-0 flex-1"><span className="block break-words text-ui-list font-ui-semibold">{item.name}</span>
            <span className="mt-ui-1 block break-words text-ui-label text-ui-muted">{importantDateLabel(item.occurrenceDate)} · <span className="text-ui-accent">{item.primary}</span></span>
            <span className="mt-ui-1 block break-words text-ui-label-small text-ui-muted">{space?.kind === 'personal' ? '我的空间' : space?.name}{item.secondary ? ` · ${item.secondary}` : ''}</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-ui-muted" aria-hidden="true" />
        </button>
      </li>;
    })}</ul> : <p className="py-ui-3 text-ui-meta text-ui-muted">暂无重要日</p>)}
  </section>;
}
