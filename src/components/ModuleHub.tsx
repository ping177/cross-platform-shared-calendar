import { ChevronRight, ListTodo } from 'lucide-react';

export function ModuleHub({ onOpenTasks }: { onOpenTasks: () => void }) {
  return <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-4 safe-bottom">
    <h1 className="text-xl font-bold">功能中心</h1>
    <button className="mt-4 flex min-h-16 w-full min-w-0 items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-left shadow-sm" type="button" onClick={onOpenTasks} aria-label="进入任务">
      <span className="flex min-w-0 items-center gap-3">
        <ListTodo size={20} className="shrink-0 text-teal" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block font-semibold">任务</span>
          <span className="block text-sm text-ink/60">查看各空间的任务</span>
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-ink/45" aria-hidden="true" />
    </button>
  </main>;
}
