import type { SupabaseClient } from '@supabase/supabase-js';
import { completeRows } from './aggregate-calendar.ts';
import { listCurrentSpaces } from './current-spaces.ts';
import { eligibleReviewSpaces, mapReviewHistory, reviewHistoryPageSize, type ReviewHistoryRow, type ReviewModuleRow } from './review-history.ts';
import { supabase } from './supabase.ts';
import type { CurrentSpace, ReviewEntry, ReviewRound } from '../types.ts';

async function assertCurrentUser(client: SupabaseClient, userId: string) {
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== userId) throw new Error('登录状态已变化，请重试。');
}

export async function loadReviewEligibility(userId: string, client: SupabaseClient = supabase, readSpaces = listCurrentSpaces): Promise<CurrentSpace[]> {
  await assertCurrentUser(client, userId);
  const spaces = await readSpaces(userId);
  if (!spaces.length) return [];
  const ids = new Set(spaces.map((space) => space.id));
  const modules = await completeRows<ReviewModuleRow>(async (start, end) => {
    const page = await client.from('space_modules').select('space_id,enabled', { count: 'exact' })
      .eq('module_key', 'review').order('space_id').range(start, end);
    if (!page.error && page.data == null) throw new Error('回顾模块数据读取不完整，请重试。');
    return { data: page.data, count: page.count, error: page.error };
  }, (row) => row.space_id, (row) => ids.has(row.space_id) && typeof row.enabled === 'boolean', '回顾模块');
  await assertCurrentUser(client, userId);
  return eligibleReviewSpaces(spaces, modules);
}

export async function loadReviewHistoryPage(client: SupabaseClient, space: CurrentSpace, userId: string, cursor: Pick<ReviewRound, 'review_date' | 'round_no'> | null): Promise<{ rows: ReviewHistoryRow[]; hasMore: boolean }> {
  await assertCurrentUser(client, userId);
  let query = client.from('review_rounds')
    .select('id,space_id,round_no,review_date,created_by,created_at')
    .eq('space_id', space.id)
    .order('review_date', { ascending: false })
    .order('round_no', { ascending: false });
  // round_no is unique within a Space, so the date/number pair is a complete stable cursor.
  if (cursor) query = query.or(`review_date.lt.${cursor.review_date},and(review_date.eq.${cursor.review_date},round_no.lt.${cursor.round_no})`);
  const page = await query.range(0, reviewHistoryPageSize);
  if (page.error) throw page.error;
  if (page.data == null) throw new Error('回顾历史读取不完整，请重试。');
  const hasMore = page.data.length > reviewHistoryPageSize;
  const rounds = page.data.slice(0, reviewHistoryPageSize) as ReviewRound[];
  if (page.data.length > reviewHistoryPageSize + 1 || rounds.some((round) => round.space_id !== space.id)) throw new Error('回顾历史身份校验失败，请重试。');
  let entries: ReviewEntry[] = [];
  if (rounds.length) {
    // All four text fields are needed only to derive the frozen blank/content status; never rendered in list rows.
    const result = await client.from('review_entries')
      .select('review_id,user_id,focus,progress,problems,next_plan,content_revision,filled_revision,updated_at')
      .in('review_id', rounds.map((round) => round.id));
    if (result.error) throw result.error;
    if (result.data == null) throw new Error('回顾参与者状态读取不完整，请重试。');
    entries = result.data as ReviewEntry[];
  }
  await assertCurrentUser(client, userId);
  return { rows: mapReviewHistory(rounds, entries, userId, new Map([[space.id, space]])), hasMore };
}

export async function createReviewRound(client: SupabaseClient, spaceId: string, reviewDate: string, userId: string): Promise<ReviewRound> {
  await assertCurrentUser(client, userId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewDate)) throw new Error('请选择有效的回顾日期。');
  const { data, error } = await client.rpc('create_review_round', { p_space_id: spaceId, p_review_date: reviewDate });
  if (error) throw error;
  if (!data || data.space_id !== spaceId || typeof data.id !== 'string' || !Number.isSafeInteger(data.round_no)
    || data.round_no < 1 || typeof data.review_date !== 'string') throw new Error('无法确认新回顾的服务端记录，请刷新后重试。');
  return data as ReviewRound;
}
