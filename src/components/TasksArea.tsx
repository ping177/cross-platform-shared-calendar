import { useRef, type ChangeEvent } from 'react';
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Plus } from 'lucide-react';
import { taskAssignmentLabel, canChangeTaskStatus, formatTaskDueDate } from '../lib/task';
import type { TaskFilter } from '../lib/aggregate-tasks';
import type { CurrentSpace, Space, SpaceMember, Task } from '../types';
import { TaskSheet } from './TaskSheet';
import { useAggregateTasks } from './useAggregateTasks';
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
      <select className="h-11 w-full min-w-0 appearance-none truncate rounded-lg bg-white pl-3 pr-10 text-sm font-semibold text-ink shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-teal" aria-label="筛选任务空间" value={filter === 'all' ? 'all' : filter.spaceId} onChange={select}>
        <option value="all">全部空间</option>
        {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-3.5 text-ink/60" aria-hidden="true" />
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
  return <ul className="divide-y divide-ink/10 overflow-hidden rounded-lg bg-white shadow-sm">
    {tasks.map((task) => {
      const source = sourceSpacesById[task.space_id];
      const members = membersBySpaceId[task.space_id] ?? [];
      const canChange = canChangeTaskStatus(task, userId);
      return <li key={task.id} data-space-id={task.space_id} data-task-id={task.id} className="flex min-w-0 items-start gap-2 px-3 py-2">
        {!completed && canChange ? (
          <button className="grid h-11 w-11 shrink-0 place-items-center text-teal disabled:opacity-40" type="button" disabled={busyTaskId !== null} onClick={() => onChangeStatus(task, 'completed')} aria-label={'完成 ' + task.title}><Circle size={23} /></button>
        ) : !completed ? (
          <span className="grid h-11 w-11 shrink-0 place-items-center text-ink/35" role="img" aria-label="由负责人完成"><Circle size={23} /></span>
        ) : <span className="grid h-11 w-11 shrink-0 place-items-center text-teal" role="img" aria-label="已完成"><CheckCircle2 size={23} /></span>}
        <button className="min-h-11 min-w-0 flex-1 py-1 text-left disabled:opacity-40" type="button" disabled={openingTask} onClick={() => onOpen(task)} aria-label={'打开任务 ' + task.title + '，' + (source?.name ?? '空间信息不可用')}>
          <span className="block break-words font-semibold leading-snug">{task.title}</span>
          <span className="mt-1 block min-w-0 break-words text-xs text-teal">{source?.name ?? '空间信息不可用'}</span>
          {(source?.kind === 'shared' || task.due_on) && <span className="mt-1 block break-words text-sm text-ink/55">
            {source?.kind === 'shared' && taskAssignmentLabel(task.assigned_to_user_id, members, userId)}
            {task.due_on && (source?.kind === 'shared' ? ' · ' : '') + formatTaskDueDate(task.due_on)}
          </span>}
        </button>
        {completed && canChange && <button className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-teal disabled:opacity-40" type="button" disabled={busyTaskId !== null} onClick={() => onChangeStatus(task, 'open')} aria-label={'重新打开 ' + task.title}>重新打开</button>}
      </li>;
    })}
  </ul>;
}

export function TasksArea({ screen, onScreenChange, onHubBack, userId }: {
  screen: TasksScreen;
  onScreenChange: (screen: TasksScreen) => void;
  onHubBack: () => void;
  userId: string;
}) {
  const createButton = useRef<HTMLButtonElement>(null);
  const { filter, state, syncError, chooseFilter, refresh } = useAggregateTasks(userId);
  const editor = useTaskModuleEditor(userId, filter, refresh);
  const data = state.data;
  const list = state.status === 'ready' ? screen === 'completed' ? state.data.grouped.completed : state.data.grouped.open : [];
  const create = editor.create;
  const editing = editor.editing;

  return <main className="min-h-screen bg-mist text-ink">
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-mist/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <button className="inline-flex min-h-11 min-w-0 items-center gap-1 text-sm font-semibold text-teal" type="button" onClick={() => screen === 'completed' ? onScreenChange('tasks') : onHubBack()}>
            <ChevronLeft size={18} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{screen === 'completed' ? '任务' : '功能中心'}</span>
          </button>
          <h1 className="min-w-0 truncate text-xl font-bold">{screen === 'completed' ? '已完成任务' : '任务'}</h1>
          {screen === 'tasks' ? <button ref={createButton} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal text-white disabled:opacity-50" type="button" disabled={editor.openingCreate || create !== null || state.status !== 'ready'} onClick={() => void editor.beginCreate()} aria-label="新建任务"><Plus size={20} /></button>
            : <span className="w-11 shrink-0" aria-hidden="true" />}
        </div>
        {data && <TaskFilterPicker spaces={data.eligibleSpaces} filter={filter} onChange={chooseFilter} />}
      </header>

      <section className="flex-1 space-y-4 px-4 py-4 safe-bottom">
        {editor.actionError && <p className="rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral" role="alert">{editor.actionError}</p>}
        {syncError && <p className="rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral" role="alert">{syncError}</p>}
        {state.status === 'loading' && <p className="rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm" role="status">正在读取任务…</p>}
        {state.status === 'error' && <div className="rounded-lg bg-white px-4 py-5 shadow-sm" role="alert">
          <p className="text-sm text-coral">{state.error}</p>
          <button className="mt-2 min-h-11 font-semibold text-teal" type="button" onClick={() => void refresh(true)}>重试</button>
        </div>}
        {state.status === 'ready' && <>
          {screen === 'tasks' && <h2 className="text-sm font-semibold text-ink/60">待完成 · {state.data.grouped.open.length}</h2>}
          {state.data.eligibleSpaces.length === 0 ? <p className="rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm">暂无已开启任务的空间。可在“我的 → 空间管理”中查看模块状态。</p>
            : list.length === 0 ? <p className="rounded-lg bg-white px-4 py-5 text-sm text-ink/60 shadow-sm">{screen === 'completed' ? '暂无已完成事项' : '暂无待完成事项'}</p>
              : <TaskRows tasks={list} sourceSpacesById={state.data.sourceSpacesById} membersBySpaceId={state.data.membersBySpaceId} userId={userId} completed={screen === 'completed'} busyTaskId={editor.busyTaskId} openingTask={editor.openingTask} onOpen={(task) => void editor.openTask(task)} onChangeStatus={(task, status) => void editor.changeStatus(task, status)} />}
          {screen === 'tasks' && <button className="flex min-h-14 w-full items-center justify-between rounded-lg bg-white px-4 text-left font-semibold shadow-sm" type="button" onClick={() => onScreenChange('completed')}>
            <span>已完成 · {state.data.grouped.completed.length}</span><ChevronRight size={18} className="text-ink/45" aria-hidden="true" />
          </button>}
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
    {create?.space && <TaskSheet key="aggregate-create" task={null} spaceId={create.selectedId} spaceKind={create.space.kind} userId={userId} members={create.members}
      createTarget={{ spaces: create.memberSpaces, selectedId: create.selectedId, enabledIds: create.eligibleSpaces.map((space) => space.id), state: create.state, error: create.error, onSelect: editor.chooseCreateTarget, onRetry: () => editor.chooseCreateTarget(create.selectedId) }}
      validateGlobalCreate={editor.validateCreateTarget}
      onSaved={refresh}
      onMutationError={() => editor.revalidateMutation(create.selectedId)}
      onClose={() => { editor.closeCreate(); createButton.current?.focus(); }}
    />}
    {editing && <TaskSheet key={editing.task.space_id + ':' + editing.task.id} task={editing.task} spaceId={editing.task.space_id} spaceKind={editing.space.kind} userId={userId} members={editing.members} sourceSpaceLabel={editing.space.name}
      onSaved={refresh} onMutationError={() => editor.revalidateMutation(editing.task.space_id)} onClose={editor.closeTask}
    />}
  </main>;
}
