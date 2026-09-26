import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, Plus } from 'lucide-react';
import { createList, deleteList, renameList } from '../lib/lists-data';
import { defaultListCreateTarget, type ListFilter, type ListOverviewRow } from '../lib/lists';
import { supabase } from '../lib/supabase';
import type { CurrentSpace, List } from '../types';
import { ListDeleteDialog, ListEditorSheet } from './ListSheets';
import { useListsOverview } from './useListsOverview';

type Editor = { mode: 'create' | 'rename'; list?: List; memberSpaces: CurrentSpace[] };
type Deleting = { list: List; space: CurrentSpace; step: 1 | 2; busy: boolean; error: string };

export function ListsRows({ rows, spaces, showSource, onRename, onDelete }: {
  rows: ListOverviewRow[]; spaces: CurrentSpace[]; showSource: boolean;
  onRename: (list: List) => void; onDelete: (list: List) => void;
}) {
  const byId = new Map(spaces.map((space) => [space.id, space]));
  return <ul className="space-y-2">{rows.map((row) => {
    const space = byId.get(row.list.space_id);
    return <li key={row.list.id} className="min-w-0 rounded-lg bg-white px-4 py-3 shadow-sm" data-list-id={row.list.id}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold">{row.list.name}</h3>
          {showSource && <p className="mt-1 break-words text-xs text-teal">{space?.kind === 'personal' ? '我的空间' : space?.name ?? '空间不可用'}</p>}
          <p className="mt-1 text-sm text-ink/60">已完成 {row.completedCount} / {row.totalItems}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-teal" type="button" onClick={() => onRename(row.list)} aria-label={`改名 ${row.list.name}`}>改名</button>
          <button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-coral" type="button" onClick={() => onDelete(row.list)} aria-label={`删除 ${row.list.name}`}>删除</button>
        </div>
      </div>
    </li>;
  })}</ul>;
}

export function ListsOverviewPage({ userId, onHubBack, onNoEligible }: { userId: string; onHubBack: () => void; onNoEligible: () => void }) {
  const { filter, state, syncError, chooseFilter, refresh } = useListsOverview(userId, onNoEligible);
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  const [notice, setNotice] = useState('');
  const deletingLock = useRef(false);
  const createButton = useRef<HTMLButtonElement>(null);
  const data = state.status === 'ready' ? state.data : null;
  const shown = (rows: ListOverviewRow[]) => filter === 'all' ? rows : rows.filter((row) => row.list.space_id === filter.spaceId);
  const active = data ? shown(data.grouped.active) : [];
  const completed = data ? shown(data.grouped.completed) : [];
  const editingSpaces = data?.memberSpaces ?? editor?.memberSpaces ?? [];
  const editorEligible = data?.eligibleSpaces ?? [];

  useEffect(() => {
    if (!data) return;
    const lists = data.grouped.active.concat(data.grouped.completed).map((row) => row.list);
    const ids = new Set(lists.map((list) => list.id));
    if (editor?.mode === 'rename' && editor.list && !ids.has(editor.list.id)) {
      setEditor(null);
      setNotice('此清单当前不可访问或已删除，列表已刷新。');
    }
    if (deleting && !ids.has(deleting.list.id)) {
      setDeleting(null);
      setNotice('此清单当前不可访问或已删除，列表已刷新。');
    } else if (deleting) {
      const current = lists.find((list) => list.id === deleting.list.id);
      const space = data.eligibleSpaces.find((candidate) => candidate.id === current?.space_id);
      if (!deleting.busy && current && space && (current.name !== deleting.list.name || space.name !== deleting.space.name)) {
        setDeleting({ list: current, space, step: 1, busy: false, error: '' });
        setNotice('清单信息已变化，请重新确认删除目标。');
      }
    }
  }, [data]);

  function openCreate() {
    if (!data?.eligibleSpaces.length) return;
    setNotice('');
    setEditor({ mode: 'create', memberSpaces: data.memberSpaces });
  }
  function openRename(list: List) {
    if (!data) return;
    setNotice('');
    setEditor({ mode: 'rename', list, memberSpaces: data.memberSpaces });
  }
  function openDelete(list: List) {
    if (!data) return;
    const space = data.eligibleSpaces.find((candidate) => candidate.id === list.space_id);
    if (!space) return;
    setNotice('');
    setDeleting({ list, space, step: 1, busy: false, error: '' });
  }

  async function saveEditor(name: string, spaceId: string) {
    if (!editor) return;
    if (editor.mode === 'create') {
      try {
        await createList(supabase, spaceId, name);
        setEditor(null);
        setNotice(`已在${editingSpaces.find((space) => space.id === spaceId)?.kind === 'personal' ? '我的空间' : editingSpaces.find((space) => space.id === spaceId)?.name ?? '所选空间'}创建清单。`);
        await refresh();
      } catch (error) {
        await refresh();
        throw error;
      }
      return;
    }
    const original = editor.list;
    if (!original) return;
    try {
      const updated = await renameList(supabase, original, name);
      setEditor(null);
      await refresh();
      setNotice(updated ? '清单名称已更新。' : '此清单当前不可访问或已删除，列表已刷新。');
    } catch (error) {
      await refresh();
      throw error;
    }
  }

  async function confirmDelete() {
    if (!deleting || deletingLock.current || state.status !== 'ready') return;
    if (deleting.step === 1) { setDeleting({ ...deleting, step: 2, error: '' }); return; }
    deletingLock.current = true;
    setDeleting({ ...deleting, busy: true, error: '' });
    try {
      await deleteList(supabase, deleting.list.id);
      setDeleting(null);
      setNotice('清单已删除。');
      await refresh();
    } catch (error) {
      const current = await refresh();
      const exists = current?.grouped.active.concat(current.grouped.completed).some((row) => row.list.id === deleting.list.id);
      if (current && !exists) {
        setDeleting(null);
        setNotice('此清单当前不可访问或已删除，列表已刷新。');
      } else {
        setDeleting((value) => value ? { ...value, busy: false, error: error instanceof Error && /[\u3400-\u9fff]/u.test(error.message)
          ? error.message : '删除失败，请确认空间资格后重试。' } : null);
      }
    } finally { deletingLock.current = false; }
  }

  return <main className="min-h-screen bg-mist text-ink">
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-mist/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <button className="inline-flex min-h-11 min-w-0 items-center gap-1 text-sm font-semibold text-teal" type="button" onClick={onHubBack}><ChevronLeft size={18} aria-hidden="true" />功能中心</button>
          <h1 className="min-w-0 truncate text-xl font-bold">清单</h1>
          <button ref={createButton} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal text-white disabled:opacity-50" type="button" aria-label="新建清单" disabled={!data?.eligibleSpaces.length} onClick={openCreate}><Plus size={20} /></button>
        </div>
        {data && <label className="mt-3 block w-full max-w-sm min-w-0">
          <span className="sr-only">筛选清单空间</span>
          <span className="relative block"><select className="h-11 w-full min-w-0 appearance-none truncate rounded-lg bg-white pl-3 pr-10 text-sm font-semibold text-ink shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-teal" aria-label="筛选清单空间" value={filter === 'all' ? 'all' : filter.spaceId} onChange={(event) => chooseFilter(event.target.value === 'all' ? 'all' : { spaceId: event.target.value })}>
            <option value="all">全部空间</option>
            {data.eligibleSpaces.map((space) => <option key={space.id} value={space.id}>{space.kind === 'personal' ? '我的空间' : space.name}</option>)}
          </select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-3.5 text-ink/60" aria-hidden="true" /></span>
        </label>}
      </header>
      <div className="flex-1 space-y-5 px-4 py-4 safe-bottom">
        {notice && <p className="rounded-lg bg-white px-4 py-3 text-sm text-ink/70" role="status">{notice}</p>}
        {syncError && <p className="rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral" role="alert">{syncError}<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={() => void refresh()}>重试</button></p>}
        {state.status === 'loading' && <p className="rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm" role="status">正在读取清单…</p>}
        {state.status === 'error' && <div className="rounded-lg bg-white px-4 py-5 shadow-sm" role="alert">{state.error}<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={() => void refresh()}>重试</button></div>}
        {data && <>
          <section aria-label="进行中清单"><h2 className="mb-3 text-sm font-semibold text-ink/60">进行中 · {active.length}</h2>
            {active.length ? <ListsRows rows={active} spaces={data.eligibleSpaces} showSource={filter === 'all'} onRename={openRename} onDelete={openDelete} /> : <p className="rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm">暂无进行中的清单</p>}
          </section>
          <section aria-label="已完成清单"><button className="flex min-h-14 w-full items-center justify-between rounded-lg bg-white px-4 text-left font-semibold shadow-sm" type="button" aria-expanded={!completedCollapsed} onClick={() => setCompletedCollapsed((value) => !value)}><span>已完成 · {completed.length}</span><ChevronDown size={18} className={completedCollapsed ? 'text-ink/45' : 'rotate-180 text-ink/45'} aria-hidden="true" /></button>
            {!completedCollapsed && <div className="mt-3">{completed.length ? <ListsRows rows={completed} spaces={data.eligibleSpaces} showSource={filter === 'all'} onRename={openRename} onDelete={openDelete} /> : <p className="rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm">暂无已完成的清单</p>}</div>}
          </section>
        </>}
      </div>
    </div>
    {editor && <ListEditorSheet key={editor.mode === 'create' ? 'create' : editor.list?.id} mode={editor.mode} list={editor.list} memberSpaces={editingSpaces} eligibleSpaces={editorEligible} userId={userId} eligibilityStatus={state.status} eligibilityError={state.status === 'error' ? state.error : ''} onRetryEligibility={() => { void refresh(); }} onSubmit={saveEditor} onCancel={() => { setEditor(null); createButton.current?.focus(); }} />}
    {deleting && <ListDeleteDialog list={deleting.list} space={deleting.space} step={deleting.step} busy={deleting.busy} canConfirm={state.status === 'ready'} error={deleting.error} eligibilityError={state.status === 'error' ? state.error : ''} onRetryEligibility={() => { void refresh(); }} onCancel={() => setDeleting(null)} onConfirm={() => void confirmDelete()} />}
  </main>;
}
