import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { markMyReviewFilled, readMyReviewEntry, saveMyReviewEntry } from '../lib/review-entry-data';
import { deriveReviewEntryStatus, hasReviewEntryContent, isReviewEntryDirty, reviewEntryDraft, reviewEntryErrorMessage, type ReviewEntryDraft } from '../lib/review-entry';
import { supabase } from '../lib/supabase';
import { ReviewReadOnlyEntry } from './ReviewReadOnlyEntry';
import type { ReviewEntry } from '../types';

const fields = [
  { key: 'focus', label: '近期专注事项', height: 'h-24' },
  { key: 'progress', label: '近期进展', height: 'h-36' },
  { key: 'problems', label: '面临问题', height: 'h-36' },
  { key: 'next_plan', label: '下一步计划', height: 'h-36' },
] as const;

const emptyDraft: ReviewEntryDraft = { focus: '', progress: '', problems: '', next_plan: '' };

export function ReviewEntryEditor({ reviewId, userId, startEditing = false, onDirtyChange }: { reviewId: string; userId: string; startEditing?: boolean; onDirtyChange?: (dirty: boolean) => void }) {
  const id = useId();
  const [entry, setEntry] = useState<ReviewEntry | null>(null);
  const [draft, setDraft] = useState<ReviewEntryDraft>(emptyDraft);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<'save' | 'mark' | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(startEditing);
  const editButton = useRef<HTMLButtonElement>(null);
  const firstField = useRef<HTMLTextAreaElement>(null);
  const wasEditing = useRef(false);
  const generation = useRef(0);
  const submitting = useRef(false);

  function loadEntry() {
    const request = ++generation.current;
    submitting.current = false;
    setEntry(null);
    setDraft(emptyDraft);
    setBusy(null);
    setError('');
    setPhase('loading');
    setEditing(startEditing);
    void readMyReviewEntry(supabase, reviewId, userId).then((loaded) => {
      if (request !== generation.current) return;
      setEntry(loaded);
      setDraft(reviewEntryDraft(loaded));
      setPhase('ready');
    }).catch((loadError) => {
      if (request !== generation.current) return;
      setError(reviewEntryErrorMessage(loadError, 'load'));
      setPhase('error');
    });
  }

  useEffect(() => {
    loadEntry();
    return () => { generation.current += 1; };
  }, [reviewId, userId]);

  const currentEntry = entry?.review_id === reviewId && entry.user_id === userId ? entry : null;
  const dirty = currentEntry ? isReviewEntryDirty(currentEntry, draft) : false;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  const status = currentEntry ? deriveReviewEntryStatus(currentEntry) : null;
  const markReady = Boolean(currentEntry && !dirty && !busy && hasReviewEntryContent(currentEntry) && status !== '已填写');

  useEffect(() => {
    if (phase !== 'ready') return;
    if (editing) firstField.current?.focus();
    else if (wasEditing.current) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing, phase]);

  function cancel() {
    if (!currentEntry || busy || submitting.current) return;
    if (dirty && !window.confirm('有未保存的回顾内容，确定取消填写吗？')) return;
    setDraft(reviewEntryDraft(currentEntry));
    setError('');
    setEditing(false);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!currentEntry || !dirty || submitting.current) return;
    const request = generation.current;
    submitting.current = true;
    setBusy('save');
    setError('');
    try {
      const saved = await saveMyReviewEntry(supabase, reviewId, userId, draft);
      if (request !== generation.current) return;
      setEntry(saved);
      setDraft(reviewEntryDraft(saved));
    } catch (saveError) {
      if (request === generation.current) setError(reviewEntryErrorMessage(saveError, 'save'));
    } finally {
      if (request === generation.current) {
        submitting.current = false;
        setBusy(null);
      }
    }
  }

  async function markFilled() {
    if (!markReady || submitting.current) return;
    const request = generation.current;
    submitting.current = true;
    setBusy('mark');
    setError('');
    try {
      const marked = await markMyReviewFilled(supabase, reviewId, userId);
      if (request !== generation.current) return;
      setEntry(marked);
      setDraft(reviewEntryDraft(marked));
      setEditing(false);
    } catch (markError) {
      if (request === generation.current) setError(reviewEntryErrorMessage(markError, 'mark'));
    } finally {
      if (request === generation.current) {
        submitting.current = false;
        setBusy(null);
      }
    }
  }

  if (phase === 'error') return (
    <section className="min-w-0 rounded-ui-group border border-ui-border bg-ui-surface p-ui-4" aria-label="我的回顾内容">
      <p className="text-ui-meta text-ui-danger" role="alert">{error}</p>
      <button type="button" className="ui-focus mt-ui-3 min-h-ui-touch min-w-11 rounded-ui-control bg-ui-soft px-ui-4 font-ui-semibold text-ui-accent" onClick={loadEntry}>重试读取</button>
    </section>
  );

  if (phase !== 'ready' || !currentEntry) return (
    <section className="min-w-0 rounded-ui-group border border-ui-border bg-ui-surface p-ui-4" aria-label="我的回顾内容" aria-busy="true">
      <p className="text-ui-meta text-ui-muted" role="status">正在读取回顾内容…</p>
    </section>
  );

  if (!editing) return <div className="min-w-0">
    <ReviewReadOnlyEntry entry={currentEntry} participant="mine" />
    <button ref={editButton} className="ui-focus mt-ui-4 min-h-ui-touch min-w-11 rounded-ui-control px-ui-3 text-ui-meta font-ui-semibold text-ui-accent" type="button" onClick={() => setEditing(true)}>{status === '未填写' ? '填写我的回顾' : '编辑我的回顾'}</button>
  </div>;

  return (
    <section className="min-w-0" aria-label="填写我的回顾" aria-busy={Boolean(busy)}>
      <h3 className="text-ui-section">填写回顾</h3>
      <p className="mt-ui-2 text-ui-meta text-ui-muted" role="status" aria-live="polite">填写状态：<strong className="font-ui-semibold text-ui-text">{status}</strong></p>
      <p className="mt-ui-1 text-ui-meta text-ui-muted">保存草稿后，再单独标记「我已填写」。</p>
      {dirty && <p className="mt-ui-1 text-ui-meta text-ui-muted" role="status">有未保存修改，请先保存再标记「我已填写」。</p>}
      {!dirty && status === '未填写' && <p className="mt-ui-1 text-ui-meta text-ui-muted">至少保存一项内容后可标记「我已填写」。</p>}
      {error && <p className="mt-ui-3 rounded-ui-control bg-ui-danger-soft px-ui-4 py-ui-3 text-ui-meta text-ui-danger" role="alert">{error}</p>}
      <form className="mt-ui-6 space-y-ui-6" onSubmit={(event) => void save(event)}>
        {fields.map(({ key, label, height }) => (
          <div key={key} className="min-w-0">
            <label className="mb-ui-2 block text-ui-list font-ui-semibold text-ui-text" htmlFor={`${id}-${key}`}>{label}</label>
            <textarea
              ref={key === 'focus' ? firstField : undefined}
              id={`${id}-${key}`}
              className={`ui-focus w-full min-w-0 ${height} resize-y overflow-y-auto break-words rounded-ui-control border border-ui-control bg-ui-surface px-ui-4 py-ui-3 text-ui-body text-ui-text focus:border-ui-focus disabled:bg-ui-soft`}
              value={draft[key]}
              onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
              disabled={Boolean(busy)}
            />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-ui-3 border-t border-ui-border pt-ui-4">
          <button className="ui-focus min-h-ui-touch min-w-0 rounded-ui-control border border-ui-control bg-ui-surface px-ui-3 font-ui-semibold text-ui-accent disabled:opacity-50" type="submit" disabled={!dirty || Boolean(busy)}>
            {busy === 'save' ? '保存中…' : '保存草稿'}
          </button>
          <button className="ui-focus min-h-ui-touch min-w-0 rounded-ui-control bg-ui-accent px-ui-3 font-ui-semibold text-ui-on-accent disabled:opacity-50" type="button" disabled={!markReady} onClick={() => void markFilled()}>
            {busy === 'mark' ? '标记中…' : '我已填写'}
          </button>
          <button className="ui-focus col-span-2 min-h-ui-touch rounded-ui-control px-ui-3 text-ui-meta font-ui-semibold text-ui-muted disabled:opacity-50" type="button" disabled={Boolean(busy)} onClick={cancel}>取消</button>
        </div>
      </form>
    </section>
  );
}
