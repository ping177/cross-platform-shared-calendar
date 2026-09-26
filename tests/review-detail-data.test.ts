import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurrentSpace, ReviewEntry, ReviewRound } from '../src/types.ts';

const space = { id: 's', name: '共享', kind: 'shared', membershipRole: 'owner' } as CurrentSpace;
const round = { id: 'r2', space_id: 's', round_no: 2, review_date: '2026-09-26', created_by: 'me', created_at: '2026-09-26T00:00:00Z' } as ReviewRound;
const entry = (review_id: string, user_id: string, next_plan: string | null = null): ReviewEntry => ({ review_id, user_id, focus: null, progress: null, problems: null, next_plan, content_revision: next_plan ? 1 : 0, filled_revision: null, updated_at: '2026-09-26T00:00:00Z' });

function fakeClient(log: string[], options: { previous?: ReviewRound | null; plan?: string | null; missing?: boolean; missingEntry?: boolean; wrongRound?: boolean; rpcError?: Error } = {}): SupabaseClient {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'me' } }, error: null }) },
    from(table: string) {
      log.push(`from:${table}`);
      const filters: Record<string, unknown> = {};
      const query = {
        select(columns: string) { log.push(`select:${columns}`); return query; },
        eq(column: string, value: unknown) { filters[column] = value; log.push(`eq:${column}:${value}`); return query; },
        async maybeSingle() {
          if (table === 'review_rounds') return { data: options.missing ? null : 'round_no' in filters ? options.previous ?? null : options.wrongRound ? { ...round, id: 'other' } : round, error: null };
          return { data: options.missingEntry ? null : entry('r1', 'me', options.plan ?? null), error: null };
        },
        async order(column: string) {
          log.push(`order:${column}`);
          return { data: [entry('r2', 'former-member', '旧计划'), entry('r2', 'me')], error: null };
        },
      };
      return query;
    },
    async rpc(name: string, args: unknown) {
      log.push(`rpc:${name}:${JSON.stringify(args)}`);
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

test('previous plan reads only same Space and exact round_no - 1 with own participant', async () => withData(async ({ readPreviousPlan }) => {
  const log: string[] = [];
  const previous = { ...round, id: 'r1', round_no: 1, review_date: '2026-10-01' };
  assert.equal(await readPreviousPlan(fakeClient(log, { previous, plan: '下周继续' }), round, 'me'), '下周继续');
  assert.ok(log.includes('eq:space_id:s'));
  assert.ok(log.includes('eq:round_no:1'));
  assert.ok(log.includes('eq:review_id:r1'));
  assert.ok(log.includes('eq:user_id:me'));
  assert.ok(!log.some((item) => item.includes('review_date')));
  const firstLog: string[] = [];
  assert.equal(await readPreviousPlan(fakeClient(firstLog), { ...round, round_no: 1 }, 'me'), null);
  assert.ok(!firstLog.some((item) => item.startsWith('from:')));
  const missingLog: string[] = [];
  assert.equal(await readPreviousPlan(fakeClient(missingLog), round, 'me'), null);
  assert.ok(!missingLog.includes('eq:round_no:0'));
  assert.equal(await readPreviousPlan(fakeClient([], { previous, plan: ' \n ' }), round, 'me'), null);
  assert.equal(await readPreviousPlan(fakeClient([], { previous, missingEntry: true }), round, 'me'), null);
}));

test('date correction uses exact RPC and server result, propagating backend rejection', async () => withData(async ({ correctReviewDate }) => {
  const log: string[] = [];
  const changed = await correctReviewDate(fakeClient(log), round, '2026-09-27', 'me');
  assert.equal(changed.review_date, '2026-09-27');
  assert.equal(changed.round_no, 2);
  assert.deepEqual(log.filter((item) => item.startsWith('rpc:')), ['rpc:correct_review_date:{"p_review_id":"r2","p_review_date":"2026-09-27"}']);
  await assert.rejects(correctReviewDate(fakeClient([], { rpcError: new Error('Review module is disabled') }), round, '2026-09-27', 'me'), /disabled/);
}));
