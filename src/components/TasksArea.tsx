import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Plus, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createRequestGuard } from '../lib/request-guard';
import { canChangeTaskStatus, formatTaskDueDate, groupTasks, taskAssignmentLabel, taskErrorMessage, taskRealtimeConfig } from '../lib/task';
import type { Space, SpaceMember, Task } from '../types';
import { TaskSheet } from './TaskSheet';

export type TasksScreen = 'calendar' | 'hub' | 'tasks' | 'completed';

type TasksAreaProps = {
  screen: TasksScreen;
  onScreenChange: (screen: TasksScreen) => void;
  space: Space;
  members: SpaceMember[];
  userId: string;
  invitePanel: ReactNode;
  onMembersOpen: () => void;
  onSpaceSelectorOpen: () => void;
};

const taskBatchSize = 500;

export function TasksArea({ screen, onScreenChange, space, members, userId, invitePanel, onMembersOpen, onSpaceSelectorOpen }: TasksAreaProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const requestGuard = useRef(createRequestGuard());
  const grouped = useMemo(() => groupTasks(tasks), [tasks]);
  const spaceLabel = space.kind === 'personal' ? '我的空间' : space.name;

  async function reloadTasks() {
    const currentRequest = requestGuard.current.begin();
    try {
      const loaded: Task[] = [];
      for (let start = 0; ;) {
        const { data, count, error: loadError } = await supabase
          .from('tasks')
          .select('*', { count: 'exact' })
          .eq('space_id', space.id)
          .order('id', { ascending: true })
          .range(start, start + taskBatchSize - 1);
        if (loadError) throw loadError;
        if (count === null) throw new Error('无法确认 Task 列表是否完整。');
        const batch = (data ?? []) as Task[];
        loaded.push(...batch);
        if (loaded.length >= count) break;
        if (batch.length === 0) throw new Error('Task 列表读取不完整，请重试。');
        start += batch.length;
      }
      if (requestGuard.current.isCurrent(currentRequest)) {
        setTasks(loaded);
        setLoading(false);
        setError('');
      }
    } catch (loadError) {
      if (requestGuard.current.isCurrent(currentRequest)) {
        setLoading(false);
        setError(taskErrorMessage(loadError));
      }
      throw loadError;
    }
  }

  useEffect(() => {
    setTasks([]);
    setLoading(true);
    setError('');
    void reloadTasks().catch(() => undefined);

    const channel = supabase
      .channel(`tasks:${space.id}`)
      .on('postgres_changes', taskRealtimeConfig(space.id), () => {
        void reloadTasks().catch(() => undefined);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setSyncError('');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncError('Tasks 实时同步暂不可用，请检查连接。');
      });

    return () => {
      requestGuard.current.invalidate();
      void supabase.removeChannel(channel);
    };
  }, [space.id]);

  async function refreshAfterMutation() {
    await reloadTasks().catch(() => undefined);
  }

  async function changeStatus(task: Task, status: Task['status']) {
    if (!canChangeTaskStatus(task, userId)) return;
    setBusyTaskId(task.id);
    setError('');
    try {
      const { data, error: updateError } = await supabase
        .from('tasks')
        .update({ status })
        .eq('space_id', space.id)
        .eq('id', task.id)
        .select('id');
      if (updateError) throw updateError;
      if (!data?.length) throw new Error('Task 已变化，请重新读取列表后重试。');
      await refreshAfterMutation();
    } catch (statusError) {
      setError(taskErrorMessage(statusError));
    } finally {
      setBusyTaskId(null);
    }
  }

  if (screen === 'calendar') return null;

  const list = screen === 'completed' ? grouped.completed : grouped.open;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-mist/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <button className="inline-flex min-h-11 min-w-0 items-center gap-1 text-sm font-semibold text-teal" type="button" onClick={() => onScreenChange(screen === 'hub' ? 'calendar' : screen === 'tasks' ? 'hub' : 'tasks')}>
            <ChevronLeft size={18} />
            <span className="truncate">{screen === 'hub' ? '日历' : screen === 'tasks' ? spaceLabel : 'Tasks'}</span>
          </button>
          <h1 className="min-w-0 truncate text-xl font-bold">{screen === 'hub' ? spaceLabel : screen === 'tasks' ? 'Tasks' : '已完成'}</h1>
          {screen === 'hub' ? (
            <button className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-teal" type="button" onClick={onSpaceSelectorOpen}>切换</button>
          ) : screen === 'tasks' ? (
            <button className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal text-white" type="button" onClick={() => setCreating(true)} aria-label="新建 Task">
              <Plus size={20} />
            </button>
          ) : <span className="w-11 shrink-0" aria-hidden="true" />}
        </div>
      </header>

      <section className="flex-1 px-4 py-4 safe-bottom">
        {error && <div className="mb-4 rounded-lg bg-coral/10 p-4 text-sm text-coral" role="alert">{error}<button className="ml-3 font-semibold underline" type="button" onClick={() => void reloadTasks().catch(() => undefined)}>重试</button></div>}
        {syncError && <p className="mb-4 rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral" role="alert">{syncError}</p>}

        {screen === 'hub' ? (
          <div className="space-y-4">
            <button className="flex min-h-14 w-full items-center justify-between rounded-lg bg-white px-4 text-left shadow-sm" type="button" onClick={onMembersOpen}>
              <span className="inline-flex items-center gap-2 font-semibold"><Users size={18} />成员 · {members.length}</span>
              <ChevronRight size={18} className="text-ink/45" />
            </button>
            {space.kind === 'shared' && invitePanel}
            <button className="flex min-h-16 w-full items-center justify-between gap-3 rounded-lg bg-white px-4 text-left shadow-sm" type="button" onClick={() => onScreenChange('tasks')}>
              <span className="font-semibold">Tasks</span>
              <span className="inline-flex shrink-0 items-center gap-2 text-sm text-ink/60">{loading ? '载入中' : `${grouped.open.length} 项待完成`}<ChevronRight size={18} /></span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {screen === 'tasks' && <h2 className="text-sm font-semibold text-ink/60">待完成 · {grouped.open.length}</h2>}
            {loading ? (
              <p className="rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm">正在读取 Tasks…</p>
            ) : list.length === 0 && !error ? (
              <p className="rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm">{screen === 'completed' ? '暂无已完成事项' : '暂无待完成事项'}</p>
            ) : (
              <ul className="divide-y divide-ink/10 overflow-hidden rounded-lg bg-white shadow-sm">
                {list.map((task) => (
                  <li key={task.id} className="flex items-start gap-2 px-3 py-2">
                    {screen === 'tasks' && canChangeTaskStatus(task, userId) ? (
                      <button className="grid h-11 w-11 shrink-0 place-items-center text-teal disabled:opacity-40" type="button" disabled={busyTaskId !== null} onClick={() => void changeStatus(task, 'completed')} aria-label={`完成 ${task.title}`}>
                        <Circle size={23} />
                      </button>
                    ) : screen === 'tasks' ? (
                      <span className="grid h-11 w-11 shrink-0 place-items-center text-ink/35" role="img" aria-label="由负责人完成"><Circle size={23} /></span>
                    ) : <span className="grid h-11 w-11 shrink-0 place-items-center text-teal" role="img" aria-label="已完成"><CheckCircle2 size={23} /></span>}
                    <button className="min-h-11 min-w-0 flex-1 py-1 text-left" type="button" onClick={() => setEditingTask(task)}>
                      <span className="block break-words font-semibold leading-snug">{task.title}</span>
                      {(space.kind === 'shared' || task.due_on) && (
                        <span className="mt-1 block break-words text-sm text-ink/55">
                          {space.kind === 'shared' && taskAssignmentLabel(task.assigned_to_user_id, members, userId)}
                          {task.due_on && `${space.kind === 'shared' ? ' · ' : ''}${formatTaskDueDate(task.due_on)}`}
                        </span>
                      )}
                    </button>
                    {screen === 'completed' && canChangeTaskStatus(task, userId) && (
                      <button className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-teal disabled:opacity-40" type="button" disabled={busyTaskId !== null} onClick={() => void changeStatus(task, 'open')} aria-label={`重新打开 ${task.title}`}>重新打开</button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {screen === 'tasks' && (
              <button className="flex min-h-14 w-full items-center justify-between rounded-lg bg-white px-4 text-left font-semibold shadow-sm" type="button" onClick={() => onScreenChange('completed')}>
                <span>已完成 · {grouped.completed.length}</span>
                <ChevronRight size={18} className="text-ink/45" />
              </button>
            )}
          </div>
        )}
      </section>

      {(creating || editingTask) && (
        <TaskSheet
          key={editingTask?.id ?? 'new'}
          task={editingTask}
          spaceId={space.id}
          spaceKind={space.kind}
          userId={userId}
          members={members}
          onSaved={refreshAfterMutation}
          onClose={() => { setCreating(false); setEditingTask(null); }}
        />
      )}
    </>
  );
}
