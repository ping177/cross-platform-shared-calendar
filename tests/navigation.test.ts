import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('Slice 3 navigation has four primary destinations and one bounded Tasks path', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { initialNavigation, selectTab, openTaskModule, openCompletedTasks, openTaskList, openCalendar } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    assert.deepEqual(initialNavigation, { tab: 'home', moduleScreen: 'hub' });
    const modules = selectTab(initialNavigation, 'modules');
    assert.deepEqual(modules, { tab: 'modules', moduleScreen: 'hub' });
    assert.deepEqual(openTaskModule(modules), { tab: 'modules', moduleScreen: 'tasks' });
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
