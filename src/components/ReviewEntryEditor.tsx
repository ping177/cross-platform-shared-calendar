import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { markMyReviewFilled, readMyReviewEntry, saveMyReviewEntry } from '../lib/review-entry-data';
import { deriveReviewEntryStatus, hasReviewEntryContent, isReviewEntryDirty, reviewEntryDraft, reviewEntryErrorMessage, type ReviewEntryDraft } from '../lib/review-entry';
import { supabase } from '../lib/supabase';
import type { ReviewEntry } from '../types';

const fields = [
  { key: 'focus', label: '近期专注事项', height: 'h-24' },
  { key: 'progress', label: '近期进展', height: 'h-36' },
  { key: 'problems', label: '面临问题', height: 'h-36' },
  { key: 'next_plan', label: '下一步计划', height: 'h-36' },
] as const;

const emptyDraft: ReviewEntryDraft = { focus: '', progress: '', problems: '', next_plan: '' };

export function ReviewEntryEditor({ reviewId, userId }: { reviewId: string; userId: string }) {
  const id = useId();
  const [entry, setEntry] = useState<ReviewEntry | null>(null);
  const [draft, setDraft] = useState<ReviewEntryDraft>(emptyDraft);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<'save' | 'mark' | null>(null);
  const [error, setError] = useState('');
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
  const status = currentEntry ? deriveReviewEntryStatus(currentEntry) : null;
  const markReady = Boolean(currentEntry && !dirty && !busy && hasReviewEntryContent(currentEntry) && status !== '已填写');

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
    <section className="min-w-0 rounded-lg bg-white p-4 shadow-sm" aria-label="我的回顾内容">
      <p className="text-sm text-coral" role="alert">{error}</p>
      <button type="button" className="mt-3 min-h-11 rounded-lg bg-mist px-4 font-semibold text-teal" onClick={loadEntry}>重试读取</button>
    </section>
  );

  if (phase !== 'ready' || !currentEntry) return (
    <section className="min-w-0 rounded-lg bg-white p-4 shadow-sm" aria-label="我的回顾内容" aria-busy="true">
      <p className="text-sm text-ink/60" role="status">正在读取回顾内容…</p>
    </section>
  );

  return (
    <section className="min-w-0 rounded-lg bg-white p-4 shadow-sm" aria-label="我的回顾内容" aria-busy={Boolean(busy)}>
      <p className="text-sm text-ink/70" role="status" aria-live="polite">填写状态：<strong className="text-ink">{status}</strong></p>
      {dirty && <p className="mt-1 text-sm text-ink/60" role="status">有未保存修改，请先保存再标记「我已填写」。</p>}
      {!dirty && status === '未填写' && <p className="mt-1 text-sm text-ink/60">至少保存一项内容后可标记「我已填写」。</p>}
      {error && <p className="mt-3 rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral" role="alert">{error}</p>}
      <form className="mt-4 space-y-4" onSubmit={(event) => void save(event)}>
        {fields.map(({ key, label, height }) => (
          <div key={key} className="min-w-0">
            <label className="mb-2 block text-sm font-semibold text-ink/70" htmlFor={`${id}-${key}`}>{label}</label>
            <textarea
              id={`${id}-${key}`}
              className={`w-full min-w-0 ${height} resize-none overflow-y-auto break-words rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal disabled:bg-mist/50`}
              value={draft[key]}
              onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
              disabled={Boolean(busy)}
            />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button className="min-h-12 min-w-0 rounded-lg bg-mist px-3 font-semibold text-teal disabled:opacity-50" type="submit" disabled={!dirty || Boolean(busy)}>
            {busy === 'save' ? '保存中…' : '保存'}
          </button>
          <button className="min-h-12 min-w-0 rounded-lg bg-teal px-3 font-semibold text-white disabled:opacity-50" type="button" disabled={!markReady} onClick={() => void markFilled()}>
            {busy === 'mark' ? '标记中…' : '我已填写'}
          </button>
        </div>
      </form>
    </section>
  );
}
