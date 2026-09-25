import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import { CreateTargetSelector, type CreateTargetControl } from './GlobalCreateControls';
import { supabase } from '../lib/supabase';
import { canConfirmCreate, canUseCreateTarget, createSubmitLock, resetTaskAssignmentForTarget } from '../lib/global-create';
import { normalizeTaskTitle, taskAssignmentFromValue, taskAssignmentOptions, taskEditableChanges, taskErrorMessage } from '../lib/task';
import { taskAssignmentForSpace } from '../lib/space-content';
import type { Space, SpaceMember, Task } from '../types';

type TaskSheetProps = {
  task: Task | null;
  spaceId: string;
  spaceKind: Space['kind'];
  userId: string;
  members: SpaceMember[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onMutationError?: (error: unknown) => Promise<boolean>;
  sourceSpaceLabel?: string;
  createTarget?: CreateTargetControl;
  validateGlobalCreate?: (assignedUserId: string | null) => Promise<void>;
};

export function TaskSheet({ task, spaceId, spaceKind, userId, members, onClose, onSaved, onMutationError, sourceSpaceLabel, createTarget, validateGlobalCreate }: TaskSheetProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [assignment, setAssignment] = useState(task?.assigned_to_user_id ?? '');
  const [dueOn, setDueOn] = useState(task?.due_on ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmingCreateTargetId, setConfirmingCreateTargetId] = useState<string | null>(null);
  const submitLock = useRef(createSubmitLock());
  const previousSpaceId = useRef(spaceId);
  const createHeading = useRef<HTMLHeadingElement>(null);
  const createReady = !createTarget || canUseCreateTarget(createTarget.state, createTarget.selectedId, spaceId, members, userId);

  useEffect(() => {
    if (!createTarget || previousSpaceId.current === spaceId) return;
    previousSpaceId.current = spaceId;
    setAssignment(resetTaskAssignmentForTarget);
  }, [createTarget, spaceId]);

  useEffect(() => { setConfirmingCreateTargetId(null); }, [createTarget?.selectedId, createTarget?.state, userId]);
  useEffect(() => { if (createTarget) createHeading.current?.focus(); }, []);

  async function save(event?: FormEvent, confirmed = false) {
    event?.preventDefault();

    let normalizedTitle: string;
    let assignedToUserId: string | null;
    try {
      normalizedTitle = normalizeTaskTitle(title);
      const chosenAssignment = spaceKind === 'shared' ? taskAssignmentFromValue(assignment, members) : null;
      assignedToUserId = taskAssignmentForSpace(spaceKind, task?.assigned_to_user_id ?? null, chosenAssignment);
    } catch (validationError) {
      setError(taskErrorMessage(validationError));
      return;
    }

    if (!task && createTarget) {
      if (!createReady) { setError('请先确认保存空间及任务模块。'); return; }
      if (!confirmed) { setConfirmingCreateTargetId(spaceId); return; }
      if (!canConfirmCreate(confirmingCreateTargetId, createTarget.selectedId, spaceId) || !submitLock.current.acquire()) return;
    }

    setBusy(true);
    setError('');
    let createdSuccessfully = false;
    try {
      const values = { title: normalizedTitle, assigned_to_user_id: assignedToUserId, due_on: dueOn || null };
      const changes = task ? taskEditableChanges(task, values) : values;
      if (!task && createTarget) {
        if (!validateGlobalCreate) throw new Error('无法确认保存空间，请重试。');
        await validateGlobalCreate(assignedToUserId);
      }
      if (task && Object.keys(changes).length === 0) {
        onClose();
        return;
      }
      const result = task
        ? await supabase.from('tasks').update(changes).eq('space_id', spaceId).eq('id', task.id).select('id')
        : await supabase.from('tasks').insert({ ...values, space_id: spaceId, created_by: userId }).select('id');

      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error('未能保存任务，请确认当前空间权限后重试。');
      createdSuccessfully = !task && Boolean(createTarget);
      await onSaved();
      onClose();
    } catch (saveError) {
      if (await onMutationError?.(saveError)) return;
      const message = taskErrorMessage(saveError);
      const rawMessage = saveError && typeof saveError === 'object' && 'message' in saveError ? String(saveError.message) : '';
      setError(createTarget && rawMessage && !/[\u3400-\u9fff]/.test(rawMessage)
        ? '任务保存失败，空间、成员或任务模块可能已变化。请确认后重试。'
        : message);
      setConfirmingCreateTargetId(null);
    } finally {
      setBusy(false);
      if (createTarget && confirmed && !createdSuccessfully) submitLock.current.release();
    }
  }

  async function deleteTask() {
    if (!task) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('space_id', spaceId)
        .eq('id', task.id)
        .select('id');
      if (deleteError) throw deleteError;
      if (!data?.length) throw new Error('未能删除任务，请确认它仍在当前空间。');
      await onSaved();
      onClose();
    } catch (deleteError) {
      if (await onMutationError?.(deleteError)) return;
      setError(taskErrorMessage(deleteError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-ink/35 md:items-center md:px-4 md:py-6">
      <section className="mx-auto max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 shadow-soft safe-bottom md:rounded-lg" role="dialog" aria-modal="true" aria-labelledby="task-sheet-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="task-sheet-title" ref={createHeading} tabIndex={createTarget ? -1 : undefined} className="text-xl font-bold">{task ? '编辑任务' : '新建任务'}</h2>
          <button className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-mist disabled:opacity-60" type="button" onClick={onClose} disabled={busy} aria-label="关闭任务表单">
            <X size={20} />
          </button>
        </div>
        {sourceSpaceLabel && <p className="mt-2 text-sm font-semibold text-teal">所属空间：{sourceSpaceLabel}</p>}
        {!task && createTarget && <div className="mt-4"><CreateTargetSelector control={{ ...createTarget, onSelect: (id) => { setAssignment(resetTaskAssignmentForTarget); setConfirmingCreateTargetId(null); createTarget.onSelect(id); } }} kind="task" disabled={busy} /></div>}

        {error && <p className="mt-4 rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral" role="alert">{error}</p>}

        {confirmingCreateTargetId && !task ? (
          <div className="mt-5 space-y-4">
            <h3 className="text-lg font-bold">确认保存？</h3>
            <p className="text-sm text-ink/70">将保存到：<strong className="block break-words text-base text-ink">{createTarget?.spaces.find((item) => item.id === spaceId)?.name ?? ''}</strong></p>
            <div className="flex gap-3">
              <button className="h-12 flex-1 rounded-lg bg-mist font-semibold" type="button" disabled={busy} onClick={() => setConfirmingCreateTargetId(null)}>取消</button>
              <button className="h-12 flex-1 rounded-lg bg-teal font-semibold text-white disabled:opacity-50" type="button" disabled={busy || !createReady} onClick={() => void save(undefined, true)}>{busy ? '保存中' : '确认保存'}</button>
            </div>
          </div>
        ) : confirmingDelete && task ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-ink/70">确定删除「{task.title}」吗？删除后无法恢复。</p>
            <div className="flex gap-3">
              <button className="h-12 flex-1 rounded-lg bg-mist font-semibold disabled:opacity-60" type="button" disabled={busy} onClick={() => setConfirmingDelete(false)}>取消</button>
              <button className="h-12 flex-1 rounded-lg bg-coral font-semibold text-white disabled:opacity-60" type="button" disabled={busy} onClick={() => void deleteTask()}>{busy ? '删除中' : '确认删除'}</button>
            </div>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={save}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink/70">标题</span>
              <input className="w-full rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal" value={title} onChange={(event) => setTitle(event.target.value)} required />
            </label>
            {spaceKind === 'shared' && (!createTarget || createReady) && <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink/70">分配给</span>
              <select className="w-full rounded-lg border border-ink/15 bg-white px-4 py-3 outline-none focus:border-teal" value={assignment} onChange={(event) => setAssignment(event.target.value)}>
                {taskAssignmentOptions(members, userId).map((option) => (
                  <option key={option.value || 'shared'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>}
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink/70" htmlFor="task-due-on">截止日期（可选）</label>
              <div className="flex gap-2">
                <input id="task-due-on" className="min-w-0 flex-1 rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
                {dueOn && <button className="shrink-0 rounded-lg bg-mist px-3 text-sm font-semibold" type="button" onClick={() => setDueOn('')}>清除</button>}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              {task && (
                <button className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-coral/10 text-coral disabled:opacity-60" type="button" onClick={() => setConfirmingDelete(true)} disabled={busy} aria-label="删除任务">
                  <Trash2 size={20} />
                </button>
              )}
              <button className="h-12 flex-1 rounded-lg bg-teal font-semibold text-white disabled:opacity-60" type="submit" disabled={busy || !createReady}>{busy ? '保存中' : createTarget && !task ? `保存到「${createTarget.spaces.find((item) => item.id === createTarget.selectedId)?.name ?? ''}」` : '保存'}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
