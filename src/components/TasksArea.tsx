import { useMobileSwipe } from './useMobileSwipe';
import type { SwipeClickGuard } from '../lib/mobile-swipe';
import { useRef, type ChangeEvent } from 'react';
import { CheckCircle2, ChevronDown, ChevronLeft, Circle, Plus } from 'lucide-react';
import { taskAssignmentLabel, canChangeTaskStatus, formatTaskDueDate } from '../lib/task';
import type { TaskFilter } from '../lib/aggregate-tasks';
import type { ModuleEntry } from '../lib/module-availability';
import type { CurrentSpace, Space, SpaceMember, Task } from '../types';
import { TaskSheet } from './TaskSheet';
import { useAggregateTasks, type TaskData } from './useAggregateTasks';
import { useTaskModuleEditor } from './useTaskModuleEditor';

type TasksScreen = 'tasks' | 'completed';
type SourceSpace = Pick<Space, 'id' | 'name' | 'kind'>;

export function TaskFilterPicker({ spaces, filter, onChange }: {
  spaces: CurrentSpace[];
  filter: TaskFilter;
  onChange: (filter: TaskFilter) => void;
}) {
  function select(event: ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value;
    if (id === 'all') onChange('all');
    else if (spaces.some((space) => space.id === id)) onChange({ spaceId: id });
  }
  return <label className="mt-3 block w-full max-w-sm min-w-0">
    <span className="sr-only">筛选任务空间</span>
    <span className="relative block">
      <select className="min-h-ui-touch w-full min-w-0 appearance-none truncate rounded-ui-control border border-ui-border bg-ui-surface pl-ui-3 pr-10 text-ui-body text-ui-text ui-focus" aria-label="筛选任务空间" value={filter === 'all' ? 'all' : filter.spaceId} onChange={select}>
        <option value="all">全部空间</option>
        {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
      </select>
    </span>
  </label>;
}

export function TaskRows({ tasks, sourceSpacesById, membersBySpaceId, userId, completed, busyTaskId, openingTask, onOpen, onChangeStatus }: {
  tasks: Task[];
  sourceSpacesById: Record<string, SourceSpace>;
  membersBySpaceId: Record<string, SpaceMember[]>;
  userId: string;
  completed: boolean;
  busyTaskId: string | null;
  openingTask: boolean;
  onOpen: (task: Task) => void;
  onChangeStatus: (task: Task, status: Task['status']) => void;
}) {
  return <ul className="ui-task-rows divide-y divide-ui-border overflow-hidden rounded-ui-group border border-ui-border bg-ui-surface">
    {tasks.map((task) => {
      const source = sourceSpacesById[task.space_id];
      const members = membersBySpaceId[task.space_id] ?? [];
      const canChange = canChangeTaskStatus(task, userId);
      return <li key={task.id} data-space-id={task.space_id} data-task-id={task.id} className="ui-task-row flex min-w-0 items-start gap-ui-2 px-ui-3 py-ui-3" data-completed={completed}>
        {!completed && canChange ? (
          <button className="grid h-11 w-11 shrink-0 place-items-center rounded-ui-control text-ui-accent ui-focus disabled:opacity-40" type="button" disabled={busyTaskId !== null} onClick={() => onChangeStatus(task, 'completed')} aria-label={'完成 ' + task.title}><Circle size={23} /></button>
        ) : !completed ? (
          <span className="grid h-11 w-11 shrink-0 place-items-center text-ui-muted" role="img" aria-label="由负责人完成"><Circle size={23} /></span>
        ) : <span className="grid h-11 w-11 shrink-0 place-items-center text-ui-accent" role="img" aria-label="已完成"><CheckCircle2 size={23} /></span>}
        <button data-swipe-start className="min-h-ui-touch min-w-0 flex-1 rounded-ui-control py-ui-1 text-left ui-focus disabled:opacity-40" type="button" disabled={openingTask} onClick={() => onOpen(task)} aria-label={'打开任务 ' + task.title + '，' + (source?.name ?? '空间信息不可用')}>
          <span className="ui-task-title block break-words text-ui-list text-ui-text">{task.title}</span>
          <span className="mt-1 block min-w-0 break-words text-ui-label text-ui-muted">{source?.name ?? '空间信息不可用'}</span>
          {(source?.kind === 'shared' || task.due_on) && <span className="mt-1 block break-words text-ui-meta text-ui-muted">
            {source?.kind === 'shared' && taskAssignmentLabel(task.assigned_to_user_id, members, userId)}
            {task.due_on && (source?.kind === 'shared' ? ' · ' : '') + formatTaskDueDate(task.due_on)}
          </span>}
        </button>
        {completed && canChange && <button className="min-h-ui-touch shrink-0 rounded-ui-control px-ui-2 text-ui-label text-ui-accent ui-focus disabled:opacity-40" type="button" disabled={busyTaskId !== null} onClick={() => onChangeStatus(task, 'open')} aria-label={'重新打开 ' + task.title}>重新打开</button>}
      </li>;
    })}
  </ul>;
}

export function TasksArea({ swipeClickGuard, screen, onScreenChange, onHubBack, userId, entry = null, entryPending = false, initialData, onValidated, onInvalidateEligibility }: {
  swipeClickGuard?: SwipeClickGuard;
  screen: TasksScreen;
  onScreenChange: (screen: TasksScreen) => void;
  onHubBack: () => void;
  userId: string;
  entry?: ModuleEntry | null;
  entryPending?: boolean;
  initialData?: TaskData;
  onValidated?: (data: TaskData) => void;
  onInvalidateEligibility?: () => void;
}) {
  const createButton = useRef<HTMLButtonElement>(null);
  const { filter, state, syncError, refreshError, canAct, chooseFilter, refresh } = useAggregateTasks(userId, entry, entryPending, initialData, onValidated);
  const editor = useTaskModuleEditor(userId, filter, refresh, onInvalidateEligibility, entry);
  const data = state.data;
  const list = state.status === 'ready' ? screen === 'completed' ? state.data.grouped.completed : state.data.grouped.open : [];
  const create = editor.create;
  const editing = editor.editing;

  const back = () => screen === 'completed' ? onScreenChange('tasks') : onHubBack();
  const swipe = useMobileSwipe({ enabled: !create && !editing && !editor.openingCreate && !editor.openingTask && editor.busyTaskId === null,
    scope: `${userId}:${screen}:${filter === 'all' ? 'all' : filter.spaceId}`, direction: 'right', clickGuard: swipeClickGuard, onSwipe: back });

  return <main {...swipe} className="ui-tasks min-h-screen bg-ui-page font-ui text-ui-text">
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="ui-tasks-header sticky top-0 z-10 border-b border-ui-border bg-ui-page/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <button className="inline-flex min-h-ui-touch min-w-0 items-center gap-1 rounded-ui-control text-ui-meta font-ui-semibold text-ui-accent ui-focus" type="button" onClick={back}>
            <ChevronLeft size={18} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{screen === 'completed' ? '任务' : '功能中心'}</span>
          </button>
          <h1 className="min-w-0 truncate text-ui-page-title">{screen === 'completed' ? '已完成任务' : '任务'}</h1>
          {screen === 'tasks' ? <button ref={createButton} className="grid h-11 w-11 shrink-0 justify-self-end place-items-center bg-transparent text-ui-accent hover:text-ui-accent-strong ui-focus disabled:text-ui-muted" type="button" disabled={!canAct || editor.openingCreate || create !== null || state.status !== 'ready'} onClick={() => void editor.beginCreate()} aria-label="新建任务"><Plus size={18} aria-hidden="true" /></button>
            : <span className="w-11 shrink-0" aria-hidden="true" />}
        </div>
        {data && <TaskFilterPicker spaces={data.eligibleSpaces} filter={filter} onChange={(next) => { editor.invalidateTaskRequests(); chooseFilter(next); }} />}
      </header>

      <section className="flex-1 space-y-ui-4 px-ui-4 py-ui-5 ui-safe-bottom">
        {editor.actionError && <p className="rounded-ui-control bg-ui-danger-soft px-ui-4 py-ui-3 text-ui-meta text-ui-danger" role="alert">{editor.actionError}</p>}
        {syncError && <p className="rounded-ui-control bg-ui-danger-soft px-ui-4 py-ui-3 text-ui-meta text-ui-danger" role="alert">{syncError}</p>}
        {refreshError && state.status === 'ready' && <p className="rounded-ui-control bg-ui-danger-soft px-ui-4 py-ui-3 text-ui-meta text-ui-danger" role="alert">{refreshError}<button className="ml-2 min-h-ui-touch min-w-11 rounded-ui-control font-ui-semibold text-ui-accent ui-focus" type="button" onClick={() => void refresh()}>重试</button></p>}
        {state.status === 'loading' && <p className="rounded-ui-group border border-ui-border bg-ui-surface px-ui-4 py-ui-5 text-ui-meta text-ui-muted" role="status">正在读取任务…</p>}
        {state.status === 'error' && <div className="rounded-ui-group border border-ui-border bg-ui-surface px-ui-4 py-ui-5" role="alert">
          <p className="text-ui-meta text-ui-danger">{state.error}</p>
          <button className="mt-2 min-h-ui-touch min-w-11 rounded-ui-control font-ui-semibold text-ui-accent ui-focus" type="button" onClick={() => void refresh(true)}>重试</button>
        </div>}
        {state.status === 'ready' && <>
          {screen === 'tasks' && <h2 className="text-ui-meta font-ui-medium text-ui-muted">待完成 · {state.data.grouped.open.length}</h2>}
          {state.data.eligibleSpaces.length === 0 ? <p className="rounded-ui-group border border-ui-border bg-ui-surface px-ui-4 py-ui-5 text-ui-meta text-ui-muted">暂无已开启任务的空间。可在“我的 → 空间管理”中查看模块状态。</p>
            : list.length === 0 ? <p className="rounded-ui-group border border-ui-border bg-ui-surface px-ui-4 py-ui-5 text-ui-meta text-ui-muted">{screen === 'completed' ? '暂无已完成事项' : '暂无待完成事项'}</p>
              : <TaskRows tasks={list} sourceSpacesById={state.data.sourceSpacesById} membersBySpaceId={state.data.membersBySpaceId} userId={userId} completed={screen === 'completed'} busyTaskId={canAct ? editor.busyTaskId : 'eligibility-pending'} openingTask={!canAct || editor.openingTask} onOpen={(task) => void editor.openTask(task)} onChangeStatus={(task, status) => void editor.changeStatus(task, status)} />}
          {screen === 'tasks' && <details key={`${userId}:${filter === 'all' ? 'all' : filter.spaceId}`} className="ui-task-completed">
            <summary className="flex min-h-ui-touch cursor-pointer list-none items-center justify-between gap-ui-3 rounded-ui-control text-ui-meta font-ui-medium text-ui-muted ui-focus">
              <span>已完成 · {state.data.grouped.completed.length}</span><ChevronDown size={18} className="ui-task-disclosure shrink-0" aria-hidden="true" />
            </summary>
            <div className="mt-ui-3">
              {state.data.grouped.completed.length === 0 ? <p className="rounded-ui-group border border-ui-border bg-ui-surface px-ui-4 py-ui-5 text-ui-meta text-ui-muted">暂无已完成事项</p>
                : <TaskRows tasks={state.data.grouped.completed} sourceSpacesById={state.data.sourceSpacesById} membersBySpaceId={state.data.membersBySpaceId} userId={userId} completed busyTaskId={canAct ? editor.busyTaskId : 'eligibility-pending'} openingTask={!canAct || editor.openingTask} onOpen={(task) => void editor.openTask(task)} onChangeStatus={(task, status) => void editor.changeStatus(task, status)} />}
            </div>
          </details>}
        </>}
      </section>
    </div>

    {create && !create.space && <div className="fixed inset-0 z-20 flex items-end bg-ink/35 md:items-center md:px-4 md:py-6" role="dialog" aria-modal="true" aria-label="选择任务保存空间">
      <section className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-5 shadow-soft safe-bottom md:rounded-lg">
        <h2 className="text-lg font-bold">选择保存空间</h2>
        <p className="mt-2 text-sm text-ink/60">我的空间暂不可用，请主动选择一个已开启任务的空间。</p>
        {create.eligibleSpaces.map((space) => <button key={space.id} className="mt-2 block min-h-11 w-full break-words rounded-lg px-3 text-left font-semibold text-teal hover:bg-mist" type="button" onClick={() => editor.chooseCreateTarget(space.id)}>{space.name}</button>)}
        <button className="mt-4 min-h-11 font-semibold text-ink/60" type="button" onClick={() => { editor.closeCreate(); createButton.current?.focus(); }}>取消</button>
      </section>
    </div>}
    {create?.space && <TaskSheet moduleView key="aggregate-create" task={null} spaceId={create.selectedId} spaceKind={create.space.kind} userId={userId} members={create.members} actionsAllowed={canAct}
      createTarget={{ spaces: create.memberSpaces, selectedId: create.selectedId, enabledIds: create.eligibleSpaces.map((space) => space.id), state: create.state, error: create.error, onSelect: editor.chooseCreateTarget, onRetry: () => editor.chooseCreateTarget(create.selectedId) }}
      validateGlobalCreate={editor.validateCreateTarget}
      onSaved={refresh}
      onMutationError={() => editor.revalidateMutation(create.selectedId)}
      onClose={() => { editor.closeCreate(); createButton.current?.focus(); }}
    />}
    {editing && <TaskSheet moduleView key={editing.task.space_id + ':' + editing.task.id} task={editing.task} spaceId={editing.task.space_id} spaceKind={editing.space.kind} userId={userId} members={editing.members} sourceSpaceLabel={editing.space.name} actionsAllowed={canAct}
      onSaved={refresh} onMutationError={() => editor.revalidateMutation(editing.task.space_id)} onClose={editor.closeTask}
    />}
  </main>;
}
