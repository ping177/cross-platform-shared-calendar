import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, CalendarHeart, Plus } from 'lucide-react';
import { createImportantDate, deleteImportantDate, updateImportantDate, type ImportantDatesData } from '../lib/important-dates-data';
import { defaultImportantDateTarget, groupImportantDates, type ImportantDateDraft, type ImportantDateFilter } from '../lib/important-dates';
import type { CivilDate } from '../../supabase/functions/_shared/important-date.ts';
import { detectBrowserTimeZone } from '../lib/reminder';
import { createRequestGuard } from '../lib/request-guard';
import { supabase } from '../lib/supabase';
import type { ImportantDate } from '../types';
import { ImportantDateDeleteDialog, ImportantDateSheet } from './ImportantDateSheet';
import { useImportantDates } from './useImportantDates';

export function ImportantDateIcon({ emoji }: { emoji: string | null }) {
  return emoji ? <span className="text-xl" aria-hidden="true">{emoji}</span> : <CalendarHeart size={22} className="text-teal" aria-hidden="true" />;
}

export function ImportantDatesContent({ data, filter, today, pastExpanded, canAct, onOpen, onPastToggle }: {
  data: ImportantDatesData; filter: ImportantDateFilter; today: CivilDate; pastExpanded: boolean; canAct: boolean;
  onOpen: (date: ImportantDate) => void; onPastToggle: () => void;
}) {
  const grouped = groupImportantDates(data.dates, today, filter);
  const spaces = new Map(data.eligibleSpaces.map((space) => [space.id, space]));
  const rows = (items: typeof grouped.current) => <ul className="space-y-2">{items.map((row) => {
    const space = spaces.get(row.date.space_id);
    return <li key={row.date.id} data-important-date-id={row.date.id} data-space-id={row.date.space_id}>
      <button className="flex min-h-14 w-full min-w-0 items-start gap-3 rounded-lg bg-white px-4 py-3 text-left shadow-sm disabled:opacity-50" type="button" disabled={!canAct} onClick={() => onOpen(row.date)} aria-label={`打开重要日 ${row.date.name}`}>
        <span className="mt-1 shrink-0"><ImportantDateIcon emoji={row.date.emoji} /></span>
        <span className="min-w-0 flex-1"><span className="block break-words font-semibold">{row.date.name}</span>
          <span className="mt-1 block font-semibold text-teal">{row.primary}</span>
          {row.secondary && <span className="mt-1 block text-sm text-ink/65">{row.secondary}</span>}
          <span className="mt-1 block text-xs text-ink/60">{row.dateLabel} · {row.date.repeat_kind === 'annual' ? '每年' : '不重复'}</span>
          {filter === 'all' && <span className="mt-1 block break-words text-xs text-ink/60">{space?.kind === 'personal' ? '我的空间' : space?.name}</span>}
        </span>
      </button>
    </li>;
  })}</ul>;
  return <>
    <section aria-label="当前重要日"><h2 className="mb-3 text-sm font-semibold text-ink/60">重要日 · {grouped.current.length}</h2>
      {grouped.current.length ? rows(grouped.current) : <p className="rounded-lg bg-white px-4 py-5 text-sm text-ink/60">暂无重要日</p>}
    </section>
    <section aria-label="过去的重要日"><button className="flex min-h-14 w-full items-center justify-between rounded-lg bg-white px-4 text-left font-semibold shadow-sm" type="button" aria-expanded={pastExpanded} onClick={onPastToggle}><span>过去 · {grouped.past.length}</span><ChevronDown size={18} className={pastExpanded ? 'rotate-180 text-ink/45' : 'text-ink/45'} aria-hidden="true" /></button>
      {pastExpanded && <div className="mt-3">{grouped.past.length ? rows(grouped.past) : <p className="text-sm text-ink/60">暂无过去的重要日</p>}</div>}
    </section>
  </>;
}

type Props = { userId: string; onHubBack: () => void; onNoEligible: () => void; eligibilityRevision?: number };
// Keep data, drafts and in-flight callbacks scoped to one account even without a parent key.
export function ImportantDatesPage(props: Props) { return <ImportantDatesModule key={props.userId} {...props} />; }

function ImportantDatesModule({ userId, onHubBack, onNoEligible, eligibilityRevision }: Props) {
  const { state, filter, today, setFilter, refresh, invalidate, canAct } = useImportantDates(userId, onNoEligible, eligibilityRevision);
  const [pastExpanded, setPastExpanded] = useState(false);
  const [editor, setEditor] = useState<{ date?: ImportantDate; initialTargetId: string | null } | null>(null);
  const [deleting, setDeleting] = useState<ImportantDate | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');
  const mutation = useRef(createRequestGuard());
  const mutationLock = useRef(false);
  const createButton = useRef<HTMLButtonElement>(null);
  const data = state.data;
  const deleteSpace = data?.eligibleSpaces.find((space) => space.id === deleting?.space_id);

  useEffect(() => () => { mutation.current.invalidate(); }, []);
  useEffect(() => {
    if (state.authLost) {
      mutation.current.invalidate();
      setEditor(null); setDeleting(null); setNotice('');
    }
  }, [state.authLost]);
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

  return <main className="min-h-[100dvh] bg-mist text-ink">
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-mist/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <button className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-teal" type="button" onClick={onHubBack}><ChevronLeft size={18} aria-hidden="true" />功能中心</button>
          <h1 className="min-w-0 truncate text-xl font-bold">重要日</h1>
          <button ref={createButton} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal text-white disabled:opacity-50" type="button" aria-label="新建重要日" disabled={!canAct || !data?.eligibleSpaces.length} onClick={openCreate}><Plus size={20} aria-hidden="true" /></button>
        </div>
        {data && <label className="mt-3 block w-full max-w-sm min-w-0"><span className="sr-only">筛选重要日空间</span>
          <select className="h-11 w-full min-w-0 truncate rounded-lg bg-white px-3 text-sm font-semibold shadow-sm" aria-label="筛选重要日空间" value={filter === 'all' ? 'all' : filter.spaceId} onChange={(event) => setFilter(event.target.value === 'all' ? 'all' : { spaceId: event.target.value })}>
            <option value="all">全部空间</option>{data.eligibleSpaces.map((space) => <option key={space.id} value={space.id}>{space.kind === 'personal' ? '我的空间' : space.name}</option>)}
          </select>
        </label>}
      </header>
      <div className="flex-1 space-y-5 px-4 py-4 safe-bottom">
        {notice && <p role="status" className="text-sm text-ink/70">{notice}</p>}
        {state.refreshing && <p role="status" className="text-sm text-ink/60">正在读取重要日…</p>}
        {state.error && <p role="alert" className="text-sm text-coral">{state.error}<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={() => void refresh()}>重试</button></p>}
        {data && <ImportantDatesContent data={data} filter={filter} today={today} canAct={canAct} pastExpanded={pastExpanded} onPastToggle={() => setPastExpanded((value) => !value)} onOpen={(date) => { setNotice(''); setEditor({ date, initialTargetId: date.space_id }); }} />}
      </div>
    </div>
    {editor && <ImportantDateSheet key={editor.date?.id ?? 'create'} date={editor.date} initialTargetId={editor.initialTargetId} memberSpaces={data?.memberSpaces ?? []} eligibleSpaces={data?.eligibleSpaces ?? []} canAct={canAct} onSubmit={save} onCancel={closeEditor} onDelete={() => { if (editor.date) { setDeleting(editor.date); setDeleteError(''); setEditor(null); } }} />}
    {deleting && deleteSpace && <ImportantDateDeleteDialog date={deleting} space={deleteSpace} busy={deleteBusy} canAct={canAct} error={deleteError} onCancel={() => setDeleting(null)} onConfirm={() => void confirmDelete()} />}
  </main>;
}
