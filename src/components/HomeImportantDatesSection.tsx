import { useEffect, useRef, useState, type RefObject } from 'react';
import { canSaveImportantDateTarget, defaultImportantDateTarget, importantDateLabel, importantDateLocalToday, type ImportantDateDraft } from '../lib/important-dates';
import type { ModuleEntry } from '../lib/module-availability';
import type { CurrentSpace } from '../types';
import { CalendarHeart, ChevronRight, Plus } from 'lucide-react';
import { createImportantDate } from '../lib/important-dates-data';
import { detectBrowserTimeZone } from '../lib/reminder';
import { homeMemberKey } from '../lib/home-aggregation';
import { createRequestGuard } from '../lib/request-guard';
import { supabase } from '../lib/supabase';
import { ImportantDateSheet } from './ImportantDateSheet';
import { useImportantDates } from './useImportantDates';
import type { ImportantDateIdentity } from './useImportantDateTarget';
import { useImportantDateProjection, type HomeImportantDatesSnapshot } from './useImportantDateProjection';

export function HomeImportantDatesSection({ userId, spaces, entry = null, initialData, onValidated, onInvalidate, onViewAll, onOpen, onRefreshReady, onCreate, creating = false, createButtonRef }: {
  userId: string; spaces: CurrentSpace[]; entry?: ModuleEntry | null; onViewAll: () => void;
  onCreate?: () => void; creating?: boolean; createButtonRef?: RefObject<HTMLButtonElement>;
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
  const items = state.view?.kind === 'home' ? state.view.items.slice(0, 2) : [];
  const eligible = state.scope?.eligibleSpaces ?? [];
  return <section className="rounded-ui-group bg-ui-surface p-ui-4 shadow-ui-group" aria-label="重要日">
    <div className="mb-ui-2 flex min-h-ui-touch items-center justify-between gap-ui-3">
      <h2 className="min-w-0 text-ui-list font-ui-semibold"><button className="ui-focus min-h-ui-touch text-left" type="button" aria-label="进入重要日" onClick={onViewAll}>临近重要日</button></h2>
      <button className="ui-focus min-h-ui-touch shrink-0 text-ui-label text-ui-accent" type="button" aria-label="查看全部重要日" onClick={onViewAll}>查看全部</button>
      {onCreate && <button ref={createButtonRef} className="ui-focus grid h-11 w-11 shrink-0 place-items-center bg-transparent text-ui-accent hover:text-ui-accent-strong disabled:text-ui-muted" type="button" aria-label="新建重要日"
        disabled={creating || state.status !== 'success' || state.refreshing || !eligible.some((space) => canSaveImportantDateTarget(space.id, eligible))} onClick={onCreate}><Plus size={18} aria-hidden="true" /></button>}
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


// Mounted only for Home creation. Reuse the module's canonical reader and
// existing Sheet; projection rows never authorize a write.
export function HomeImportantDateCreate({ userId, spaces, entry, onClose, onNotice, onReconcile }: {
  userId: string; spaces: CurrentSpace[]; entry?: ModuleEntry | null;
  onClose: () => void; onNotice: (message: string) => void; onReconcile: () => void;
}) {
  const mutation = useRef(createRequestGuard());
  const lock = useRef(false);
  const active = useRef(true);
  const knownEntry = useRef(entry);
  if (entry) knownEntry.current = entry;
  const contextKey = `${userId}:${homeMemberKey(spaces)}:${knownEntry.current ? homeMemberKey(knownEntry.current.eligibleSpaces) : 'unknown'}`;
  const openingContext = useRef(contextKey);
  const { state, sessionLost, refresh, invalidate, canAct } = useImportantDates(userId, () => {
    onNotice('重要日空间已不可用或未启用。'); onClose(); onReconcile();
  }, 0, { entry: entry ?? undefined, onInvalidateEligibility: onReconcile });
  if (openingContext.current !== contextKey || sessionLost || state.authLost) { active.current = false; mutation.current.invalidate(); }
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; mutation.current.invalidate(); };
  }, []);
  useEffect(() => { if (!active.current) onClose(); }, [contextKey, sessionLost, state.authLost, onClose]);
  const data = state.data;
  const memberScopeMatches = Boolean(data && homeMemberKey(data.memberSpaces) === homeMemberKey(spaces));
  const sheetOpened = useRef(false);
  if (data?.eligibleSpaces.length && memberScopeMatches) sheetOpened.current = true;
  const authorization = useRef(false);
  authorization.current = active.current && canAct && memberScopeMatches;

  async function save(draft: ImportantDateDraft, spaceId: string) {
    if (!active.current || !authorization.current || !data || lock.current || !canSaveImportantDateTarget(spaceId, data.eligibleSpaces)) throw new Error('当前无法保存，请重新读取重要日。');
    lock.current = true; const request = mutation.current.begin();
    try {
      const zone = detectBrowserTimeZone();
      if (!zone.ok) throw new Error(zone.error);
      await createImportantDate(supabase, userId, spaceId, draft, zone.timeZone);
      if (!active.current || !mutation.current.isCurrent(request)) return;
      onNotice('重要日已保存。'); onClose(); onReconcile();
    } catch (error) {
      if (active.current && mutation.current.isCurrent(request)) { invalidate(); await refresh(); onReconcile(); }
      throw error;
    } finally { lock.current = false; }
  }

  if (!active.current || sessionLost || state.authLost) return null;
  if (sheetOpened.current) return <ImportantDateSheet
    initialTargetId={data ? defaultImportantDateTarget('all', data.memberSpaces, data.eligibleSpaces, userId) : null}
    memberSpaces={data?.memberSpaces ?? []} eligibleSpaces={data?.eligibleSpaces ?? []} canAct={authorization.current}
    onSubmit={save} onCancel={onClose} onDelete={() => undefined}
  />;
  return <div className="fixed inset-0 z-40 flex items-end bg-ink/50 p-4 md:items-center" role="dialog" aria-modal="true" aria-label="确认新建重要日">
    <div className="mx-auto w-full max-w-md rounded-lg bg-white p-5 safe-bottom">
      <p role={state.error ? 'alert' : 'status'}>{state.error || (data && !memberScopeMatches ? '空间资格已变化，请重新确认。' : '正在确认可用的重要日空间…')}</p>
      {state.error && <button className="min-h-11 min-w-11 font-semibold text-teal" type="button" onClick={() => void refresh()}>重试</button>}
      <button className="ml-3 min-h-11 min-w-11 font-semibold text-teal" type="button" onClick={onClose}>取消</button>
    </div>
  </div>;
}
