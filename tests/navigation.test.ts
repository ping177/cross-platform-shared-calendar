import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('Slice 3 navigation has four primary destinations and one bounded Tasks path', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { initialNavigation, selectTab, openTaskModule, openReviewModule, openReviewDetail, openCompletedTasks, openTaskList, openCalendar } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    assert.deepEqual(initialNavigation, { tab: 'home', moduleScreen: 'hub' });
    const modules = selectTab(initialNavigation, 'modules');
    assert.deepEqual(modules, { tab: 'modules', moduleScreen: 'hub' });
    assert.deepEqual(openTaskModule(modules), { tab: 'modules', moduleScreen: 'tasks' });
    assert.deepEqual(openReviewModule(modules), { tab: 'modules', moduleScreen: 'review' });
    assert.deepEqual(openReviewDetail(openReviewModule(modules)), { tab: 'modules', moduleScreen: 'review-detail' });
    assert.deepEqual(openCompletedTasks(openTaskModule(modules)), { tab: 'modules', moduleScreen: 'completed' });
    assert.deepEqual(openTaskList(openCompletedTasks(openTaskModule(modules))), { tab: 'modules', moduleScreen: 'tasks' });
    assert.deepEqual(selectTab(openCompletedTasks(openTaskModule(modules)), 'modules'), modules);
    assert.deepEqual(selectTab(modules, 'me'), { tab: 'me', moduleScreen: 'hub' });
    assert.deepEqual(openCalendar(modules), { tab: 'calendar', moduleScreen: 'hub' });
    assert.deepEqual(selectTab(modules, 'home'), initialNavigation);
  } finally {
    await vite.close();
  }
});

test('Calendar content selection is independent of Tasks and management selection', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { calendarContentSpaceId } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    const ids = ['personal-a', 'shared-a'];
    assert.equal(calendarContentSpaceId('all', ids), 'personal-a');
    assert.equal(calendarContentSpaceId({ spaceId: 'shared-a' }, ids), 'shared-a');
    assert.equal(calendarContentSpaceId({ spaceId: 'missing' }, ids), null);
  } finally {
    await vite.close();
  }
});

test('leaving Review detail through any bottom tab protects an unsaved draft', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { initialNavigation, openReviewDetail, canChangeTabFromReviewDetail } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    const detail = openReviewDetail(initialNavigation);
    assert.equal(canChangeTabFromReviewDetail(detail, true, () => false), false);
    assert.equal(canChangeTabFromReviewDetail(detail, true, () => true), true);
    assert.equal(canChangeTabFromReviewDetail(detail, false, () => { throw new Error('clean detail must not prompt'); }), true);
    assert.equal(canChangeTabFromReviewDetail(initialNavigation, true, () => { throw new Error('other screens must not prompt'); }), true);
  } finally {
    await vite.close();
  }
});
