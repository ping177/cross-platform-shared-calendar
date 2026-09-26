import type { ReviewEntry } from '../types';

export type ReviewEntryDraft = Record<'focus' | 'progress' | 'problems' | 'next_plan', string>;
export type ReviewEntryStatus = '未填写' | '编辑中' | '已填写' | '有更新';

export function reviewEntryDraft(entry: ReviewEntry): ReviewEntryDraft {
  return {
    focus: entry.focus ?? '',
    progress: entry.progress ?? '',
    problems: entry.problems ?? '',
    next_plan: entry.next_plan ?? '',
  };
}

export function hasReviewEntryContent(fields: Record<keyof ReviewEntryDraft, string | null>): boolean {
  return [fields.focus, fields.progress, fields.problems, fields.next_plan]
    .some((value) => /\S/u.test(value ?? ''));
}

export function isReviewEntryDirty(entry: ReviewEntry, draft: ReviewEntryDraft): boolean {
  const saved = reviewEntryDraft(entry);
  return saved.focus !== draft.focus || saved.progress !== draft.progress
    || saved.problems !== draft.problems || saved.next_plan !== draft.next_plan;
}

export function deriveReviewEntryStatus(entry: ReviewEntry): ReviewEntryStatus {
  if (!hasReviewEntryContent(entry)) return '未填写';
  if (entry.filled_revision === null) return '编辑中';
  return entry.filled_revision === entry.content_revision ? '已填写' : '有更新';
}

export function reviewEntryErrorMessage(error: unknown, action: 'load' | 'save' | 'mark'): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (/Review module is disabled/i.test(message)) return '当前空间的回顾模块已关闭，暂时无法保存或标记。';
  if (/Current review participant membership is required|permission denied|row-level security/i.test(message)) {
    return '你的空间成员身份或这次回顾的参与权限已变化，请刷新后重试。';
  }
  if (/Review not found|Space not found/i.test(message)) return '这次回顾或所属空间已不可用，请刷新后重试。';
  if (/Blank review entry cannot be marked filled/i.test(message)) return '请先填写并保存至少一项内容，再标记「我已填写」。';
  if (/[\u3400-\u9fff]/u.test(message)) return message;
  if (action === 'load') return '回顾内容读取失败，请重试。';
  if (action === 'save') return '保存失败，请检查网络或空间状态后重试；未保存的内容仍保留。';
  return '标记失败，请检查网络或空间状态后重试。';
}
