import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { CurrentSpace, ReviewEntry, ReviewRound } from '../src/types.ts';

const round = { id: 'r2', space_id: 's', round_no: 2, review_date: '2026-09-26', created_by: 'me', created_at: '2026-09-26T00:00:00Z' } as ReviewRound;
const own = { review_id: 'r2', user_id: 'me', focus: null, progress: null, problems: null, next_plan: null, content_revision: 0, filled_revision: null, updated_at: '2026-09-26T00:00:00Z' } as ReviewEntry;
const other = { ...own, user_id: 'former-member', focus: '历史内容', content_revision: 1 };
const shared = { id: 's', kind: 'shared', name: '共享', membershipRole: 'owner' } as CurrentSpace;

test('detail maps the actual participant snapshot, and Personal has only own entry', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { mapReviewDetail, formatReviewDate } = await vite.ssrLoadModule('/src/lib/review-detail.ts');
    assert.deepEqual(mapReviewDetail(round, [other, own], shared, 'me'), { round, own, other });
    assert.deepEqual(mapReviewDetail(round, [own], { ...shared, kind: 'personal' }, 'me'), { round, own, other: null });
    assert.throws(() => mapReviewDetail(round, [other], shared, 'me'), /不可访问/);
    assert.equal(formatReviewDate('2026-09-26'), '2026年9月26日');
  } finally { await vite.close(); }
});

test('temporary navigation distinguishes created and historical rounds', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { reviewDetailTarget, canLeaveReviewDetail } = await vite.ssrLoadModule('/src/lib/review-detail.ts');
    assert.deepEqual(reviewDetailTarget(round, true), { spaceId: 's', reviewId: 'r2', justCreated: true });
    assert.deepEqual(reviewDetailTarget(round, false), { spaceId: 's', reviewId: 'r2', justCreated: false });
    assert.equal(canLeaveReviewDetail(false, () => { throw new Error('should not confirm clean entry'); }), true);
    assert.equal(canLeaveReviewDetail(true, () => false), false);
    assert.equal(canLeaveReviewDetail(true, () => true), true);
  } finally { await vite.close(); }
});
