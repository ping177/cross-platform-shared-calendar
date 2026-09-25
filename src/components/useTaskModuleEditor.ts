import { useEffect, useRef, useState } from 'react';
import { defaultTaskCreateTarget, type TaskFilter } from '../lib/aggregate-tasks';
import { loadTaskEligibility } from '../lib/aggregate-tasks-data';
import { targetMembersValid } from '../lib/global-create';
import { readSpaceMembers } from '../lib/space-members';
import { supabase } from '../lib/supabase';
import { canChangeTaskStatus, taskErrorMessage } from '../lib/task';
import type { CurrentSpace, SpaceMember, Task } from '../types';
import type { CreateTargetState } from './GlobalCreateControls';

type Eligibility = Awaited<ReturnType<typeof loadTaskEligibility>>;
type CreateContext = Eligibility & {
  selectedId: string;
  space: CurrentSpace | null;
  members: SpaceMember[];
  state: CreateTargetState;
  error: string;
};
type EditContext = { task: Task; space: CurrentSpace; members: SpaceMember[] };

function readableError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  return /[\u3400-\u9fff]/.test(message) ? message : fallback;
}

export function useTaskModuleEditor(userId: string, filter: TaskFilter, refresh: () => Promise<void>) {
  const [create, setCreate] = useState<CreateContext | null>(null);
  const [editing, setEditing] = useState<EditContext | null>(null);
  const [openingCreate, setOpeningCreate] = useState(false);
  const [openingTask, setOpeningTask] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const createGeneration = useRef(0);
  const openGeneration = useRef(0);

  useEffect(() => () => { createGeneration.current += 1; openGeneration.current += 1; }, [userId]);

  async function currentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId) throw new Error('登录状态已变化，请重新打开任务。');
  }

  async function loadCreateTarget(targetId: string, generation: number, known?: Eligibility) {
    setCreate((current) => current?.selectedId === targetId ? { ...current, state: 'loading', error: '', members: [] } : current);
    try {
      const eligibility = known ?? await loadTaskEligibility(userId);
      const space = eligibility.memberSpaces.find((item) => item.id === targetId);
      if (!space) throw new Error('此空间已不在你的成员列表中，请重新选择。');
      const enabled = eligibility.eligibleSpaces.some((item) => item.id === targetId);
      const members = enabled ? await readSpaceMembers(targetId) : [];
      if (enabled && !targetMembersValid(members, targetId, userId)) throw new Error('空间成员资料已变化，请重试。');
      await currentUser();
      if (generation !== createGeneration.current) return;
      setCreate((current) => current?.selectedId === targetId ? {
        ...current, ...eligibility, space, members, state: enabled ? 'ready' : 'blocked', error: '',
      } : current);
    } catch (error) {
      if (generation !== createGeneration.current) return;
      setCreate((current) => current?.selectedId === targetId ? {
        ...current, state: 'error', error: readableError(error, '无法确认任务保存空间，请重试。'), members: [],
      } : current);
    }
  }

  async function beginCreate() {
    const generation = ++createGeneration.current;
    setOpeningCreate(true);
    setActionError('');
    try {
      const eligibility = await loadTaskEligibility(userId);
      if (generation !== createGeneration.current) return;
      if (filter !== 'all' && !eligibility.eligibleSpaces.some((space) => space.id === filter.spaceId)) {
        await refresh();
        throw new Error('当前筛选空间已不可用，请重新选择后创建任务。');
      }
      const selectedId = defaultTaskCreateTarget(filter, eligibility.memberSpaces, eligibility.eligibleSpaces, userId) ?? '';
      const space = eligibility.memberSpaces.find((item) => item.id === selectedId) ?? null;
      if (!space && eligibility.eligibleSpaces.length === 0) throw new Error('没有已启用任务的空间，暂时无法创建任务。');
      setCreate({ ...eligibility, selectedId, space, members: [], state: 'loading', error: '' });
      if (selectedId) void loadCreateTarget(selectedId, generation, eligibility);
    } catch (error) {
      if (generation === createGeneration.current) setActionError(readableError(error, '无法确认可用空间，请重试。'));
    } finally {
      if (generation === createGeneration.current) setOpeningCreate(false);
    }
  }

  function chooseCreateTarget(targetId: string) {
    if (!create?.memberSpaces.some((space) => space.id === targetId)) return;
    if (targetId !== create.selectedId && !create.eligibleSpaces.some((space) => space.id === targetId)) return;
    const generation = ++createGeneration.current;
    setCreate({ ...create, selectedId: targetId, space: create.memberSpaces.find((space) => space.id === targetId) ?? null, members: [], state: 'loading', error: '' });
    void loadCreateTarget(targetId, generation);
  }

  function closeCreate() {
    createGeneration.current += 1;
    setCreate(null);
  }

  async function validateCreateTarget(assignedUserId: string | null) {
    const context = create;
    const generation = createGeneration.current;
    if (!context?.selectedId || context.state !== 'ready') throw new Error('请先确认保存空间及任务模块。');
    await currentUser();
    const eligibility = await loadTaskEligibility(userId);
    const target = eligibility.memberSpaces.find((space) => space.id === context.selectedId);
    if (!target || target.kind !== context.space?.kind) throw new Error('此空间已不在你的成员列表中，请重新选择。');
    if (!eligibility.eligibleSpaces.some((space) => space.id === target.id)) throw new Error('当前空间的任务模块已关闭，请选择其他空间。');
    const members = await readSpaceMembers(target.id);
    if (!targetMembersValid(members, target.id, userId, assignedUserId)) throw new Error('空间成员或分配对象已变化，请重新选择。');
    await currentUser();
    if (generation !== createGeneration.current) throw new Error('保存空间已变化，请重新确认。');
  }

  async function openTask(task: Task) {
    const generation = ++openGeneration.current;
    setOpeningTask(true);
    setActionError('');
    try {
      const eligibility = await loadTaskEligibility(userId);
      const space = eligibility.eligibleSpaces.find((item) => item.id === task.space_id);
      if (!space) throw new Error('此空间的任务已不可用，请重试。');
      const { data, error } = await supabase.from('tasks').select('*').eq('space_id', task.space_id).eq('id', task.id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('任务已变化，请重新读取列表。');
      const members = await readSpaceMembers(task.space_id);
      if (!targetMembersValid(members, task.space_id, userId)) throw new Error('空间成员资料已变化，请重试。');
      await currentUser();
      if (generation === openGeneration.current) setEditing({ task: data as Task, space, members });
    } catch (error) {
      if (generation === openGeneration.current) {
        setActionError(readableError(error, taskErrorMessage(error)));
        await refresh();
      }
    } finally {
      if (generation === openGeneration.current) setOpeningTask(false);
    }
  }

  async function changeStatus(task: Task, status: Task['status']) {
    if (busyTaskId || !canChangeTaskStatus(task, userId)) return;
    setBusyTaskId(task.id);
    setActionError('');
    try {
      const { data, error } = await supabase.from('tasks').update({ status })
        .eq('space_id', task.space_id).eq('id', task.id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('任务已变化，请重新读取列表后重试。');
      await refresh();
    } catch (error) {
      setActionError(taskErrorMessage(error));
      await refresh();
    } finally {
      setBusyTaskId(null);
    }
  }

  async function revalidateMutation(targetSpaceId: string) {
    try {
      const eligibility = await loadTaskEligibility(userId);
      if (!eligibility.eligibleSpaces.some((space) => space.id === targetSpaceId)) {
        if (editing?.task.space_id === targetSpaceId) setEditing(null);
        if (create?.selectedId === targetSpaceId) setCreate((current) => current ? { ...current, ...eligibility, state: 'blocked', members: [] } : current);
        setActionError('当前空间的任务已不可用，请重新选择或重试。');
        await refresh();
        return Boolean(editing);
      }
    } catch {
      setActionError('任务模块状态读取失败，请重试。');
    }
    await refresh();
    return false;
  }

  return {
    create, editing, openingCreate, openingTask, busyTaskId, actionError,
    beginCreate, chooseCreateTarget, closeCreate, validateCreateTarget,
    openTask, closeTask: () => { openGeneration.current += 1; setEditing(null); },
    changeStatus, revalidateMutation,
  };
}
