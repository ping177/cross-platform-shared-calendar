import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapSpaces, chooseSelectedSpaceId, completeSharedSpaceAction, ensureOnceUntilFailure, readSelectedSpaceId, writeSelectedSpaceId } from '../src/lib/space-selection.ts';
import type { CurrentSpace } from '../src/types.ts';

const sharedA: CurrentSpace = { id: 'shared-a', name: 'A', kind: 'shared', invite_code: 'AAAAAA', created_by: 'user-a', created_at: '2026-01-01', membershipRole: 'owner' };
const sharedB: CurrentSpace = { ...sharedA, id: 'shared-b', name: 'B', created_at: '2026-02-01', membershipRole: 'member' };
const personal: CurrentSpace = { ...sharedA, id: 'personal-a', name: '个人空间', kind: 'personal', created_at: '2026-03-01' };

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test('bootstrap ensures Personal before listing and keeps an existing Shared default', async () => {
  const calls: string[] = [];
  const result = await bootstrapSpaces('user-a', memoryStorage(), {
    ensurePersonalSpace: async () => { calls.push('ensure'); },
    listCurrentSpaces: async () => { calls.push('list'); return [personal, sharedA]; },
  });
  assert.deepEqual(calls, ['ensure', 'list']);
  assert.equal(result.selectedSpaceId, sharedA.id);
});

test('Personal-only users select Personal; a valid saved ID wins', async () => {
  const storage = memoryStorage();
  assert.equal(chooseSelectedSpaceId([personal], null), personal.id);
  writeSelectedSpaceId(storage, 'user-a', sharedB.id);
  const result = await bootstrapSpaces('user-a', storage, {
    ensurePersonalSpace: async () => undefined,
    listCurrentSpaces: async () => [sharedA, sharedB, personal],
  });
  assert.equal(result.selectedSpaceId, sharedB.id);
});

test('stale saved ID falls back to Shared, and selections are isolated by user', () => {
  const storage = memoryStorage();
  writeSelectedSpaceId(storage, 'user-a', 'former-space');
  writeSelectedSpaceId(storage, 'user-b', 'user-b-space');
  assert.equal(chooseSelectedSpaceId([personal, sharedB, sharedA], readSelectedSpaceId(storage, 'user-a')), sharedA.id);
  assert.equal(readSelectedSpaceId(storage, 'user-b'), 'user-b-space');
  assert.equal(readSelectedSpaceId(storage, 'user-a'), 'former-space');
  assert.equal(chooseSelectedSpaceId([personal], readSelectedSpaceId(storage, 'user-a')), personal.id);
});

test('A/B bootstrap restores only the matching user selection', async () => {
  const storage = memoryStorage();
  writeSelectedSpaceId(storage, 'user-a', sharedB.id);
  writeSelectedSpaceId(storage, 'user-b', 'personal-b');
  const personalB = { ...personal, id: 'personal-b', created_by: 'user-b' };
  assert.equal((await bootstrapSpaces('user-a', storage, {
    ensurePersonalSpace: async () => undefined,
    listCurrentSpaces: async () => [sharedA, sharedB, personal],
  })).selectedSpaceId, sharedB.id);
  assert.equal((await bootstrapSpaces('user-b', storage, {
    ensurePersonalSpace: async () => undefined,
    listCurrentSpaces: async () => [personalB],
  })).selectedSpaceId, personalB.id);
});

test('ensure failure still lists a readable Shared Space and retains a warning', async () => {
  const calls: string[] = [];
  const result = await bootstrapSpaces('user-a', memoryStorage(), {
    ensurePersonalSpace: async () => { calls.push('ensure'); throw new Error('RPC unavailable'); },
    listCurrentSpaces: async () => { calls.push('list'); return [sharedA]; },
  });
  assert.deepEqual(calls, ['ensure', 'list']);
  assert.deepEqual(result.spaces, [sharedA]);
  assert.equal(result.selectedSpaceId, sharedA.id);
  assert.match(result.personalInitializationError?.message ?? '', /RPC unavailable/);
});

test('ensure failure and Space list failure remain blocking', async () => {
  const calls: string[] = [];
  await assert.rejects(bootstrapSpaces('user-a', memoryStorage(), {
    ensurePersonalSpace: async () => { calls.push('ensure'); throw new Error('RPC unavailable'); },
    listCurrentSpaces: async () => { calls.push('list'); throw new Error('Space list unavailable'); },
  }), /Space list unavailable/);
  assert.deepEqual(calls, ['ensure', 'list']);
});

test('ensure failure with no readable Space remains blocking without a frontend write', async () => {
  const calls: string[] = [];
  await assert.rejects(bootstrapSpaces('user-a', memoryStorage(), {
    ensurePersonalSpace: async () => { calls.push('ensure'); throw new Error('RPC unavailable'); },
    listCurrentSpaces: async () => { calls.push('list'); return []; },
  }), /我的空间.*初始化/);
  assert.deepEqual(calls, ['ensure', 'list']);
});

test('manual retry refreshes Spaces and preserves the current Shared selection', async () => {
  const storage = memoryStorage();
  const calls: string[] = [];
  let ensureCalls = 0;
  const ensurePersonalSpace = ensureOnceUntilFailure(async () => {
    calls.push('ensure');
    ensureCalls += 1;
    if (ensureCalls === 1) throw new Error('temporary failure');
  });
  const listCurrentSpaces = async () => {
    calls.push('list');
    return ensureCalls === 1 ? [sharedA] : [personal, sharedA];
  };
  const first = await bootstrapSpaces('user-a', storage, { ensurePersonalSpace, listCurrentSpaces });
  assert.equal(first.selectedSpaceId, sharedA.id);
  assert.ok(first.personalInitializationError);
  writeSelectedSpaceId(storage, 'user-a', first.selectedSpaceId);

  const retried = await bootstrapSpaces('user-a', storage, { ensurePersonalSpace, listCurrentSpaces });
  assert.deepEqual(calls, ['ensure', 'list', 'ensure', 'list']);
  assert.equal(retried.selectedSpaceId, sharedA.id);
  assert.deepEqual(retried.spaces, [personal, sharedA]);
  assert.equal(retried.personalInitializationError, null);
});

test('manual retry preserves an in-memory Shared selection when device storage is unavailable', async () => {
  const unavailableStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('storage unavailable'); },
  };
  const result = await bootstrapSpaces('user-a', unavailableStorage, {
    ensurePersonalSpace: async () => undefined,
    listCurrentSpaces: async () => [personal, sharedA, sharedB],
    currentSelectionId: sharedB.id,
  });
  assert.equal(result.selectedSpaceId, sharedB.id);
});

test('a readable Personal Space resolves an ambiguous ensure response', async () => {
  const result = await bootstrapSpaces('user-a', memoryStorage(), {
    ensurePersonalSpace: async () => { throw new Error('response lost'); },
    listCurrentSpaces: async () => [personal, sharedA],
  });
  assert.equal(result.selectedSpaceId, sharedA.id);
  assert.equal(result.personalInitializationError, null);
});

test('duplicate bootstrap shares one ensure call and a failure permits explicit retry', async () => {
  let calls = 0;
  const ensure = ensureOnceUntilFailure(async () => {
    calls += 1;
    if (calls === 1) throw new Error('temporary failure');
  });
  const first = Promise.allSettled([ensure(), ensure()]);
  assert.deepEqual((await first).map((result) => result.status), ['rejected', 'rejected']);
  assert.equal(calls, 1);
  await ensure();
  await ensure();
  assert.equal(calls, 2);
});

test('create Shared refreshes and selects the returned Space ID', async () => {
  const calls: unknown[] = [];
  const selected = await completeSharedSpaceAction('create', '旅行', async (method, args) => {
    calls.push([method, args]);
    return { data: { id: sharedB.id }, error: null };
  }, async (spaceId) => { calls.push(['refresh', spaceId]); return true; });
  assert.equal(selected, true);
  assert.deepEqual(calls, [
    ['create_space_with_invite', { space_name: '旅行' }],
    ['refresh', sharedB.id],
  ]);
});

test('join Shared normalizes code and refreshes the returned Space ID', async () => {
  const calls: unknown[] = [];
  const selected = await completeSharedSpaceAction('join', ' abcdef ', async (method, args) => {
    calls.push([method, args]);
    return { data: { id: sharedA.id }, error: null };
  }, async (spaceId) => { calls.push(['refresh', spaceId]); return true; });
  assert.equal(selected, true);
  assert.deepEqual(calls, [
    ['join_space_by_invite_code', { code: 'ABCDEF' }],
    ['refresh', sharedA.id],
  ]);
});
