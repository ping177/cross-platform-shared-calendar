import assert from 'node:assert/strict';
import test from 'node:test';
import { createTasksModuleToggleGuard, tasksModuleStateFromResult, toggleTasksModule } from '../src/lib/space-modules.ts';

test('Tasks module row is enabled only when enabled is true', () => {
  assert.equal(tasksModuleStateFromResult({ data: { enabled: true }, error: null }), 'enabled');
  assert.equal(tasksModuleStateFromResult({ data: { enabled: false }, error: null }), 'disabled');
  assert.equal(tasksModuleStateFromResult({ data: null, error: null }), 'disabled');
  assert.throws(() => tasksModuleStateFromResult({ data: null, error: { message: '读取失败' } }), /读取失败/);
});

test('successful toggle reads the authoritative module state', async () => {
  const calls: string[] = [];
  const result = await toggleTasksModule(
    async () => { calls.push('rpc'); },
    async () => { calls.push('read'); return 'disabled'; },
  );
  assert.deepEqual(calls, ['rpc', 'read']);
  assert.deepEqual(result, { state: 'disabled' });
});

test('RPC failure skips refresh so the caller can retain its known state', async () => {
  let read = false;
  const result = await toggleTasksModule(
    async () => { throw new Error('无权限'); },
    async () => { read = true; return 'disabled'; },
  );
  assert.equal(read, false);
  assert.deepEqual(result, { failure: 'rpc' });
});

test('successful RPC followed by read failure returns unknown state', async () => {
  const result = await toggleTasksModule(
    async () => undefined,
    async () => { throw new Error('读取失败'); },
  );
  assert.deepEqual(result, { failure: 'refresh' });
});

test('a pending module toggle blocks duplicate writes and unlocks afterward', async () => {
  const guard = createTasksModuleToggleGuard();
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  let writes = 0;
  const first = guard.run(async () => { writes += 1; await pending; }, async () => 'disabled');
  assert.equal(guard.isBusy(), true);
  assert.equal(await guard.run(async () => { writes += 1; }, async () => 'enabled'), null);
  assert.equal(writes, 1);
  finish();
  assert.deepEqual(await first, { state: 'disabled' });
  assert.equal(guard.isBusy(), false);
  assert.deepEqual(await guard.run(async () => { writes += 1; }, async () => 'enabled'), { state: 'enabled' });
  assert.equal(writes, 2);
});
