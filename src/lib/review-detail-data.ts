import type { SupabaseClient } from '@supabase/supabase-js';
import { mapReviewDetail, ReviewUnavailableError, type ReviewDetail } from './review-detail.ts';
import type { CurrentSpace, ReviewEntry, ReviewRound } from '../types.ts';

const roundColumns = 'id,space_id,round_no,review_date,created_by,created_at';
const entryColumns = 'review_id,user_id,focus,progress,problems,next_plan,content_revision,filled_revision,updated_at';

async function assertCurrentUser(client: SupabaseClient, userId: string) {
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== userId) throw new Error('登录状态已变化，请重新打开回顾。');
}

export async function readReviewDetail(client: SupabaseClient, space: CurrentSpace, reviewId: string, userId: string): Promise<ReviewDetail> {
  await assertCurrentUser(client, userId);
  const { data: round, error: roundError } = await client.from('review_rounds').select(roundColumns)
    .eq('id', reviewId).eq('space_id', space.id).maybeSingle();
  if (roundError) throw roundError;
  if (!round) throw new ReviewUnavailableError();
  if (round.id !== reviewId || round.space_id !== space.id) throw new ReviewUnavailableError();
  const { data: entries, error: entryError } = await client.from('review_entries').select(entryColumns)
    .eq('review_id', reviewId).order('user_id');
  if (entryError) throw entryError;
  if (!entries) throw new Error('回顾参与者内容读取失败，请重试。');
  await assertCurrentUser(client, userId);
  return mapReviewDetail(round as ReviewRound, entries as ReviewEntry[], space, userId);
}

export async function readPreviousPlan(client: SupabaseClient, round: ReviewRound, userId: string): Promise<string | null> {
  await assertCurrentUser(client, userId);
  const { data, error } = await client.rpc('get_my_previous_review_plan', { p_review_id: round.id });
  if (error) throw error;
  await assertCurrentUser(client, userId);
  if (data !== null && typeof data !== 'string') throw new Error('上一份计划读取不完整，请重试。');
  return typeof data === 'string' && data.trim() ? data : null;
}

export async function correctReviewDate(client: SupabaseClient, round: ReviewRound, reviewDate: string, userId: string): Promise<ReviewRound> {
  await assertCurrentUser(client, userId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewDate)) throw new Error('请选择有效的回顾日期。');
  const { data, error } = await client.rpc('correct_review_date', { p_review_id: round.id, p_review_date: reviewDate });
  if (error) throw error;
  if (!data || data.id !== round.id || data.space_id !== round.space_id || data.round_no !== round.round_no
    || typeof data.review_date !== 'string') throw new Error('无法确认更正后的回顾日期，请刷新后重试。');
  return data as ReviewRound;
}
