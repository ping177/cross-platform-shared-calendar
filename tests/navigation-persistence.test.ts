import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createServer } from 'vite';
import type { CurrentSpace } from '../src/types.ts';

const spaceA = '11111111-1111-4111-8111-111111111111';
const spaceB = '22222222-2222-4222-8222-222222222222';
const reviewId = '33333333-3333-4333-8333-333333333333';
const memberSpaces = [{ id: spaceA, membershipRole: 'owner' }, { id: spaceB, membershipRole: 'member' }] as CurrentSpace[];

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    values,
  };
}

test('navigation targets round-trip through a strict parser and user-scoped session storage', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { parseNavigationTarget, readNavigationTarget, writeNavigationTarget, clearNavigationTarget } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    const targets = [
      { page: 'home' }, { page: 'calendar' }, { page: 'modules' }, { page: 'profile' },
      { page: 'tasks' }, { page: 'tasks-completed' }, { page: 'lists-overview' }, { page: 'review-history' },
      { page: 'review-history', spaceId: spaceA }, { page: 'review-detail', spaceId: spaceA, reviewId },
      { page: 'space-management' }, { page: 'space-detail', spaceId: spaceA },
    ];
    const storage = fakeStorage();
    for (const target of targets) {
      writeNavigationTarget(storage, 'user-a', target);
      assert.deepEqual(readNavigationTarget(storage, 'user-a'), target);
      assert.equal(readNavigationTarget(storage, 'user-b'), null);
      assert.deepEqual(parseNavigationTarget(JSON.stringify(target)), target);
    }
    assert.equal(storage.values.size, 1);
    clearNavigationTarget(storage, 'user-a');
    assert.equal(readNavigationTarget(storage, 'user-a'), null);
  } finally { await vite.close(); }
});

test('malformed, unknown and incomplete targets fail closed without crashing storage access', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { parseNavigationTarget, readNavigationTarget, writeNavigationTarget, clearNavigationTarget } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    for (const value of ['{', 'null', '[]', '{}', '{"page":"unknown"}', '{"page":"review-detail","spaceId":"x"}',
      '{"page":"review-detail","spaceId":"x","reviewId":"y"}', '{"page":"space-detail","spaceId":42}',
      '{"page":"review-history","spaceId":""}']) {
      assert.equal(parseNavigationTarget(value), null, value);
    }
    const storage = fakeStorage();
    storage.setItem('navigation:user-a', '{');
    assert.equal(readNavigationTarget(storage, 'user-a'), null);
    const throwingStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    assert.equal(readNavigationTarget(throwingStorage, 'user-a'), null);
    assert.doesNotThrow(() => writeNavigationTarget(throwingStorage, 'user-a', { page: 'home' }));
    assert.doesNotThrow(() => clearNavigationTarget(throwingStorage, 'user-a'));
  } finally { await vite.close(); }
});

test('restoration validates Space membership and Review eligibility without treating read failure as revocation', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { resolveNavigationTarget } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    const reviewReaders = {
      loadReviewSpaces: async () => [memberSpaces[1]],
      canReadReview: async () => true,
    };
    for (const page of ['home', 'calendar', 'modules', 'profile', 'tasks', 'tasks-completed', 'space-management']) {
      assert.deepEqual(await resolveNavigationTarget({ page }, memberSpaces, reviewReaders), { page });
    }
    assert.deepEqual(await resolveNavigationTarget(null, memberSpaces, reviewReaders), { page: 'home' });
    assert.deepEqual(await resolveNavigationTarget({ page: 'space-detail', spaceId: spaceA }, memberSpaces, reviewReaders), { page: 'space-detail', spaceId: spaceA });
    assert.deepEqual(await resolveNavigationTarget({ page: 'space-detail', spaceId: reviewId }, memberSpaces, reviewReaders), { page: 'space-management' });
    assert.deepEqual(await resolveNavigationTarget({ page: 'review-history', spaceId: spaceA }, memberSpaces, reviewReaders), { page: 'review-history', spaceId: spaceB });
    assert.deepEqual(await resolveNavigationTarget({ page: 'review-history', spaceId: spaceB }, memberSpaces, reviewReaders), { page: 'review-history', spaceId: spaceB });
    assert.deepEqual(await resolveNavigationTarget({ page: 'review-history' }, memberSpaces, reviewReaders), { page: 'review-history', spaceId: spaceB });
    assert.deepEqual(await resolveNavigationTarget({ page: 'review-detail', spaceId: spaceB, reviewId }, memberSpaces, reviewReaders), { page: 'review-detail', spaceId: spaceB, reviewId });
    assert.deepEqual(await resolveNavigationTarget({ page: 'review-detail', spaceId: spaceA, reviewId }, memberSpaces, reviewReaders), { page: 'modules' });
    assert.deepEqual(await resolveNavigationTarget({ page: 'review-detail', spaceId: spaceB, reviewId }, memberSpaces, { ...reviewReaders, canReadReview: async () => false }), { page: 'review-history', spaceId: spaceB });
    assert.deepEqual(await resolveNavigationTarget({ page: 'review-history', spaceId: spaceB }, memberSpaces, { ...reviewReaders, loadReviewSpaces: async () => [] }), { page: 'modules' });
    assert.deepEqual(await resolveNavigationTarget({ page: 'review-detail', spaceId: spaceB, reviewId }, memberSpaces, { ...reviewReaders, loadReviewSpaces: async () => [] }), { page: 'modules' });
    const readFailure = { ...reviewReaders, loadReviewSpaces: async () => { throw new Error('network'); } };
    assert.deepEqual(await resolveNavigationTarget({ page: 'review-history', spaceId: spaceB }, memberSpaces, readFailure), { page: 'review-history', spaceId: spaceB });
    assert.deepEqual(await resolveNavigationTarget({ page: 'review-detail', spaceId: spaceB, reviewId }, memberSpaces, readFailure), { page: 'review-detail', spaceId: spaceB, reviewId });
    assert.deepEqual(await resolveNavigationTarget({ page: 'review-detail', spaceId: spaceB, reviewId }, memberSpaces, { ...reviewReaders, canReadReview: async () => { throw new Error('network'); } }), { page: 'review-detail', spaceId: spaceB, reviewId });
  } finally { await vite.close(); }
});

test('Lists overview restoration keeps transient errors but leaves on confirmed eligibility loss', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { resolveNavigationTarget, navigationTargetForState } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    const target = { page: 'lists-overview' };
    const review = { loadReviewSpaces: async () => [], canReadReview: async () => false };
    assert.deepEqual(await resolveNavigationTarget(target, memberSpaces, review, { loadListsSpaces: async () => [memberSpaces[0]] }), target);
    assert.deepEqual(await resolveNavigationTarget(target, memberSpaces, review, { loadListsSpaces: async () => [] }), { page: 'modules' });
    assert.deepEqual(await resolveNavigationTarget(target, memberSpaces, review, { loadListsSpaces: async () => { throw new Error('offline'); } }), target);
    assert.deepEqual(navigationTargetForState({ tab: 'modules', moduleScreen: 'lists' }, 'profile', null, null, null), target);
  } finally { await vite.close(); }
});

test('only page identity is derived from accepted navigation state', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { initialNavigation, selectTab, openReviewDetail, canChangeTabFromReviewDetail, navigationTargetForState } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    const detail = openReviewDetail(initialNavigation);
    const target = { spaceId: spaceA, reviewId, justCreated: true };
    assert.deepEqual(navigationTargetForState(detail, 'profile', target, spaceB, spaceB), { page: 'review-detail', spaceId: spaceA, reviewId });
    assert.equal(canChangeTabFromReviewDetail(detail, true, () => false), false);
    assert.deepEqual(navigationTargetForState(detail, 'profile', target, spaceB, spaceB), { page: 'review-detail', spaceId: spaceA, reviewId });
    assert.equal(canChangeTabFromReviewDetail(detail, true, () => true), true);
    assert.deepEqual(navigationTargetForState(selectTab(detail, 'calendar'), 'profile', target, spaceB, spaceB), { page: 'calendar' });
    assert.deepEqual(navigationTargetForState({ tab: 'me', moduleScreen: 'hub' }, 'detail', null, spaceB, spaceA), { page: 'space-detail', spaceId: spaceA });
    assert.deepEqual(navigationTargetForState({ tab: 'modules', moduleScreen: 'review' }, 'profile', null, spaceB, spaceA), { page: 'review-history', spaceId: spaceB });
  } finally { await vite.close(); }
});

test('accepted navigation writes the new target while a cancelled dirty leave retains the detail target', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { initialNavigation, openReviewDetail, selectTab, canChangeTabFromReviewDetail, navigationTargetForState, writeNavigationTarget, readNavigationTarget } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    const storage = fakeStorage();
    const detail = openReviewDetail(initialNavigation);
    const round = { spaceId: spaceA, reviewId, justCreated: true };
    writeNavigationTarget(storage, 'user-a', navigationTargetForState(detail, 'profile', round, spaceA, spaceB));
    if (canChangeTabFromReviewDetail(detail, true, () => false)) {
      writeNavigationTarget(storage, 'user-a', navigationTargetForState(selectTab(detail, 'calendar'), 'profile', round, spaceA, spaceB));
    }
    assert.deepEqual(readNavigationTarget(storage, 'user-a'), { page: 'review-detail', spaceId: spaceA, reviewId });
    if (canChangeTabFromReviewDetail(detail, true, () => true)) {
      writeNavigationTarget(storage, 'user-a', navigationTargetForState(selectTab(detail, 'calendar'), 'profile', round, spaceA, spaceB));
    }
    assert.deepEqual(readNavigationTarget(storage, 'user-a'), { page: 'calendar' });
  } finally { await vite.close(); }
});

test('App persistence follows committed page state and Review pages report only canonical invalidation', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const history = readFileSync(new URL('../src/components/ReviewHistoryPage.tsx', import.meta.url), 'utf8');
  const detail = readFileSync(new URL('../src/components/ReviewDetailPage.tsx', import.meta.url), 'utf8');
  assert.match(app, /if \(!canChangeTabFromReviewDetail\([\s\S]*?\)\) return;[\s\S]*?setNavigation\(\(current\) => selectTab\(current, tab\)\)/);
  assert.match(app, /useEffect\(\(\) => \{[\s\S]*?navigationTargetForState\(navigation, myScreen, reviewDetail, reviewSpaceId, selectedSpaceId\)[\s\S]*?writeNavigationTarget\(storage, userId, target\)/);
  assert.ok(history.includes('if (!eligible.length && onNoEligible) { onNoEligible(); return; }'));
  assert.match(detail, /onUnavailable\?\.\(spaceEligible \? 'review' : 'space'\)/);
});
