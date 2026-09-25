import assert from 'node:assert/strict';
import test from 'node:test';
import { availableTaskTargets, canConfirmCreate, canUseCreateTarget, createSubmitLock, homeCreateEntry, homeCreateTarget, resetEventAudienceForTarget, resetTaskAssignmentForTarget, targetMembersValid } from '../src/lib/global-create.ts';
import type { CurrentSpace, SpaceMember } from '../src/types.ts';

const personal = { id: 'personal', kind: 'personal', created_by: 'me' } as CurrentSpace;
const shared = { id: 'shared', kind: 'shared', created_by: 'me' } as CurrentSpace;
const member = (spaceId: string, userId: string) => ({ space_id: spaceId, user_id: userId }) as SpaceMember;

test('Home creation chooses only the current user Personal Space, never a selected Shared Space', () => {
  assert.equal(homeCreateTarget([shared, personal], 'me'), 'personal');
  assert.equal(homeCreateTarget([shared], 'me'), null);
  assert.equal(homeCreateTarget([{ ...personal, created_by: 'other' }, shared], 'me'), null);
});

test('Task targets require an enabled row; disabled Personal never silently selects Shared', () => {
  assert.deepEqual(availableTaskTargets([personal, shared], ['shared']).map((space) => space.id), ['shared']);
  assert.equal(homeCreateTarget([personal, shared], 'me'), 'personal');
  assert.deepEqual(availableTaskTargets([personal, shared], []), []);
});

test('section actions route directly to their form or an explicit Space choice', () => {
  assert.deepEqual(homeCreateEntry('event', [shared, personal], 'me', []), { state: 'open', targetId: 'personal' });
  assert.deepEqual(homeCreateEntry('task', [shared, personal], 'me', ['shared']), { state: 'open', targetId: 'personal' });
  assert.deepEqual(homeCreateEntry('task', [shared], 'me', ['shared']), { state: 'choose' });
  assert.deepEqual(homeCreateEntry('task', [shared], 'me', []), { state: 'blocked' });
  assert.deepEqual(homeCreateEntry('event', [], 'me', []), { state: 'blocked' });
});

test('target members must belong to the selected Space and include actor and assignee', () => {
  assert.equal(targetMembersValid([member('a', 'me'), member('a', 'other')], 'a', 'me', 'other'), true);
  assert.equal(targetMembersValid([member('a', 'me'), member('a', 'other')], 'b', 'me', 'other'), false);
  assert.equal(targetMembersValid([member('a', 'me')], 'a', 'me', 'other'), false);
});

test('submit lock acquires synchronously and allows retry after release', () => {
  const lock = createSubmitLock();
  assert.equal(lock.acquire(), true);
  assert.equal(lock.acquire(), false);
  lock.release();
  assert.equal(lock.acquire(), true);
});

test('two immediate confirmations admit one write and a successful write keeps the lock', async () => {
  const lock = createSubmitLock();
  let writes = 0;
  async function confirm() {
    if (!lock.acquire()) return;
    await Promise.resolve();
    writes += 1;
  }
  await Promise.all([confirm(), confirm()]);
  assert.equal(writes, 1);
  assert.equal(lock.acquire(), false);
});

test('stale target selection or unknown member state cannot submit', () => {
  const members = [member('personal', 'me')];
  assert.equal(canUseCreateTarget('ready', 'personal', 'personal', members, 'me'), true);
  assert.equal(canUseCreateTarget('ready', 'shared', 'personal', members, 'me'), false);
  assert.equal(canUseCreateTarget('loading', 'personal', 'personal', members, 'me'), false);
  assert.equal(canUseCreateTarget('error', 'personal', 'personal', members, 'me'), false);
  assert.equal(canUseCreateTarget('blocked', 'personal', 'personal', members, 'me'), false);
});

test('switching Space preserves ordinary Event and Task draft fields but clears Space identities and confirmation', () => {
  const event = resetEventAudienceForTarget({ title: '晚餐', startsAt: '2026-09-25T19:00', audience: 'partner' as const });
  assert.deepEqual(event, { title: '晚餐', startsAt: '2026-09-25T19:00', audience: 'mine' });
  assert.equal(resetTaskAssignmentForTarget('old-partner'), '');
  assert.equal(canConfirmCreate('old-space', 'new-space', 'new-space'), false);
  assert.equal(canConfirmCreate('space', 'space', 'space'), true);
});
