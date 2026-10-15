import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { canSaveImportantDateTarget, normalizeImportantDateDraft, type ImportantDateDraft } from '../lib/important-dates';
import { allDayReminderOptions, defaultReminderKind } from '../lib/reminder';
import type { CurrentSpace, ImportantDate } from '../types';

const commonEmojis = ['🎂', '🎉', '❤️', '💍', '🎁', '🏡', '✈️', '🎓', '🌸', '⭐', '🥂', '👶'];

function useImportantDateDialog(onCancel: () => void, busy: boolean, initialFocusSelector?: string) {
  const container = useRef<HTMLDivElement>(null);
  const current = useRef({ onCancel, busy });
  current.current = { onCancel, busy };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = container.current;
    const initialFocus = initialFocusSelector ? root?.querySelector<HTMLElement>(initialFocusSelector) : null;
    (initialFocus ?? root?.querySelector<HTMLElement>('input, button, select'))?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !current.current.busy) { event.preventDefault(); current.current.onCancel(); }
      if (event.key !== 'Tab') return;
      const elements = Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? []);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    root?.addEventListener('keydown', keydown);
    return () => { root?.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return container;
}

export function ImportantDateSheet({ date, memberSpaces, eligibleSpaces, initialTargetId, canAct, onSubmit, onCancel, onDelete, moduleView = false }: {
  date?: ImportantDate; memberSpaces: CurrentSpace[]; eligibleSpaces: CurrentSpace[]; initialTargetId?: string | null; canAct: boolean;
  onSubmit: (draft: ImportantDateDraft, spaceId: string) => Promise<void>; onCancel: () => void; onDelete: () => void; moduleView?: boolean;
}) {
  // Initialization only: background filter/eligibility changes never rewrite this target.
  const [targetId, setTargetId] = useState(date?.space_id ?? initialTargetId ?? '');
  const [name, setName] = useState(date?.name ?? '');
  const [emoji, setEmoji] = useState(date?.emoji ?? '');
  const [repeat, setRepeat] = useState<'annual' | 'none'>(date?.repeat_kind ?? 'annual');
  const [year, setYear] = useState(date?.year?.toString() ?? '');
  const [month, setMonth] = useState(date?.month.toString() ?? '');
  const [day, setDay] = useState(date?.day.toString() ?? '');
  const [reminder, setReminder] = useState<ImportantDate['reminder_kind']>(date ? date.reminder_kind : defaultReminderKind(true) as ImportantDate['reminder_kind']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emojiExpanded, setEmojiExpanded] = useState(false);
  const emojiTrigger = useRef<HTMLButtonElement>(null);
  const emojiComposing = useRef(false);
  const lock = useRef(false);
  const container = useImportantDateDialog(onCancel, busy, moduleView ? undefined : '#important-date-name');
  const target = memberSpaces.find((space) => space.id === targetId);
  const targetEnabled = Boolean(target) && canSaveImportantDateTarget(targetId, eligibleSpaces);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !canAct || !targetEnabled || (date && targetId !== date.space_id)) return;
    setError('');
    let draft: ImportantDateDraft;
    try { draft = normalizeImportantDateDraft({ name, emoji, reminder_kind: reminder, repeat_kind: repeat, year: year.trim() ? Number(year) : null, month: Number(month), day: Number(day) }); }
    catch (validationError) { setError(validationError instanceof Error ? validationError.message : '日期无效。'); return; }
    lock.current = true;
    setBusy(true);
    try { await onSubmit(draft, targetId); }
    catch (submitError) { setError(submitError instanceof Error && /[\u3400-\u9fff]/u.test(submitError.message) ? submitError.message : '重要日保存失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  }

  return <div ref={container} className="ui-important-overlay font-ui" role="dialog" aria-modal="true" aria-labelledby="important-date-editor-title">
    <form id="important-date-sheet-form" className="ui-important-sheet" onSubmit={(event) => void submit(event)}>
      <header className="ui-important-sheet-header">
        <button className="ui-focus grid h-11 w-11 place-items-center text-ui-muted" type="button" aria-label="关闭重要日表单" disabled={busy} onClick={onCancel}><X size={20} aria-hidden="true" /></button>
        <h2 id="important-date-editor-title" className="min-w-0 text-center text-ui-bar">{date ? '编辑重要日' : '新建重要日'}</h2>
        <button className="ui-focus min-h-11 rounded-ui-control px-ui-3 text-ui-meta font-ui-semibold text-ui-accent disabled:opacity-50" type="submit" disabled={busy || !canAct || !targetEnabled || !name.trim()}>{busy ? '保存中…' : '保存'}</button>
      </header>
      <div className="ui-important-sheet-body">
      <label className="mt-4 block text-sm font-semibold" htmlFor="important-date-name">名称</label>
      <input id="important-date-name" className="mt-2 min-h-11 w-full rounded-lg border border-ink/20 px-3" value={name} disabled={busy} required onChange={(event) => setName(event.target.value)} />
      <label className="mt-4 block text-sm font-semibold" htmlFor="important-date-emoji">Emoji（可选）</label>
      {moduleView ? <div className="ui-important-emoji-field" onKeyDownCapture={(event) => {
        // Capture before the dialog's native Escape listener so only the chooser closes.
        if (event.key !== 'Escape' || !emojiExpanded) return;
        event.stopPropagation();
        if (emojiComposing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        event.preventDefault();
        if (!busy) { setEmojiExpanded(false); emojiTrigger.current?.focus(); }
      }}>
        <div className="ui-important-emoji-input-row">
          <input id="important-date-emoji" className="mt-2 min-h-11 w-full rounded-lg border border-ink/20 px-3" value={emoji} disabled={busy} onChange={(event) => setEmoji(event.target.value)} onCompositionStart={() => { emojiComposing.current = true; }} onCompositionEnd={() => { emojiComposing.current = false; }} />
          <button ref={emojiTrigger} className="ui-focus ui-important-emoji-trigger" type="button" aria-controls="important-date-emoji-choices" aria-expanded={emojiExpanded} disabled={busy} onClick={() => setEmojiExpanded(!emojiExpanded)}>选择</button>
        </div>
        {emojiExpanded && <div id="important-date-emoji-choices" className="ui-important-emoji-choices" role="group" aria-label="常用 Emoji">
          <div className="ui-important-emoji-grid">
            {commonEmojis.map((value) => <button key={value} className="ui-focus ui-important-emoji-choice" type="button" aria-label={`选择 ${value}`} aria-pressed={emoji === value} disabled={busy} onClick={() => { setEmoji(value); setEmojiExpanded(false); emojiTrigger.current?.focus(); }}>{value}</button>)}
          </div>
          <button className="ui-focus ui-important-emoji-clear" type="button" disabled={busy} onClick={() => { setEmoji(''); setEmojiExpanded(false); emojiTrigger.current?.focus(); }}>清除</button>
        </div>}
      </div> : <input id="important-date-emoji" className="mt-2 min-h-11 w-full rounded-lg border border-ink/20 px-3" value={emoji} disabled={busy} onChange={(event) => setEmoji(event.target.value)} />}
      <label className="mt-4 block text-sm font-semibold" htmlFor="important-date-space">空间</label>
      {date ? <p id="important-date-space" className="mt-2 break-words text-sm">{target?.kind === 'personal' ? '我的空间' : target?.name ?? '空间不可用'}</p> : <select id="important-date-space" className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-ink/20 bg-white px-3" value={targetId} disabled={busy} onChange={(event) => { setTargetId(event.target.value); setError(''); }}>
        <option value="">请主动选择空间</option>
        {targetId && !target && <option value={targetId} disabled>当前空间已不可用</option>}
        {memberSpaces.map((space) => <option key={space.id} value={space.id} disabled={!canSaveImportantDateTarget(space.id, eligibleSpaces)}>{space.kind === 'personal' ? '我的空间' : space.name}{canSaveImportantDateTarget(space.id, eligibleSpaces) ? '' : '（未启用重要日）'}</option>)}
      </select>}
      {!targetEnabled && <p className="mt-2 text-sm text-coral" role="alert">空间已不可用或未启用重要日，不能保存。请主动选择有效空间。</p>}
      <label className="mt-4 block text-sm font-semibold" htmlFor="important-date-repeat">重复</label>
      <span className="relative mt-2 block"><select id="important-date-repeat" className="min-h-11 w-full rounded-lg border border-ink/20 bg-white appearance-none pl-3 pr-10" value={repeat} disabled={busy} onChange={(event) => setRepeat(event.target.value as 'annual' | 'none')}><option value="annual">每年</option><option value="none">不重复</option></select></span>
      <div className={`mt-4 grid gap-2 ${repeat === 'annual' ? 'grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-3' : 'grid-cols-3'}`}>
        <label className="min-w-0 text-sm font-semibold">{repeat === 'annual' ? <span className="block min-h-10 sm:min-h-5">开始年份（可选）</span> : '年份'}<input aria-label={repeat === 'annual' ? '开始年份（可选）' : '年份'} className="mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-ink/20 px-3" type="number" min="1" step="1" value={year} required={repeat === 'none'} disabled={busy} onChange={(event) => setYear(event.target.value)} /></label>
        <label className="min-w-0 text-sm font-semibold">{repeat === 'annual' ? <span className="block min-h-10 sm:min-h-5">月</span> : '月'}<input aria-label="月" className={`mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-ink/20 ${repeat === 'annual' ? 'px-2 sm:px-3' : 'px-3'}`} type="number" min="1" max="12" step="1" value={month} required disabled={busy} onChange={(event) => setMonth(event.target.value)} /></label>
        <label className="min-w-0 text-sm font-semibold">{repeat === 'annual' ? <span className="block min-h-10 sm:min-h-5">日</span> : '日'}<input aria-label="日" className={`mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-ink/20 ${repeat === 'annual' ? 'px-2 sm:px-3' : 'px-3'}`} type="number" min="1" max="31" step="1" value={day} required disabled={busy} onChange={(event) => setDay(event.target.value)} /></label>
      </div>
      <label className="mt-4 block text-sm font-semibold" htmlFor="important-date-reminder">提醒</label>
      <span className="relative mt-2 block"><select id="important-date-reminder" className="min-h-11 w-full min-w-0 rounded-lg border border-ink/20 bg-white appearance-none pl-3 pr-10" value={reminder ?? ''} disabled={busy} onChange={(event) => setReminder((event.target.value || null) as ImportantDate['reminder_kind'])}>
        {allDayReminderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></span>
      {target?.kind === 'shared' && <p className="mt-2 text-sm text-ink/60">空间成员共用此提醒设置。</p>}
      {error && <p className="mt-3 text-sm text-coral" role="alert">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {date && <button className="mr-auto min-h-11 rounded-lg px-2 font-semibold text-coral disabled:opacity-50" type="button" disabled={busy || !canAct || !targetEnabled} onClick={onDelete}>删除重要日</button>}
      </div>
      </div>
    </form>
  </div>;
}

export function ImportantDateDeleteDialog({ date, space, busy, canAct, error, onCancel, onConfirm, moduleView = false }: {
  date: ImportantDate; space: CurrentSpace; busy: boolean; canAct: boolean; error: string; onCancel: () => void; onConfirm: () => void; moduleView?: boolean;
}) {
  const container = useImportantDateDialog(onCancel, busy);
  return <div ref={container} className={moduleView ? "ui-important-overlay ui-important-confirm-overlay font-ui" : "ui-important-confirm-overlay fixed inset-0 z-40 flex items-end bg-ink/50 p-4 md:items-center"} role="dialog" aria-modal="true" aria-labelledby="important-date-delete-title">
    <div data-delete-confirm className={`ui-delete-content ${moduleView ? 'ui-important-confirm ' : ''}mx-auto w-full max-w-md rounded-lg bg-white p-5 shadow-soft safe-bottom`}>
      <h2 id="important-date-delete-title" className="ui-delete-title">删除重要日</h2>
      <p className="ui-delete-target">重要日：<strong>{date.name}</strong><br />空间：<strong>{space.kind === 'personal' ? '我的空间' : space.name}</strong></p>
      <p className="ui-delete-warning">这会永久删除此重要日，无法恢复。</p>
      {error && <p className="ui-delete-error" role="alert">{error}</p>}
      <div className="ui-delete-actions">
        <button className="ui-delete-button ui-delete-cancel" type="button" disabled={busy} onClick={onCancel}>取消</button>
        <button className="ui-delete-button ui-delete-danger" type="button" disabled={busy || !canAct} onClick={onConfirm}>{busy ? '删除中…' : '删除'}</button>
      </div>
    </div>
  </div>;
}
