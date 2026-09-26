import { useEffect, useRef, useState } from 'react';
import { canSaveListInSpace, defaultListCreateTarget, normalizeListName } from '../lib/lists';
import type { CurrentSpace, List } from '../types';

type EditorProps = {
  mode: 'create' | 'rename';
  list?: List;
  memberSpaces: CurrentSpace[];
  eligibleSpaces: CurrentSpace[];
  userId: string;
  eligibilityStatus?: 'ready' | 'loading' | 'error';
  eligibilityError?: string;
  onRetryEligibility?: () => void;
  onSubmit: (name: string, spaceId: string) => Promise<void>;
  onCancel: () => void;
};

export function ListEditorSheet({ mode, list, memberSpaces, eligibleSpaces, userId, eligibilityStatus = 'ready', eligibilityError = '', onRetryEligibility, onSubmit, onCancel }: EditorProps) {
  const personalId = defaultListCreateTarget(memberSpaces, userId);
  const [targetId, setTargetId] = useState(mode === 'create' ? personalId ?? '' : list?.space_id ?? '');
  const [explicitChoice, setExplicitChoice] = useState(false);
  const [name, setName] = useState(mode === 'rename' ? list?.name ?? '' : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const target = memberSpaces.find((space) => space.id === targetId);
  const targetEnabled = canSaveListInSpace(targetId, eligibleSpaces);
  const canSubmit = eligibilityStatus === 'ready' && (mode === 'rename'
    ? targetEnabled : targetEnabled && (targetId === personalId || explicitChoice));

  useEffect(() => { nameInput.current?.focus(); }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || !canSubmit || !target) return;
    let normalized: string;
    try { normalized = normalizeListName(name); }
    catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : '清单名称无效。');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try { await onSubmit(normalized, target.id); }
    catch (submitError) {
      setError(submitError instanceof Error && /[\u3400-\u9fff]/u.test(submitError.message)
        ? submitError.message : '清单保存失败，请确认空间资格后重试。');
    } finally { submitting.current = false; setBusy(false); }
  }

  return <div className="fixed inset-0 z-40 flex items-end bg-ink/50 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="list-editor-title">
    <form className="mx-auto w-full max-w-md rounded-lg bg-white p-5 shadow-soft safe-bottom" onSubmit={(event) => void submit(event)}>
      <h2 id="list-editor-title" className="text-lg font-bold">{mode === 'create' ? '新建清单' : '清单改名'}</h2>
      <label className="mt-4 block text-sm font-semibold" htmlFor="list-space">空间</label>
      {mode === 'create' ? <select id="list-space" className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-ink/20 bg-white px-3" value={targetId} disabled={busy} onChange={(event) => { setTargetId(event.target.value); setExplicitChoice(true); setError(''); }}>
        {!personalId && <option value="">请主动选择空间</option>}
        {memberSpaces.filter((space) => space.id === personalId || eligibleSpaces.some((eligible) => eligible.id === space.id)).map((space) => <option key={space.id} value={space.id}>{space.kind === 'personal' ? '我的空间' : space.name}{eligibilityStatus !== 'ready' || canSaveListInSpace(space.id, eligibleSpaces) ? '' : '（未启用清单）'}</option>)}
      </select> : <p id="list-space" className="mt-2 min-h-11 rounded-lg bg-mist px-3 py-3 text-sm">{target?.kind === 'personal' ? '我的空间' : target?.name ?? '空间不可用'}</p>}
      {eligibilityStatus === 'loading' && <p className="mt-2 text-sm text-ink/65" role="status">正在核对清单空间资格…</p>}
      {eligibilityStatus === 'error' && <p className="mt-2 text-sm text-coral" role="alert">{eligibilityError || '清单空间读取失败。'}<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={onRetryEligibility}>重新读取空间资格</button></p>}
      {mode === 'create' && eligibilityStatus === 'ready' && !targetEnabled && <p className="mt-2 text-sm text-ink/65">{personalId && targetId === personalId ? '我的空间未启用清单。请先开启，或主动选择已启用清单的共享空间。' : '请主动选择已启用清单的空间。'}</p>}
      <label className="mt-4 block text-sm font-semibold" htmlFor="list-name">名称</label>
      <input ref={nameInput} id="list-name" className="mt-2 min-h-11 w-full rounded-lg border border-ink/20 px-3" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} required />
      {error && <p className="mt-3 text-sm text-coral" role="alert">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className="min-h-11 rounded-lg bg-mist px-4 font-semibold" type="button" disabled={busy} onClick={onCancel}>取消</button>
        <button className="min-h-11 rounded-lg bg-teal px-4 font-semibold text-white disabled:opacity-50" type="submit" disabled={busy || !canSubmit || !name.trim()}>{busy ? '保存中…' : mode === 'create' ? '创建清单' : '保存名称'}</button>
      </div>
    </form>
  </div>;
}

export function ListDeleteDialog({ list, space, step, busy, canConfirm = true, error, eligibilityError, onRetryEligibility, onCancel, onConfirm }: {
  list: List; space: CurrentSpace; step: 1 | 2; busy: boolean; error: string;
  canConfirm?: boolean;
  eligibilityError?: string; onRetryEligibility?: () => void;
  onCancel: () => void; onConfirm: () => void;
}) {
  return <div className="fixed inset-0 z-40 flex items-end bg-ink/50 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="list-delete-title">
    <div className="mx-auto w-full max-w-md rounded-lg bg-white p-5 shadow-soft safe-bottom">
      <h2 id="list-delete-title" className="text-lg font-bold">{step === 1 ? '删除清单' : '再次确认删除清单'}</h2>
      <p className="mt-3 break-words text-sm leading-6">清单：<strong>{list.name}</strong><br />空间：<strong>{space.kind === 'personal' ? '我的空间' : space.name}</strong></p>
      <p className="mt-3 text-sm leading-6">{step === 1 ? '这会永久删除清单及其中所有分组和项目，无法恢复。' : '请再次确认：上述清单及其内容将永久删除。'}</p>
      {error && <p className="mt-3 text-sm text-coral" role="alert">{error}</p>}
      {eligibilityError && <p className="mt-3 text-sm text-coral" role="alert">{eligibilityError}<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={onRetryEligibility}>重新读取清单</button></p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className="min-h-11 rounded-lg bg-mist px-4 font-semibold" type="button" disabled={busy} onClick={onCancel}>取消</button>
        <button className="min-h-11 rounded-lg bg-coral px-4 font-semibold text-white disabled:opacity-50" type="button" disabled={busy || !canConfirm} onClick={onConfirm}>{busy ? '删除中…' : step === 1 ? '继续确认' : '永久删除清单'}</button>
      </div>
    </div>
  </div>;
}
