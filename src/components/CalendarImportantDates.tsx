import type { ImportantDateOccurrence } from '../lib/important-date-projection';
import type { CurrentSpace } from '../types';
import { ImportantDateIcon } from './ImportantDatesPage';
import { ImportantDateDeleteDialog, ImportantDateSheet } from './ImportantDateSheet';
import type { CalendarImportantDatesInteraction } from './useCalendarImportantDates';

export function importantDateFallsOnDay(item: ImportantDateOccurrence, day: Date) {
  return item.occurrenceDate.year === day.getFullYear() && item.occurrenceDate.month === day.getMonth() + 1
    && item.occurrenceDate.day === day.getDate();
}

export function CalendarImportantDateStatus({ interaction }: { interaction: CalendarImportantDatesInteraction }) {
  const { state, refresh, editor } = interaction;
  const retained = state.view?.kind === 'calendar';
  const available = !state.scope || state.scope.eligibleSpaces.length > 0;
  return <div className="min-w-0 space-y-2 break-words text-sm text-ink/60">
    {available && state.status === 'loading' && <p role="status">正在读取重要日…</p>}
    {available && retained && state.refreshing && <p role="status">重要日更新中…</p>}
    {retained && !state.calendarComplete && <p role="status">当前范围尚未完整确认。</p>}
    {state.status === 'error' && <p role="alert" className="text-coral">{retained ? '重要日更新失败，请重试。' : state.error}<button type="button" className="ml-2 min-h-11 font-semibold text-teal" onClick={() => void refresh()}>重试重要日</button></p>}
    {editor.notice && <p role="status">{editor.notice}</p>}
    {editor.targetRead.loading && <p role="status">正在确认重要日…</p>}
    {editor.targetRead.error && <p role="alert">{editor.targetRead.error}<button type="button" className="ml-2 min-h-11 font-semibold text-teal" onClick={editor.retry}>重试打开重要日</button></p>}
    {(editor.targetRead.loading || editor.targetRead.error) && <button type="button" className="min-h-11 font-semibold text-teal" onClick={editor.close}>取消打开重要日</button>}
  </div>;
}

export function CalendarImportantDateSheets({ interaction }: { interaction: CalendarImportantDatesInteraction }) {
  const { editor } = interaction;
  if (!editor.editor) return null;
  const target = editor.editor;
  return editor.deleting ? <ImportantDateDeleteDialog date={target.date} space={target.space} busy={editor.busy} error={editor.error}
    canAct onCancel={editor.cancelDelete} onConfirm={() => void editor.confirmDelete()} />
    : <ImportantDateSheet key={`${target.requestId}:${target.space.id}:${target.date.id}`} date={target.date} initialTargetId={target.space.id}
      memberSpaces={[target.space]} eligibleSpaces={[target.space]} canAct onSubmit={editor.save} onCancel={editor.close} onDelete={editor.beginDelete} />;
}

export function importantDateOccurrenceKey(item: ImportantDateOccurrence) {
  return JSON.stringify([item.spaceId, item.importantDateId, item.occurrenceDate.year, item.occurrenceDate.month, item.occurrenceDate.day]);
}

export function CalendarImportantDateCard({ item, space, showSpaceLabel, onOpen }: {
  item: ImportantDateOccurrence; space: CurrentSpace | undefined; showSpaceLabel: boolean;
  onOpen: (item: ImportantDateOccurrence) => void;
}) {
  return <button type="button" className="flex min-h-14 w-full min-w-0 items-start gap-3 rounded-lg border-l-4 border-teal bg-white p-4 text-left shadow-sm"
    data-important-date-id={item.importantDateId} data-space-id={item.spaceId}
    aria-label={`打开重要日 ${item.name}`} onClick={() => onOpen(item)}>
    <span className="mt-1 shrink-0"><ImportantDateIcon emoji={item.emoji} /></span>
    <span className="min-w-0 flex-1">
      <span className="block break-words font-bold text-ink">{item.name}</span>
      <span className="mt-1 block text-xs font-semibold text-teal">重要日 · {space?.kind === 'personal' ? '我的' : '共同'}</span>
      {showSpaceLabel && <span className="mt-2 block break-words text-xs text-ink/60">{space?.kind === 'personal' ? '我的空间' : space?.name}</span>}
    </span>
  </button>;
}
