import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { mergeModuleAvailability, applyModuleToggle } = await vite.ssrLoadModule('/src/lib/module-availability.ts');
const { toggleTasksModule } = await vite.ssrLoadModule('/src/lib/space-modules.ts');

test.after(async () => { await vite.close(); });

test('cold resolution, atomic refresh, and retained known state on background failure', () => {
  const first = mergeModuleAvailability(null, { tasksIds: ['a'], reviewIds: ['a'], listsIds: [] });
  assert.deepEqual(first, { tasksIds: ['a'], reviewIds: ['a'], listsIds: [], tasksError: false, reviewError: false, listsError: false });
  const changed = mergeModuleAvailability(first, { tasksIds: [], reviewIds: [], listsIds: ['b'] });
  assert.deepEqual(changed, { tasksIds: [], reviewIds: [], listsIds: ['b'], tasksError: false, reviewError: false, listsError: false });
  const failed = mergeModuleAvailability(changed, { tasksIds: null, reviewIds: null, listsIds: null });
  assert.deepEqual(failed, { tasksIds: [], reviewIds: [], listsIds: ['b'], tasksError: true, reviewError: true, listsError: true });
  assert.deepEqual(mergeModuleAvailability(null, { tasksIds: null, reviewIds: null, listsIds: null }), {
    tasksIds: null, reviewIds: null, listsIds: null, tasksError: true, reviewError: true, listsError: true,
  });
});

test('canonical toggle patches only the corresponding known module set', () => {
  const known = mergeModuleAvailability(null, { tasksIds: ['a'], reviewIds: ['a'], listsIds: [] });
  assert.deepEqual(applyModuleToggle(known, 'review', 'a', 'disabled'), { ...known, reviewIds: [] });
  assert.deepEqual(applyModuleToggle(known, 'lists', 'b', 'enabled'), { ...known, listsIds: ['b'] });
  assert.deepEqual(applyModuleToggle(known, 'tasks', 'a', 'disabled'), { ...known, tasksIds: [] });
  assert.deepEqual(applyModuleToggle(known, 'tasks', 'b', 'enabled'), { ...known, tasksIds: ['a', 'b'] });
  assert.deepEqual(applyModuleToggle(null, 'lists', 'b', 'enabled'), null);
});

test('failed Tasks toggle keeps the last known Hub visibility', async () => {
  const known = mergeModuleAvailability(null, { tasksIds: ['a'], reviewIds: [], listsIds: [] });
  const failed = await toggleTasksModule(async () => { throw new Error('denied'); }, async () => 'disabled');
  assert.deepEqual(failed, { failure: 'rpc' });
  assert.deepEqual(known.tasksIds, ['a']);
});
