import assert from 'node:assert/strict';
import test from 'node:test';
import { newEventIdentity, taskAssignmentForSpace } from '../src/lib/space-content.ts';

test('Personal Event creation fixes scope and owner regardless of draft audience', () => {
  assert.deepEqual(newEventIdentity('personal', 'shared', 'user-a', null), { scope: 'personal', owner_user_id: 'user-a' });
});

test('Shared Event creation retains mine, partner, and shared identity', () => {
  assert.deepEqual(newEventIdentity('shared', 'mine', 'user-a', 'user-b'), { scope: 'personal', owner_user_id: 'user-a' });
  assert.deepEqual(newEventIdentity('shared', 'partner', 'user-a', 'user-b'), { scope: 'personal', owner_user_id: 'user-b' });
  assert.deepEqual(newEventIdentity('shared', 'shared', 'user-a', 'user-b'), { scope: 'shared', owner_user_id: null });
});

test('Personal Task create is unassigned and edit preserves an existing assignment', () => {
  assert.equal(taskAssignmentForSpace('personal', null, 'user-a'), null);
  assert.equal(taskAssignmentForSpace('personal', 'user-a', ''), 'user-a');
  assert.equal(taskAssignmentForSpace('shared', null, 'user-a'), 'user-a');
});
