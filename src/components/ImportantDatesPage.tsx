import { useMobileSwipe } from './useMobileSwipe';
import type { SwipeClickGuard } from '../lib/mobile-swipe';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, CalendarHeart, Plus } from 'lucide-react';
import { createImportantDate, deleteImportantDate, updateImportantDate, type ImportantDatesData } from '../lib/important-dates-data';
import { defaultImportantDateTarget, groupImportantDates, type ImportantDateDraft, type ImportantDateFilter } from '../lib/important-dates';
import type { CivilDate } from '../../supabase/functions/_shared/important-date.ts';
import { detectBrowserTimeZone } from '../lib/reminder';
import { sameModuleScope } from '../lib/module-availability';
import { createRequestGuard } from '../lib/request-guard';
import { supabase } from '../lib/supabase';
import type { ImportantDate } from '../types';
import { ImportantDateDeleteDialog, ImportantDateSheet } from './ImportantDateSheet';
import { useImportantDates, type ImportantDatesEntryOptions } from './useImportantDates';

export function ImportantDateIcon({ emoji }: { emoji: string | null }) {
  return emoji ? <span className="text-xl" aria-hidden="true">{emoji}</span> : <CalendarHeart size={22} className="text-teal" aria-hidden="true" />;
}

export function ImportantDatesContent({ data, filter, today, pastExpanded, canAct, onOpen, onPastToggle, onCreate }: {
  data: ImportantDatesData; filter: ImportantDateFilter; today: CivilDate; pastExpanded: boolean; canAct: boolean;
  onOpen: (date: ImportantDate) => void; onPastToggle: () => void; onCreate?: () => void;
}) {
  const grouped = groupImportantDates(data.dates, today, filter);
  const spaces = new Map(data.eligibleSpaces.map((space) => [space.id, space]));
  const rows = (items: typeof grouped.current) => <ul className="ui-important-rows">{items.map((row) => {
    const space = spaces.get(row.date.space_id);
    return <li key={row.date.id} data-important-date-id={row.date.id} data-space-id={row.date.space_id}>
      <button data-swipe-start className="ui-important-row" type="button" disabled={!canAct} onClick={() => onOpen(row.date)} aria-label={`打开重要日 ${row.date.name}`}>
        <span className="ui-important-icon"><ImportantDateIcon emoji={row.date.emoji} /></span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-ui-list font-ui-semibold">{row.date.name}</span>
          <span className={`mt-ui-1 block text-ui-meta font-ui-medium ${row.display.kind === 'past' ? 'text-ui-muted' : 'text-ui-accent'}`}>{row.display.kind === 'past' ? `已过 ${row.display.elapsedDays} 天` : row.primary}</span>
          {row.secondary && <span className="mt-ui-1 block text-ui-meta text-ui-muted">{row.secondary}</span>}
          <span className="mt-ui-1 block text-ui-meta text-ui-muted">{row.dateLabel} · {row.date.repeat_kind === 'annual' ? '每年' : '不重复'}</span>
          {filter === 'all' && <span className="mt-ui-1 block break-words text-ui-label text-ui-muted">{space?.kind === 'personal' ? '我的空间' : space?.name}</span>}
        </span>
        <ChevronRight size={18} className="mt-ui-1 shrink-0 text-ui-control" aria-hidden="true" />
      </button>
    </li>;
  })}</ul>;
  return <>
    <section aria-label="当前重要日"><h2 className="mb-ui-3 text-ui-meta text-ui-muted">重要日 · {grouped.current.length}</h2>
      {grouped.current.length ? rows(grouped.current) : grouped.past.length ? <p className="ui-important-empty-current text-ui-meta text-ui-muted">暂无当前重要日</p> : <div className="ui-important-empty">
        <CalendarHeart size={36} className="mx-auto text-ui-control" aria-hidden="true" />
        <h3 className="mt-ui-4 text-ui-bar">还没有重要日</h3>
        <p className="mt-ui-2 text-ui-meta text-ui-muted">记录生活中值得记住的日子。</p>
        {onCreate && <button className="ui-focus mt-ui-4 inline-flex items-center justify-center gap-ui-2 px-ui-3 text-ui-meta font-ui-semibold text-ui-accent" type="button" disabled={!canAct} onClick={onCreate}><Plus size={18} aria-hidden="true" />新建重要日</button>}
      </div>}
    </section>
    <section aria-label="历史重要日"><button className="ui-important-history" type="button" aria-expanded={pastExpanded} onClick={onPastToggle}><span>历史重要日 · {grouped.past.length}</span><ChevronDown size={18} className={pastExpanded ? 'rotate-180' : ''} aria-hidden="true" /></button>
      {pastExpanded && <div className="mt-ui-3">{grouped.past.length ? rows(grouped.past) : <p className="text-ui-meta text-ui-muted">暂无历史重要日</p>}</div>}
    </section>
  </>;
}

type Props = ImportantDatesEntryOptions & { swipeClickGuard?: SwipeClickGuard; userId: string; onHubBack: () => void; onNoEligible: () => void; eligibilityRevision?: number; initialPastExpanded?: boolean; onValidated?: (data: ImportantDatesData, filter: ImportantDateFilter, pastExpanded: boolean) => void };
// Keep data, drafts and in-flight callbacks scoped to one account even without a parent key.
export function ImportantDatesPage(props: Props) { return <ImportantDatesModule key={props.userId} {...props} />; }

function ImportantDatesModule({ swipeClickGuard, userId, onHubBack, onNoEligible, eligibilityRevision, initialPastExpanded = false, onValidated, ...entryOptions }: Props) {
  const [pastExpanded, setPastExpanded] = useState(Boolean(entryOptions.initialData && sameModuleScope(entryOptions.entry ?? null, entryOptions.initialData.memberSpaces, entryOptions.initialData.eligibleSpaces) && initialPastExpanded));
  const [editor, setEditor] = useState<{ date?: ImportantDate; initialTargetId: string | null } | null>(null);
  const [deleting, setDeleting] = useState<ImportantDate | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');
  const mutation = useRef(createRequestGuard());
  const mutationLock = useRef(false);
  const createButton = useRef<HTMLButtonElement>(null);
  const { state, sessionLost, filter, today, setFilter, refresh, invalidate, canAct } = useImportantDates(userId, onNoEligible, eligibilityRevision, entryOptions);
  const data = state.data;
  const deleteSpace = data?.eligibleSpaces.find((space) => space.id === deleting?.space_id);
  const visibleEditor = editor && !sessionLost && !state.authLost ? editor : null;

  useEffect(() => {
    if (data && canAct) onValidated?.(data, filter, pastExpanded);
  }, [data, canAct, filter, pastExpanded, onValidated]);
  useEffect(() => () => { mutation.current.invalidate(); }, []);
  useEffect(() => {
    if (sessionLost) {
      mutation.current.invalidate();
      setEditor(null); setDeleting(null); setNotice('');
    } else if (state.authLost) {
      mutation.current.invalidate(); setEditor(null); setDeleting(null);
    }
  }, [state.authLost, sessionLost]);
  useEffect(() => {
    if (!data) return;
    const exists = (date: ImportantDate) => data.dates.some((current) => current.id === date.id && current.space_id === date.space_id);
    if ((editor?.date && !exists(editor.date)) || (deleting && !exists(deleting))) {
      setEditor(null); setDeleting(null); setNotice('此重要日已删除或当前不可访问。');
    }
  }, [data, editor, deleting]);

  function openCreate() {
    if (!canAct || !data) return;
    setNotice('');
    setEditor({ initialTargetId: defaultImportantDateTarget(filter, data.memberSpaces, data.eligibleSpaces, userId) });
  }
  function closeEditor() { setEditor(null); createButton.current?.focus(); }

  async function save(draft: ImportantDateDraft, spaceId: string) {
    if (!editor || !canAct || mutationLock.current) throw new Error('当前无法保存，请重新读取重要日。');
    if (editor.date && spaceId !== editor.date.space_id) throw new Error('编辑重要日不能迁移空间。');
    mutationLock.current = true;
    const request = mutation.current.begin();
    try {
      if (editor.date) await updateImportantDate(supabase, userId, editor.date, draft);
      else {
        const zone = detectBrowserTimeZone();
        if (!zone.ok) throw new Error(zone.error);
        await createImportantDate(supabase, userId, spaceId, draft, zone.timeZone);
      }
      if (!mutation.current.isCurrent(request)) return;
      closeEditor(); setNotice('重要日已保存。');
      await refresh();
    } catch (error) {
      if (mutation.current.isCurrent(request)) { invalidate(); await refresh(); }
      throw error;
    } finally { mutationLock.current = false; }
  }

  async function confirmDelete() {
    if (!deleting || !deleteSpace || !canAct || mutationLock.current) return;
    mutationLock.current = true;
    const request = mutation.current.begin();
    setDeleteBusy(true); setDeleteError('');
    try {
      await deleteImportantDate(supabase, userId, deleting);
      if (!mutation.current.isCurrent(request)) return;
      setDeleting(null); setNotice('重要日已删除。');
      await refresh();
    } catch (error) {
      if (mutation.current.isCurrent(request)) {
        invalidate();
        const fresh = await refresh();
        if (!mutation.current.isCurrent(request)) return;
        const current = fresh?.dates.find((date) => date.id === deleting.id && date.space_id === deleting.space_id);
        setDeleting(current ?? (fresh ? null : deleting));
        setDeleteError('删除未确认成功，请重新读取并确认目标后重试。');
        setNotice('删除未确认成功，请核对列表。');
      }
    } finally { mutationLock.current = false; if (mutation.current.isCurrent(request)) setDeleteBusy(false); }
  }

  const swipe = useMobileSwipe({ enabled: !editor && !deleting && !deleteBusy, scope: `${userId}:${filter === 'all' ? 'all' : filter.spaceId}`,
    direction: 'right', clickGuard: swipeClickGuard, onSwipe: onHubBack });

  return <main {...swipe} className="ui-important-page min-h-[100dvh] bg-ui-page font-ui text-ui-text">
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col">
      <header className="ui-important-header sticky top-0 z-10 border-b border-ui-border bg-ui-page px-ui-4 pb-ui-3 pt-ui-4">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <button className="ui-focus inline-flex min-h-11 items-center gap-1 text-ui-meta font-ui-semibold text-ui-accent" type="button" onClick={onHubBack}><ChevronLeft size={18} aria-hidden="true" />功能中心</button>
          <h1 className="min-w-0 truncate text-ui-section">重要日</h1>
          <button ref={createButton} className="ui-focus grid h-11 w-11 shrink-0 place-items-center rounded-ui-control bg-transparent text-ui-accent disabled:opacity-50" type="button" aria-label="新建重要日" disabled={!canAct || !data?.eligibleSpaces.length} onClick={openCreate}><Plus size={18} aria-hidden="true" /></button>
        </div>
        {data && <label className="mt-3 block w-full max-w-sm min-w-0"><span className="sr-only">筛选重要日空间</span>
          <select className="h-11 w-full min-w-0 truncate rounded-ui-control border border-ui-control bg-ui-surface px-ui-3 text-ui-body" aria-label="筛选重要日空间" value={filter === 'all' ? 'all' : filter.spaceId} onChange={(event) => setFilter(event.target.value === 'all' ? 'all' : { spaceId: event.target.value })}>
            <option value="all">全部空间</option>{data.eligibleSpaces.map((space) => <option key={space.id} value={space.id}>{space.kind === 'personal' ? '我的空间' : space.name}</option>)}
          </select>
        </label>}
      </header>
      <div className="flex-1 space-y-ui-5 px-ui-4 py-ui-4 safe-bottom">
        {notice && <p role="status" className="text-sm text-ink/70">{notice}</p>}
        {state.refreshing && <p role="status" className="text-sm text-ink/60">{data ? '重要日更新中…' : '正在读取重要日…'}</p>}
        {state.error && <p role="alert" className="text-sm text-coral">{state.error}<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={() => void refresh()}>重试</button></p>}
        {data && <ImportantDatesContent data={data} filter={filter} today={today} canAct={canAct} pastExpanded={pastExpanded} onPastToggle={() => setPastExpanded((value) => !value)} onCreate={openCreate} onOpen={(date) => { setNotice(''); setEditor({ date, initialTargetId: date.space_id }); }} />}
      </div>
    </div>
    {visibleEditor && <ImportantDateSheet moduleView key={visibleEditor.date?.id ?? 'create'} date={visibleEditor.date} initialTargetId={visibleEditor.initialTargetId} memberSpaces={data?.memberSpaces ?? []} eligibleSpaces={data?.eligibleSpaces ?? []} canAct={canAct} onSubmit={save} onCancel={closeEditor} onDelete={() => { if (visibleEditor.date) { setDeleting(visibleEditor.date); setDeleteError(''); setEditor(null); } }} />}
    {deleting && deleteSpace && <ImportantDateDeleteDialog moduleView date={deleting} space={deleteSpace} busy={deleteBusy} canAct={canAct} error={deleteError} onCancel={() => { setDeleting(null); }} onConfirm={() => void confirmDelete()} />}
  </main>;
}
