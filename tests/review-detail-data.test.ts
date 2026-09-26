import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurrentSpace, ReviewEntry, ReviewRound } from '../src/types.ts';

const space = { id: 's', name: '共享', kind: 'shared', membershipRole: 'owner' } as CurrentSpace;
const round = { id: 'r2', space_id: 's', round_no: 2, review_date: '2026-09-26', created_by: 'me', created_at: '2026-09-26T00:00:00Z' } as ReviewRound;
const entry = (review_id: string, user_id: string, next_plan: string | null = null): ReviewEntry => ({ review_id, user_id, focus: null, progress: null, problems: null, next_plan, content_revision: next_plan ? 1 : 0, filled_revision: null, updated_at: '2026-09-26T00:00:00Z' });

function fakeClient(log: string[], options: { previousPlans?: Record<string, string | null>; missing?: boolean; wrongRound?: boolean; rpcError?: Error } = {}): SupabaseClient {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'me' } }, error: null }) },
    from(table: string) {
      log.push(`from:${table}`);
      const filters: Record<string, unknown> = {};
      const query = {
        select(columns: string) { log.push(`select:${columns}`); return query; },
        eq(column: string, value: unknown) { filters[column] = value; log.push(`eq:${column}:${value}`); return query; },
        async maybeSingle() { return { data: options.missing ? null : options.wrongRound ? { ...round, id: 'other' } : round, error: null }; },
        async order(column: string) {
          log.push(`order:${column}`);
          return { data: [entry('r2', 'former-member', '旧计划'), entry('r2', 'me')], error: null };
        },
      };
      return query;
    },
    async rpc(name: string, args: unknown) {
      log.push(`rpc:${name}:${JSON.stringify(args)}`);
      if (name === 'get_my_previous_review_plan') {
        const reviewId = (args as { p_review_id: string }).p_review_id;
        return { data: options.previousPlans?.[reviewId] ?? null, error: options.rpcError ?? null };
      }
      return { data: options.rpcError ? null : { ...round, review_date: '2026-09-27' }, error: options.rpcError ?? null };
    },
  } as unknown as SupabaseClient;
}

async function withData(run: (module: Record<string, any>) => Promise<void>) {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try { await run(await vite.ssrLoadModule('/src/lib/review-detail-data.ts')); } finally { await vite.close(); }
}

test('detail reads one RLS-visible round and its actual entries', async () => withData(async ({ readReviewDetail }) => {
  const log: string[] = [];
  const detail = await readReviewDetail(fakeClient(log), space, 'r2', 'me');
  assert.equal(detail.own.user_id, 'me');
  assert.equal(detail.other.user_id, 'former-member');
  assert.ok(log.includes('eq:id:r2'));
  assert.ok(log.includes('eq:space_id:s'));
  assert.ok(log.includes('eq:review_id:r2'));
  assert.ok(!log.some((item) => item.startsWith('from:space_members')));
  await assert.rejects(readReviewDetail(fakeClient([], { missing: true }), space, 'r2', 'me'), /不可访问/);
  await assert.rejects(readReviewDetail(fakeClient([], { wrongRound: true }), space, 'r2', 'me'), /不可访问/);
}));

test('previous plan delegates date chronology and no-fallback semantics to the narrow RPC', async () => withData(async ({ readPreviousPlan }) => {
  const log: string[] = [];
  const r26 = { ...round, id: 'r26', round_no: 1, review_date: '2026-09-26' };
  const r25 = { ...round, id: 'r25', round_no: 2, review_date: '2026-09-25' };
  const r27 = { ...round, id: 'r27', round_no: 3, review_date: '2026-09-27' };
  const client = fakeClient(log, { previousPlans: { r25: null, r26: '来自 9/25', r27: '来自 9/26' } });
  assert.equal(await readPreviousPlan(client, r25, 'me'), null);
  assert.equal(await readPreviousPlan(client, r26, 'me'), '来自 9/25');
  assert.equal(await readPreviousPlan(client, r27, 'me'), '来自 9/26');
  assert.deepEqual(log.filter((item) => item.startsWith('rpc:get_my_previous_review_plan')), [
    'rpc:get_my_previous_review_plan:{"p_review_id":"r25"}',
    'rpc:get_my_previous_review_plan:{"p_review_id":"r26"}',
    'rpc:get_my_previous_review_plan:{"p_review_id":"r27"}',
  ]);
  assert.ok(!log.some((item) => item.includes('eq:round_no') || item.includes('order:created_at')));
}));

test('date correction uses exact RPC and server result, propagating backend rejection', async () => withData(async ({ correctReviewDate }) => {
  const log: string[] = [];
  const changed = await correctReviewDate(fakeClient(log), round, '2026-09-27', 'me');
  assert.equal(changed.review_date, '2026-09-27');
  assert.equal(changed.round_no, 2);
  assert.deepEqual(log.filter((item) => item.startsWith('rpc:')), ['rpc:correct_review_date:{"p_review_id":"r2","p_review_date":"2026-09-27"}']);
  await assert.rejects(correctReviewDate(fakeClient([], { rpcError: new Error('Review module is disabled') }), round, '2026-09-27', 'me'), /disabled/);
  await assert.rejects(correctReviewDate(fakeClient([], { rpcError: new Error('这一天已经有一篇回顾') }), round, '2026-09-27', 'me'), /这一天已经有一篇回顾/);
}));
