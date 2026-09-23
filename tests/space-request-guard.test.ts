import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestGuard } from '../src/lib/request-guard.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test('Shared A → Personal → Shared B ignores late Event, Task, and member responses', async () => {
  const visible = { events: [] as string[], tasks: [] as string[], members: [] as string[] };
  const guards = { events: createRequestGuard(), tasks: createRequestGuard(), members: createRequestGuard() };
  const pending = Object.fromEntries((Object.keys(guards) as Array<keyof typeof guards>).map((name) => [name, deferred<string[]>()])) as Record<keyof typeof guards, ReturnType<typeof deferred<string[]>>>;
  const oldLoads = (Object.keys(guards) as Array<keyof typeof guards>).map(async (name) => {
    const token = guards[name].begin();
    const rows = await pending[name].promise;
    if (guards[name].isCurrent(token)) visible[name] = rows;
  });

  for (const guard of Object.values(guards)) guard.invalidate(); // Leave Shared A.
  visible.events = []; visible.tasks = []; visible.members = [];
  const personalTokens = Object.fromEntries((Object.keys(guards) as Array<keyof typeof guards>).map((name) => [name, guards[name].begin()])) as Record<keyof typeof guards, number>;
  for (const name of Object.keys(guards) as Array<keyof typeof guards>) {
    if (guards[name].isCurrent(personalTokens[name])) visible[name] = [`personal-${name}`];
  }
  for (const guard of Object.values(guards)) guard.invalidate(); // Leave Personal.
  visible.events = []; visible.tasks = []; visible.members = [];
  for (const name of Object.keys(guards) as Array<keyof typeof guards>) {
    const token = guards[name].begin();
    if (guards[name].isCurrent(token)) visible[name] = [`shared-b-${name}`];
  }
  for (const name of Object.keys(pending) as Array<keyof typeof pending>) pending[name].resolve([`shared-a-${name}`]);
  await Promise.all(oldLoads);
  assert.deepEqual(visible, {
    events: ['shared-b-events'], tasks: ['shared-b-tasks'], members: ['shared-b-members'],
  });
});

test('newer same-Space refresh wins over a late earlier request', () => {
  const guard = createRequestGuard();
  const first = guard.begin();
  const second = guard.begin();
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});
