import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('Slice 1 navigation transitions reset nested Space screens without retaining a prior session path', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { initialNavigation, selectTab, openSpace, openSpaceScreen, openCalendar } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    assert.deepEqual(initialNavigation, { tab: 'home', spaceScreen: 'list' });
    const spaces = selectTab(initialNavigation, 'spaces');
    const me = selectTab(spaces, 'me');
    const calendar = selectTab(me, 'calendar');
    assert.deepEqual(spaces, { tab: 'spaces', spaceScreen: 'list' });
    assert.deepEqual(me, { tab: 'me', spaceScreen: 'list' });
    assert.deepEqual(calendar, { tab: 'calendar', spaceScreen: 'list' });
    assert.deepEqual(openSpace(spaces), { tab: 'spaces', spaceScreen: 'hub' });
    assert.deepEqual(openSpaceScreen(openSpace(spaces), 'tasks'), { tab: 'spaces', spaceScreen: 'tasks' });
    assert.deepEqual(openSpaceScreen(openSpace(spaces), 'completed'), { tab: 'spaces', spaceScreen: 'completed' });
    assert.deepEqual(openCalendar(openSpace(spaces)), calendar);
    assert.deepEqual(selectTab(openSpaceScreen(openSpace(spaces), 'tasks'), 'spaces'), spaces);
    assert.deepEqual(selectTab(calendar, 'home'), initialNavigation);
    assert.deepEqual(initialNavigation, { tab: 'home', spaceScreen: 'list' });
  } finally {
    await vite.close();
  }
});

test('Slice 2 content targets use only legacy Hub selection or Calendar filter', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { contentSpaceIdForNavigation } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    const ids = ['personal-a', 'shared-a'];
    assert.equal(contentSpaceIdForNavigation('spaces', 'shared-a', 'all', ids), 'shared-a');
    assert.equal(contentSpaceIdForNavigation('spaces', null, 'all', ids), null);
    assert.equal(contentSpaceIdForNavigation('calendar', 'shared-a', 'all', ids), 'personal-a');
    assert.equal(contentSpaceIdForNavigation('calendar', 'shared-a', { spaceId: 'personal-a' }, ids), 'personal-a');
    assert.equal(contentSpaceIdForNavigation('calendar', 'shared-a', { spaceId: 'shared-a' }, ids), 'shared-a');
  } finally {
    await vite.close();
  }
});
