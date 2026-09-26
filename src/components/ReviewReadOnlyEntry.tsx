import { useId } from 'react';
import { deriveReviewEntryStatus } from '../lib/review-entry';
import type { ReviewEntry } from '../types';

const fields = [
  { key: 'focus', label: '近期专注事项', height: 'h-24' },
  { key: 'progress', label: '近期进展', height: 'h-36' },
  { key: 'problems', label: '面临问题', height: 'h-36' },
  { key: 'next_plan', label: '下一步计划', height: 'h-36' },
] as const;

export function ReviewReadOnlyEntry({ entry }: { entry: ReviewEntry }) {
  const id = useId();
  return <section className="min-w-0 rounded-lg bg-white p-4 shadow-sm" aria-label="对方的回顾内容">
    <p className="text-sm text-ink/70">填写状态：<strong className="text-ink">{deriveReviewEntryStatus(entry)}</strong></p>
    <div className="mt-4 space-y-4">{fields.map(({ key, label, height }) => <div key={key} className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold text-ink/70" id={`${id}-${key}`}>{label}</h3>
      <div className={`${height} min-w-0 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-ink/15 bg-mist/30 px-4 py-3 text-sm`} role="textbox" aria-readonly="true" aria-labelledby={`${id}-${key}`}>{entry[key]?.trim() ? entry[key] : '—'}</div>
    </div>)}</div>
  </section>;
}
