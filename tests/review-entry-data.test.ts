import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { markMyReviewFilled, readMyReviewEntry, saveMyReviewEntry } from '../src/lib/review-entry-data.ts';
import type { ReviewEntry } from '../src/types.ts';

const entry: ReviewEntry = {
  review_id: 'review-1', user_id: 'user-1', focus: '专注', progress: null,
  problems: '', next_plan: '下一步', content_revision: 7,
  filled_revision: 5, updated_at: '2026-09-26T08:00:00Z',
};

function fakeClient(options: { userId?: string; row?: unknown; error?: string } = {}) {
  const calls: unknown[][] = [];
  const result = { data: options.row === undefined ? entry : options.row, error: options.error ? { message: options.error } : null };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: options.userId ?? 'user-1' } }, error: null }) },
    from: (table: string) => {
      calls.push(['from', table]);
      return {
        select: (columns: string) => {
          calls.push(['select', columns]);
          return {
            eq: (column: string, value: string) => {
              calls.push(['eq', column, value]);
              return {
                eq: (nextColumn: string, nextValue: string) => {
                  calls.push(['eq', nextColumn, nextValue]);
                  return { maybeSingle: async () => result };
                },
              };
            },
          };
        },
      };
    },
    rpc: async (name: string, args: unknown) => { calls.push(['rpc', name, args]); return result; },
  } as unknown as SupabaseClient;
  return { client, calls };
}

test('read uses the participant row and preserves canonical fields', async () => {
  const { client, calls } = fakeClient();
  assert.deepEqual(await readMyReviewEntry(client, 'review-1', 'user-1'), entry);
  assert.deepEqual(calls, [
    ['from', 'review_entries'],
    ['select', 'review_id,user_id,focus,progress,problems,next_plan,content_revision,filled_revision,updated_at'],
    ['eq', 'review_id', 'review-1'],
    ['eq', 'user_id', 'user-1'],
  ]);
});

test('save passes exact RPC arguments and returns server revision unchanged', async () => {
  const { client, calls } = fakeClient();
  const result = await saveMyReviewEntry(client, 'review-1', 'user-1', {
    focus: '专注', progress: '', problems: '', next_plan: '下一步',
  });
  assert.deepEqual(result, entry);
  assert.deepEqual(calls, [[
    'rpc', 'save_my_review_entry',
    { p_review_id: 'review-1', p_focus: '专注', p_progress: '', p_problems: '', p_next_plan: '下一步' },
  ]]);
});

test('mark uses the existing RPC and takes filled revision from its response', async () => {
  const marked = { ...entry, filled_revision: 7, updated_at: '2026-09-26T09:00:00Z' };
  const { client, calls } = fakeClient({ row: marked });
  assert.deepEqual(await markMyReviewFilled(client, 'review-1', 'user-1'), marked);
  assert.deepEqual(calls, [['rpc', 'mark_my_review_filled', { p_review_id: 'review-1' }]]);
});

test('backend rejection, changed login, and malformed canonical response fail closed', async () => {
  await assert.rejects(saveMyReviewEntry(fakeClient({ error: 'Review module is disabled' }).client,
    'review-1', 'user-1', { focus: '', progress: '', problems: '', next_plan: '' }), { message: 'Review module is disabled' });
  await assert.rejects(markMyReviewFilled(fakeClient({ userId: 'user-2' }).client,
    'review-1', 'user-1'), /登录状态已变化/);
  await assert.rejects(readMyReviewEntry(fakeClient({ row: null }).client,
    'review-1', 'user-1'), /无法读取/);
  await assert.rejects(saveMyReviewEntry(fakeClient({ row: { ...entry, user_id: 'user-2' } }).client,
    'review-1', 'user-1', { focus: '', progress: '', problems: '', next_plan: '' }), /无法确认/);
});
