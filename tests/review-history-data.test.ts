import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurrentSpace, ReviewEntry } from '../src/types.ts';

const space = { id: 's', name: '共享', kind: 'shared', membershipRole: 'owner' } as CurrentSpace;
const rounds = Array.from({ length: 21 }, (_, index) => ({ id: `r${index}`, space_id: 's', round_no: 21 - index, review_date: '2026-09-26', created_by: 'me', created_at: '2026-09-26T00:00:00Z' }));
const entry = (review_id: string, user_id: string): ReviewEntry => ({ review_id, user_id, focus: null, progress: null, problems: null, next_plan: null, content_revision: 0, filled_revision: null, updated_at: '2026-09-26T00:00:00Z' });

function fakeClient(log: string[], options: { moduleRows?: Array<{ space_id: string; enabled: boolean }>; roundRows?: typeof rounds; totalCount?: number; rpcError?: Error } = {}): SupabaseClient {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'me' } }, error: null }) },
    from(table: string) {
      log.push(`from:${table}`);
      const query = {
        select(columns: string, settings?: { count?: string }) { log.push(`select:${columns}:${settings?.count ?? 'none'}`); return query; },
        eq(column: string, value: unknown) { log.push(`eq:${column}:${value}`); return query; },
        order(column: string, value: { ascending?: boolean } = {}) { log.push(`order:${column}:${value.ascending}`); return query; },
        or(filter: string) { log.push(`or:${filter}`); return query; },
        async range(start: number, end: number) {
          log.push(`range:${start}:${end}`);
          if (table === 'space_modules') return { data: options.moduleRows ?? [], count: options.moduleRows?.length ?? 0, error: null };
          return { data: options.roundRows ?? rounds, count: options.totalCount ?? (options.roundRows ?? rounds).length, error: null };
        },
        async in(column: string, values: string[]) {
          log.push(`in:${column}:${values.length}`);
          return { data: values.flatMap((id) => [entry(id, 'me'), entry(id, 'former-participant')]), error: null };
        },
      };
      return query;
    },
    async rpc(name: string, args: unknown) {
      log.push(`rpc:${name}:${JSON.stringify(args)}`);
      return { data: options.rpcError ? null : rounds[0], error: options.rpcError ?? null };
    },
  } as unknown as SupabaseClient;
}

async function withData(run: (module: Record<string, any>) => Promise<void>) {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try { await run(await vite.ssrLoadModule('/src/lib/review-history-data.ts')); } finally { await vite.close(); }
}

test('eligibility reads only enabled review module rows for current spaces', async () => withData(async ({ loadReviewEligibility }) => {
  const log: string[] = [];
  const eligible = await loadReviewEligibility('me', fakeClient(log, { moduleRows: [{ space_id: 's', enabled: true }] }), async () => [space]);
  assert.deepEqual(eligible.map((item: CurrentSpace) => item.id), ['s']);
  assert.ok(log.includes('eq:module_key:review'));
  assert.ok(log.includes('range:0:499'));
  assert.deepEqual(await loadReviewEligibility('me', fakeClient([], { moduleRows: [{ space_id: 's', enabled: false }] }), async () => [space]), []);
}));

test('history uses bounded date/number cursor and participant snapshot rows', async () => withData(async ({ loadReviewHistoryPage }) => {
  const log: string[] = [];
  const client = fakeClient(log);
  const first = await loadReviewHistoryPage(client, space, 'me', null);
  assert.equal(first.rows.length, 20);
  assert.equal(first.hasMore, true);
  assert.equal(first.totalCount, 21);
  assert.deepEqual(first.rows.map((row: any) => [row.mine, row.other]), Array(20).fill(['未填写', '未填写']));
  assert.ok(log.includes('order:review_date:false'));
  assert.ok(log.includes('order:round_no:false'));
  assert.ok(log.includes('range:0:20'));
  assert.ok(log.includes('in:review_id:20'));
  assert.ok(!log.some((item) => item.startsWith('order:created_at')));
  const cursorLog: string[] = [];
  const next = await loadReviewHistoryPage(fakeClient(cursorLog, { roundRows: [], totalCount: 7 }), space, 'me', { review_date: '2026-09-26', round_no: 2 });
  assert.ok(cursorLog.includes('or:review_date.lt.2026-09-26,and(review_date.eq.2026-09-26,round_no.lt.2)'));
  assert.ok(cursorLog.some((item) => item.startsWith('select:id,space_id,round_no,review_date,created_by,created_at:none')));
  assert.equal(next.totalCount, null);
}));

test('history total is authoritative for zero, one, and more than one page', async () => withData(async ({ loadReviewHistoryPage }) => {
  const empty = await loadReviewHistoryPage(fakeClient([], { roundRows: [], totalCount: 0 }), space, 'me', null);
  assert.deepEqual({ rows: empty.rows.length, totalCount: empty.totalCount, hasMore: empty.hasMore }, { rows: 0, totalCount: 0, hasMore: false });

  const oneRound = rounds.slice(0, 1);
  const one = await loadReviewHistoryPage(fakeClient([], { roundRows: oneRound, totalCount: 1 }), space, 'me', null);
  assert.deepEqual({ rows: one.rows.length, totalCount: one.totalCount, hasMore: one.hasMore }, { rows: 1, totalCount: 1, hasMore: false });

  const many = await loadReviewHistoryPage(fakeClient([], { totalCount: 47 }), space, 'me', null);
  assert.deepEqual({ rows: many.rows.length, totalCount: many.totalCount, hasMore: many.hasMore }, { rows: 20, totalCount: 47, hasMore: true });
}));

test('create calls only canonical RPC with exact arguments and propagates rejection', async () => withData(async ({ createReviewRound }) => {
  const log: string[] = [];
  const result = await createReviewRound(fakeClient(log), 's', '2026-09-26', 'me');
  assert.equal(result.round_no, 21);
  assert.deepEqual(log.filter((item) => item.startsWith('rpc:')), ['rpc:create_review_round:{"p_space_id":"s","p_review_date":"2026-09-26"}']);
  await assert.rejects(createReviewRound(fakeClient([], { rpcError: new Error('Review participant count is incomplete') }), 's', '2026-09-26', 'me'), /incomplete/);
}));
