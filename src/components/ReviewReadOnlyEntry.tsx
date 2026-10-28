import { useId, type ReactNode } from 'react';
import { deriveReviewEntryStatus } from '../lib/review-entry';
import type { ReviewEntry } from '../types';

const fields = [
  { key: 'focus', label: '近期专注事项' },
  { key: 'progress', label: '近期进展' },
  { key: 'problems', label: '面临问题' },
  { key: 'next_plan', label: '下一步计划' },
] as const;

export function ReviewReadOnlyEntry({ entry, participant = 'other', children }: { entry: ReviewEntry; participant?: 'mine' | 'other'; children?: ReactNode }) {
  const id = useId();
  return <section className="min-w-0" aria-label={participant === 'mine' ? '我的回顾内容' : '对方的回顾内容'}>
    <div className="flex flex-wrap items-center justify-between gap-x-ui-3">
      <p className="text-ui-meta text-ui-muted" role="status" aria-live="polite">填写状态：<strong className="font-ui-semibold text-ui-text">{deriveReviewEntryStatus(entry)}</strong></p>
      {children}
    </div>
    <div className="mt-ui-4 rounded-ui-group border border-ui-border bg-ui-surface">{fields.map(({ key, label }) => <div key={key} className="ui-review-content min-w-0 p-ui-4">
      <h3 className="text-ui-list font-ui-semibold text-ui-text" id={`${id}-${key}`}>{label}</h3>
      <div className="mt-ui-2 min-w-0 whitespace-pre-wrap break-words text-ui-body text-ui-muted" aria-labelledby={`${id}-${key}`}>{entry[key]?.trim() ? entry[key] : '暂无内容'}</div>
    </div>)}</div>
  </section>;
}
