import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReviewEntry } from '../types';
import type { ReviewEntryDraft } from './review-entry';

const entryColumns = 'review_id,user_id,focus,progress,problems,next_plan,content_revision,filled_revision,updated_at';

async function assertCurrentUser(client: SupabaseClient, userId: string) {
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== userId) throw new Error('登录状态已变化，请重新打开回顾。');
}

function canonicalEntry(value: unknown, reviewId: string, userId: string): ReviewEntry {
  if (!value || typeof value !== 'object') throw new Error('无法确认回顾内容的最新状态，请重新载入。');
  const row = value as Record<string, unknown>;
  if (row.review_id !== reviewId || row.user_id !== userId
    || !['focus', 'progress', 'problems', 'next_plan'].every((key) => row[key] === null || typeof row[key] === 'string')
    || !Number.isSafeInteger(row.content_revision) || (row.content_revision as number) < 0
    || (row.filled_revision !== null && (!Number.isSafeInteger(row.filled_revision)
      || (row.filled_revision as number) < 1 || (row.filled_revision as number) > (row.content_revision as number)))
    || typeof row.updated_at !== 'string') {
    throw new Error('无法确认回顾内容的最新状态，请重新载入。');
  }
  return row as ReviewEntry;
}

export async function readMyReviewEntry(client: SupabaseClient, reviewId: string, userId: string): Promise<ReviewEntry> {
  await assertCurrentUser(client, userId);
  const { data, error } = await client.from('review_entries').select(entryColumns)
    .eq('review_id', reviewId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('无法读取这次回顾的本人内容，请确认空间权限后重试。');
  return canonicalEntry(data, reviewId, userId);
}

export async function saveMyReviewEntry(client: SupabaseClient, reviewId: string, userId: string, draft: ReviewEntryDraft): Promise<ReviewEntry> {
  await assertCurrentUser(client, userId);
  const { data, error } = await client.rpc('save_my_review_entry', {
    p_review_id: reviewId,
    p_focus: draft.focus,
    p_progress: draft.progress,
    p_problems: draft.problems,
    p_next_plan: draft.next_plan,
  });
  if (error) throw error;
  return canonicalEntry(data, reviewId, userId);
}

export async function markMyReviewFilled(client: SupabaseClient, reviewId: string, userId: string): Promise<ReviewEntry> {
  await assertCurrentUser(client, userId);
  const { data, error } = await client.rpc('mark_my_review_filled', { p_review_id: reviewId });
  if (error) throw error;
  return canonicalEntry(data, reviewId, userId);
}
