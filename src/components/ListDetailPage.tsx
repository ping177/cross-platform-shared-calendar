import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, Plus } from 'lucide-react';
import { deleteList, renameList } from '../lib/lists-data';
import { commitConfirmedDetailMutation, deriveListDetail, initialListDetailUiState, normalizeDetailText, reconcileListDetailUiState, settleQuickAddDraft, ungroupedKey, type DetailRegion, type ListDetailUiState } from '../lib/lists-detail';
import { createListItem, createListSection, deleteListItem, deleteListSection, editListItem, renameListSection, setListItemCompleted, type ListDetailRead, type ListDetailTarget } from '../lib/lists-detail-data';
import { supabase } from '../lib/supabase';
import type { ListItem, ListSection } from '../types';
import { ListDeleteDialog, ListEditorSheet } from './ListSheets';
import { useListDetail } from './useListDetail';

type Ready = Extract<ListDetailRead, { status: 'ready' }>;

function QuickAdd({ label, value, busy, disabled, onInput, onChange, onSubmit }: {
  label: string; value: string; busy: boolean; disabled: boolean;
  onInput: (input: HTMLInputElement | null) => void; onChange: (value: string) => void; onSubmit: () => void;
}) {
  return <form className="flex min-w-0 items-center gap-2" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <input ref={onInput} className="min-h-11 min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 outline-none focus-visible:border-teal" aria-label={label} placeholder="＋ 添加一项…" value={value} readOnly={busy} onChange={(event) => onChange(event.target.value)} />
    <button className="min-h-11 shrink-0 rounded-lg bg-teal px-4 font-semibold text-white disabled:opacity-50" type="submit" disabled={disabled || busy || !value.trim()}>添加</button>
  </form>;
}

function ItemRow({ item, editing, busy, disabled, onToggle, onEdit, onEditChange, onSave, onCancel, onDelete }: {
  item: ListItem; editing: ListDetailUiState['editing']; busy: boolean; disabled: boolean;
  onToggle: () => void; onEdit: () => void; onEditChange: (value: string) => void;
  onSave: () => void; onCancel: () => void; onDelete: () => void;
}) {
  const isEditing = editing?.kind === 'item' && editing.id === item.id;
  return <li className="flex min-w-0 items-start gap-2 border-b border-ink/5 py-2 last:border-0" data-item-id={item.id}>
    <label className="grid min-h-11 w-11 shrink-0 place-items-center" aria-label={`${item.completed ? '重新打开' : '完成'} ${item.content}`}>
      <input className="h-5 w-5 accent-teal" type="checkbox" checked={item.completed} disabled={disabled || busy} onChange={onToggle} />
    </label>
    {isEditing ? <form className="flex min-w-0 flex-1 flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <input className="min-h-11 min-w-0 flex-1 rounded-lg border border-ink/15 px-3" aria-label="编辑项目内容" value={editing.draft} disabled={disabled || busy} onChange={(event) => onEditChange(event.target.value)} />
      <button className="min-h-11 rounded-lg px-3 font-semibold text-teal" type="submit" disabled={disabled || busy || !editing.draft.trim()}>保存</button>
      <button className="min-h-11 rounded-lg px-3" type="button" disabled={busy} onClick={onCancel}>取消</button>
    </form> : <>
      <span className={`min-w-0 flex-1 break-words py-2.5 ${item.completed ? 'text-ink/50 line-through' : ''}`}>{item.content}</span>
      <div className="flex shrink-0 gap-1">
        <button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-teal" type="button" disabled={disabled || busy} onClick={onEdit} aria-label={`编辑 ${item.content}`}>编辑</button>
        <button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-coral" type="button" disabled={disabled || busy} onClick={onDelete} aria-label={`删除 ${item.content}`}>删除</button>
      </div>
    </>}
  </li>;
}

export function ListDetailRegion({ regionKey, regionLabel, region, ui, busy, disabled, onToggleFold, onToggleItem, onEditItem, onEditChange, onSaveEdit, onCancelEdit, onDeleteItem }: {
  regionKey: string; regionLabel: string; region: DetailRegion; ui: ListDetailUiState; busy: boolean; disabled: boolean;
  onToggleFold: () => void; onToggleItem: (item: ListItem) => void; onEditItem: (item: ListItem) => void;
  onEditChange: (value: string) => void; onSaveEdit: () => void; onCancelEdit: () => void; onDeleteItem: (item: ListItem) => void;
}) {
  const item = (row: ListItem) => <ItemRow key={row.id} item={row} editing={ui.editing} busy={busy} disabled={disabled}
    onToggle={() => onToggleItem(row)} onEdit={() => onEditItem(row)} onEditChange={onEditChange}
    onSave={onSaveEdit} onCancel={onCancelEdit} onDelete={() => onDeleteItem(row)} />;
  return <div data-region={regionKey}>
    {region.active.length > 0 && <ul>{region.active.map(item)}</ul>}
    {region.completed.length > 0 && <div className="mt-2">
      <button className="flex min-h-11 w-full items-center justify-between rounded-lg bg-mist px-3 text-left text-sm font-semibold text-ink/65" type="button" aria-expanded={Boolean(ui.foldOpen[regionKey])} aria-label={`${regionLabel}已完成 ${region.completedCount} 项`} onClick={onToggleFold}>
        <span>已完成 {region.completedCount}</span><ChevronDown size={18} className={ui.foldOpen[regionKey] ? 'rotate-180' : ''} aria-hidden="true" />
      </button>
      {ui.foldOpen[regionKey] && <ul id={`completed-${regionKey}`} className="mt-1">{region.completed.map(item)}</ul>}
    </div>}
  </div>;
}

export function ListDetailPage({ userId, target, onBack, onUnavailable }: {
  userId: string; target: ListDetailTarget; onBack: () => void;
  onUnavailable: (result: Extract<ListDetailRead, { status: 'ineligible' | 'deleted' }>) => void;
}) {
  const { state, syncError, refresh, reconnect, applyConfirmed } = useListDetail(userId, target, onUnavailable);
  const [ui, setUi] = useState(initialListDetailUiState);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [listDelete, setListDelete] = useState<{ step: 1 | 2; busy: boolean; error: string; listName: string; spaceName: string } | null>(null);
  const [sectionDeleteId, setSectionDeleteId] = useState<string | null>(null);
  const [sectionCreateError, setSectionCreateError] = useState('');
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const mutationLock = useRef(false);
  const listDeleteLock = useRef(false);
  const data: Ready | null = state.status === 'ready' ? state.data : null;
  const disabled = state.degraded || !data;

  useEffect(() => {
    if (!data) return;
    setUi((current) => reconcileListDetailUiState(current, data.sections, data.items));
    setSectionDeleteId((current) => current && data.sections.some((section) => section.id === current) ? current : null);
    setListDelete((current) => current && (current.listName !== data.list.name || current.spaceName !== data.space.name)
      ? { step: 1, busy: false, error: '清单资料已变化，请重新确认删除目标。', listName: data.list.name, spaceName: data.space.name } : current);
  }, [data]);

  function errorMessage(error: unknown, fallback: string) {
    return error instanceof Error && /[\u3400-\u9fff]/u.test(error.message) ? error.message : fallback;
  }

  async function runMutation<T>(key: string, action: () => Promise<T>, onSuccess?: (result: T) => void) {
    if (mutationLock.current || disabled) return;
    mutationLock.current = true;
    setBusyKey(key);
    setMutationError('');
    try {
      await commitConfirmedDetailMutation(action, (result) => onSuccess?.(result), refresh);
    } catch (error) {
      setMutationError(errorMessage(error, '操作失败，请检查网络或空间资格后重试。'));
      await refresh();
    } finally {
      mutationLock.current = false;
      setBusyKey(null);
    }
  }

  function setQuickDraft(key: string, value: string) {
    setUi((current) => ({ ...current, quickDrafts: { ...current.quickDrafts, [key]: value } }));
  }

  function quickAdd(key: string, sectionId: string | null) {
    const value = ui.quickDrafts[key] ?? '';
    let content: string;
    try { content = normalizeDetailText(value, '项目内容'); }
    catch (error) { setMutationError(errorMessage(error, '项目内容无效。')); return; }
    void runMutation(`quick:${key}`, () => createListItem(supabase, target, sectionId, content), (item) => {
      applyConfirmed({ kind: 'item', row: item });
      setUi((current) => settleQuickAddDraft(current, key, value, true));
      requestAnimationFrame(() => inputRefs.current.get(key)?.focus());
    });
  }

  function createSection() {
    const draft = ui.sectionCreateDraft ?? '';
    let name: string;
    try { name = normalizeDetailText(draft, '分组名称'); }
    catch (error) { setSectionCreateError(errorMessage(error, '分组名称无效。')); return; }
    setSectionCreateError('');
    void runMutation('create-section', () => createListSection(supabase, target.listId, name), (section) => {
      applyConfirmed({ kind: 'section', row: section });
      setUi((current) => ({ ...current, sectionCreateDraft: null }));
      requestAnimationFrame(() => document.getElementById('list-add-section')?.focus());
    });
  }

  function saveEdit() {
    if (!data || !ui.editing) return;
    const edit = ui.editing;
    void runMutation(`edit:${edit.id}`, async () => {
      if (edit.kind === 'section') {
        const section = data.sections.find((row) => row.id === edit.id);
        const row = section && await renameListSection(supabase, section, edit.draft);
        if (!row) throw new Error('分组当前不可访问或已删除。');
        return { kind: 'section' as const, row };
      } else {
        const item = data.items.find((row) => row.id === edit.id);
        const row = item && await editListItem(supabase, target, item, edit.draft);
        if (!row) throw new Error('项目当前不可访问或已删除。');
        return { kind: 'item' as const, row };
      }
    }, (change) => { applyConfirmed(change); setUi((current) => ({ ...current, editing: null })); });
  }

  async function saveListName(name: string) {
    if (!data || disabled) throw new Error('清单资格尚未确认，请重试。');
    const updated = await renameList(supabase, data.list, name);
    if (!updated) {
      await refresh();
      throw new Error('清单当前不可访问或已删除。');
    }
    applyConfirmed({ kind: 'list', row: updated });
    setRenameOpen(false);
    void refresh();
  }

  async function confirmListDelete() {
    if (!data || !listDelete || disabled || listDelete.busy || listDeleteLock.current) return;
    if (listDelete.step === 1) { setListDelete({ ...listDelete, step: 2, error: '' }); return; }
    listDeleteLock.current = true;
    setListDelete({ ...listDelete, step: 2, busy: true, error: '' });
    try {
      await deleteList(supabase, target.listId);
      onUnavailable({ status: 'deleted', eligibleSpaces: [data.space] });
    } catch (error) {
      await refresh();
      setListDelete({ step: 1, busy: false, error: errorMessage(error, '删除失败，请重试。'), listName: data.list.name, spaceName: data.space.name });
    } finally { listDeleteLock.current = false; }
  }

  function requestSectionDelete(section: ListSection, total: number) {
    if (total === 0) {
      confirmSectionDelete(section.id, true);
    } else setSectionDeleteId(section.id);
  }

  function confirmSectionDelete(sectionId: string, preserveItems: boolean) {
    void runMutation(`delete-section:${sectionId}`, () => deleteListSection(supabase, target.listId, sectionId, preserveItems), () => {
      applyConfirmed({ kind: 'section-delete', id: sectionId, preserveItems });
      if (!preserveItems) setUi((current) => ({ ...current, quickDrafts: Object.fromEntries(Object.entries(current.quickDrafts).filter(([key]) => key !== sectionId)) }));
      setSectionDeleteId(null);
    });
  }

  const derived = data ? deriveListDetail(target.listId, target.spaceId, data.sections, data.items, data.projectedUngroupedOrder) : null;
  const sectionToDelete = derived?.sections.find((entry) => entry.section.id === sectionDeleteId) ?? null;
  const editingChange = (draft: string) => setUi((current) => current.editing ? { ...current, editing: { ...current.editing, draft } } : current);
  const toggleFold = (key: string) => setUi((current) => ({ ...current, foldOpen: { ...current.foldOpen, [key]: !current.foldOpen[key] } }));
  const itemRegion = (key: string, label: string, region: DetailRegion) => <ListDetailRegion regionKey={key} regionLabel={label} region={region} ui={ui} busy={busyKey !== null} disabled={disabled}
    onToggleFold={() => toggleFold(key)} onToggleItem={(item) => { void runMutation(`complete:${item.id}`, () => setListItemCompleted(supabase, target, item, !item.completed), (row) => applyConfirmed({ kind: 'item', row })); }}
    onEditItem={(item) => setUi((current) => ({ ...current, editing: { kind: 'item', id: item.id, draft: item.content } }))}
    onEditChange={editingChange} onSaveEdit={saveEdit} onCancelEdit={() => setUi((current) => ({ ...current, editing: null }))}
    onDeleteItem={(item) => { void runMutation(`delete-item:${item.id}`, () => deleteListItem(supabase, target.listId, item.id), () => applyConfirmed({ kind: 'item-delete', id: item.id })); }} />;
  const quick = (key: string, label: string, sectionId: string | null) => <QuickAdd label={label} value={ui.quickDrafts[key] ?? ''} busy={busyKey === `quick:${key}`} disabled={disabled || (busyKey !== null && busyKey !== `quick:${key}`)}
    onInput={(input) => { if (input) inputRefs.current.set(key, input); else inputRefs.current.delete(key); }}
    onChange={(value) => setQuickDraft(key, value)} onSubmit={() => quickAdd(key, sectionId)} />;

  return <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-4 safe-bottom">
    <header className="flex min-h-11 items-center gap-3">
      <button className="inline-flex min-h-11 items-center gap-1 font-semibold text-teal" type="button" onClick={onBack}><ChevronLeft size={18} aria-hidden="true" />清单总览</button>
      <span className="text-sm text-ink/60">清单详情</span>
    </header>
    {state.status === 'loading' && <p className="mt-4 rounded-lg bg-white p-4" role="status">正在读取清单详情…</p>}
    {state.status === 'error' && <div className="mt-4 rounded-lg bg-white p-4" role="alert">{state.error}<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={() => void refresh()}>重试</button></div>}
    {data && derived && <>
      <div className="mt-4 rounded-lg bg-white p-4 shadow-sm">
        <p className="text-xs text-teal">{data.space.kind === 'personal' ? '我的空间' : data.space.name}</p>
        <h1 className="mt-1 break-words text-xl font-bold">{data.list.name}</h1>
        <div className="mt-2 flex gap-2">
          <button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-teal" type="button" disabled={disabled} onClick={() => setRenameOpen(true)}>清单改名</button>
          <button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-coral" type="button" disabled={disabled} onClick={() => setListDelete({ step: 1, busy: false, error: '', listName: data.list.name, spaceName: data.space.name })}>删除清单</button>
        </div>
      </div>
      {(state.error || syncError || mutationError) && <div className="mt-3 rounded-lg bg-coral/10 p-3 text-sm text-coral" role="alert">{state.error || syncError || mutationError}<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={reconnect}>重试读取</button></div>}
      {ui.recovered.length > 0 && <div className="mt-3 rounded-lg bg-white p-3 text-sm" role="status">原分组已不可用，以下内容未添加，请复制后自行选择位置：{ui.recovered.map((text, index) => <p key={`${index}:${text}`} className="mt-2 break-words">{text}</p>)}<button className="mt-2 min-h-11 font-semibold text-teal" type="button" onClick={() => setUi((current) => ({ ...current, recovered: [] }))}>清除提示</button></div>}
      <section className="mt-4 rounded-lg bg-white p-4 shadow-sm" aria-label="清单项目">
        {quick(ungroupedKey, '添加清单项目', null)}
        <div className="mt-3">{itemRegion(ungroupedKey, '清单', derived.ungrouped)}</div>
      </section>
      <div className="mt-4">
        {ui.sectionCreateDraft === null ? <button id="list-add-section" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 font-semibold text-teal shadow-sm" type="button" disabled={disabled || busyKey !== null} onClick={() => { setUi((current) => ({ ...current, sectionCreateDraft: '' })); setSectionCreateError(''); }}><Plus size={18} aria-hidden="true" />添加分组</button>
          : <form className="rounded-lg bg-white p-4 shadow-sm" onSubmit={(event) => { event.preventDefault(); createSection(); }}>
            <input autoFocus className="min-h-11 w-full rounded-lg border border-ink/15 px-3" aria-label="分组名称" placeholder="分组名称" value={ui.sectionCreateDraft} readOnly={busyKey === 'create-section'} disabled={disabled} onChange={(event) => setUi((current) => ({ ...current, sectionCreateDraft: event.target.value }))} />
            {sectionCreateError && <p className="mt-2 text-sm text-coral" role="alert">{sectionCreateError}</p>}
            <div className="mt-2 flex gap-2"><button className="min-h-11 rounded-lg bg-teal px-4 font-semibold text-white" type="submit" disabled={disabled || busyKey !== null || !ui.sectionCreateDraft.trim()}>创建分组</button><button className="min-h-11 rounded-lg px-4" type="button" disabled={busyKey !== null} onClick={() => setUi((current) => ({ ...current, sectionCreateDraft: null }))}>取消</button></div>
          </form>}
      </div>
      <div className="mt-4 space-y-4">{derived.sections.map(({ section, region }) => {
        const collapsed = Boolean(ui.collapsed[section.id]);
        const editing = ui.editing?.kind === 'section' && ui.editing.id === section.id;
        return <section key={section.id} className="rounded-lg bg-white p-4 shadow-sm" data-section-id={section.id}>
          <div className="flex min-w-0 items-start justify-between gap-2">
            {editing ? <form className="flex min-w-0 flex-1 flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); saveEdit(); }}><input className="min-h-11 min-w-0 flex-1 rounded-lg border border-ink/15 px-3" aria-label="编辑分组名称" value={ui.editing?.draft ?? ''} disabled={disabled || busyKey !== null} onChange={(event) => editingChange(event.target.value)} /><button className="min-h-11 font-semibold text-teal" type="submit" disabled={disabled || busyKey !== null}>保存</button><button className="min-h-11" type="button" onClick={() => setUi((current) => ({ ...current, editing: null }))}>取消</button></form>
              : <button className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left" type="button" aria-expanded={!collapsed} onClick={() => setUi((current) => ({ ...current, collapsed: { ...current.collapsed, [section.id]: !current.collapsed[section.id] } }))}><ChevronDown size={18} className={collapsed ? '-rotate-90 shrink-0' : 'shrink-0'} aria-hidden="true" /><span className="min-w-0 flex-1 break-words font-semibold">{section.name}</span><span className="shrink-0 text-sm text-ink/60">{region.completedCount} / {region.total}</span></button>}
            {!editing && <div className="flex shrink-0 gap-1"><button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-teal" type="button" disabled={disabled || busyKey !== null} onClick={() => setUi((current) => ({ ...current, editing: { kind: 'section', id: section.id, draft: section.name } }))} aria-label={`改名 ${section.name}`}>改名</button><button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-coral" type="button" disabled={disabled || busyKey !== null} onClick={() => requestSectionDelete(section, region.total)} aria-label={`删除分组 ${section.name}`}>删除</button></div>}
          </div>
          {!collapsed && <div className="mt-3">{itemRegion(section.id, section.name, region)}<div className="mt-3">{quick(section.id, `在${section.name}添加项目`, section.id)}</div></div>}
        </section>;
      })}</div>
    </>}
    {renameOpen && data && <ListEditorSheet mode="rename" list={data.list} memberSpaces={[data.space]} eligibleSpaces={state.degraded ? [] : [data.space]} userId={userId} eligibilityStatus={state.degraded ? 'error' : 'ready'} eligibilityError={state.error} onRetryEligibility={() => { void refresh(); }} onSubmit={(name) => saveListName(name)} onCancel={() => setRenameOpen(false)} />}
    {listDelete && data && <ListDeleteDialog list={data.list} space={data.space} step={listDelete.step} busy={listDelete.busy} canConfirm={!disabled} error={listDelete.error} eligibilityError={state.error} onRetryEligibility={() => { void refresh(); }} onCancel={() => setListDelete(null)} onConfirm={() => void confirmListDelete()} />}
    {sectionToDelete && <div className="fixed inset-0 z-40 flex items-end bg-ink/50 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="section-delete-title"><div className="mx-auto w-full max-w-md rounded-lg bg-white p-5 shadow-soft safe-bottom"><h2 id="section-delete-title" className="text-lg font-bold">删除分组：{sectionToDelete.section.name}</h2><p className="mt-2 text-sm text-ink/65">其中有 {sectionToDelete.region.total} 项内容。请选择处理方式。</p><div className="mt-4 space-y-2"><button className="min-h-11 w-full rounded-lg bg-teal px-4 font-semibold text-white" type="button" disabled={disabled || busyKey !== null} onClick={() => confirmSectionDelete(sectionToDelete.section.id, true)}>仅删除分组</button><button className="min-h-11 w-full rounded-lg border border-coral px-4 font-semibold text-coral" type="button" disabled={disabled || busyKey !== null} onClick={() => confirmSectionDelete(sectionToDelete.section.id, false)}>删除分组及其中内容</button><button className="min-h-11 w-full rounded-lg px-4" type="button" disabled={busyKey !== null} onClick={() => setSectionDeleteId(null)}>取消</button></div></div></div>}
  </main>;
}
