import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { CurrentSpace, ReviewEntry } from '../src/types.ts';

const personal = { id: 'p', name: '个人', kind: 'personal', membershipRole: 'owner' } as CurrentSpace;
const shared = { id: 's', name: '共享', kind: 'shared', membershipRole: 'member' } as CurrentSpace;
const entry = (review_id: string, user_id: string, focus = '', filled_revision: number | null = null): ReviewEntry => ({ review_id, user_id, focus, progress: '', problems: '', next_plan: '', content_revision: focus ? 1 : 0, filled_revision, updated_at: '2026-09-26T00:00:00Z' });
const round = (id: string, space_id: string, round_no: number, review_date: string) => ({ id, space_id, round_no, review_date, created_by: 'me', created_at: '2026-09-26T00:00:00Z' });

async function withReview(run: (module: Record<string, any>) => Promise<void> | void) {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try { await run(await vite.ssrLoadModule('/src/lib/review-history.ts')); } finally { await vite.close(); }
}

test('eligibility, independent deterministic selection, and separate create conditions', async () => withReview(({ eligibleReviewSpaces, selectReviewSpace, canCreateReview }) => {
  const spaces = [personal, shared];
  const eligible = eligibleReviewSpaces(spaces, [{ space_id: 'p', enabled: true }, { space_id: 's', enabled: true }]);
  assert.deepEqual(eligible.map((space: CurrentSpace) => space.id), ['p', 's']);
  assert.deepEqual(eligibleReviewSpaces(spaces, [{ space_id: 'p', enabled: false }]), []);
  assert.equal(selectReviewSpace('s', eligible), 's');
  assert.equal(selectReviewSpace('missing', eligible), 'p');
  assert.equal(selectReviewSpace('s', []), null);
  const unrelated = { selectedSpaceId: 's', calendarFilter: 'all', taskFilter: { spaceId: 's' } };
  selectReviewSpace('p', eligible);
  assert.deepEqual(unrelated, { selectedSpaceId: 's', calendarFilter: 'all', taskFilter: { spaceId: 's' } });
  assert.equal(canCreateReview(personal, 1), true);
  assert.equal(canCreateReview(shared, 1), false);
  assert.equal(canCreateReview(shared, 2), true);
}));

test('rows use historical entries and Slice 2 status; merge pages without duplicates', async () => withReview(({ mapReviewHistory, mergeReviewPages }) => {
  const p = round('r1', 'p', 1, '2026-09-26');
  const s = round('r2', 's', 2, '2026-09-25');
  const rows = mapReviewHistory([p, s], [entry('r1', 'me'), entry('r2', 'me', '计划', 1), entry('r2', 'old-participant', '进展')], 'me', new Map([['p', personal], ['s', shared]]));
  assert.deepEqual(rows.map((row: any) => [row.mine, row.other]), [['未填写', null], ['已填写', '编辑中']]);
  assert.deepEqual(mergeReviewPages(rows.slice(0, 1), rows), rows);
  assert.throws(() => mapReviewHistory([s], [entry('r2', 'me')], 'me', new Map([['s', shared]])), /参与者/);
}));

test('local date and stale request generation', async () => withReview(({ localReviewDate, reviewHistoryPageSize }) => {
  assert.equal(localReviewDate(new Date(2026, 8, 26, 1)), '2026-09-26');
  assert.equal(reviewHistoryPageSize, 20);
}));

test('Space A response is stale after Space B starts loading', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { createRequestGuard } = await vite.ssrLoadModule('/src/lib/request-guard.ts');
    const guard = createRequestGuard();
    const a = guard.begin();
    const b = guard.begin();
    assert.equal(guard.isCurrent(a), false);
    assert.equal(guard.isCurrent(b), true);
    guard.invalidate();
    assert.equal(guard.isCurrent(b), false);
  } finally { await vite.close(); }
});
