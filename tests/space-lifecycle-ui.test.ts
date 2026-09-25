import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { CurrentSpace, SpaceMember } from '../src/types.ts';
import { executeSpaceLifecycle, lifecycleErrorMessage, lifecycleTarget, settleSpaceLifecycle, StaleSpaceLifecycleError } from '../src/lib/space-lifecycle.ts';
import { validCalendarFilter } from '../src/lib/aggregate-calendar.ts';
import { normalizeTaskFilter } from '../src/lib/aggregate-tasks.ts';

const space: CurrentSpace = { id: 'shared', name: '两人空间', kind: 'shared', invite_code: 'CODE', created_by: 'owner', created_at: '2026-09-25', membershipRole: 'owner' };
const owner: SpaceMember = { space_id: space.id, user_id: 'owner', role: 'owner', joined_at: '2026-09-25' };
const member: SpaceMember = { space_id: space.id, user_id: 'member', role: 'member', joined_at: '2026-09-25' };

test('lifecycle target rules reject Personal, stale role and invalid transfer/remove targets', () => {
  assert.throws(() => lifecycleTarget('delete', { ...space, kind: 'personal' }, [owner], 'owner'), StaleSpaceLifecycleError);
  assert.throws(() => lifecycleTarget('leave', space, [owner, member], 'owner'), StaleSpaceLifecycleError);
  assert.throws(() => lifecycleTarget('remove', { ...space, membershipRole: 'member' }, [owner, member], 'member', 'owner'), StaleSpaceLifecycleError);
  assert.throws(() => lifecycleTarget('transfer', space, [owner, member], 'owner', 'owner'), StaleSpaceLifecycleError);
  assert.throws(() => lifecycleTarget('remove', space, [owner], 'owner', 'member'), StaleSpaceLifecycleError);
  assert.doesNotThrow(() => lifecycleTarget('leave', { ...space, membershipRole: 'member' }, [owner, member], 'member'));
  assert.doesNotThrow(() => lifecycleTarget('transfer', space, [owner, member], 'owner', 'member'));
});

test('each action revalidates canonical state and sends exactly one canonical RPC', async () => {
  for (const [action, actorId, targetId, method, args] of [
    ['leave', 'member', undefined, 'leave_shared_space', { p_space_id: 'shared' }],
    ['remove', 'owner', 'member', 'remove_space_member', { p_space_id: 'shared', p_member_user_id: 'member' }],
    ['transfer', 'owner', 'member', 'transfer_space_ownership', { p_space_id: 'shared', p_new_owner_user_id: 'member' }],
    ['delete', 'owner', undefined, 'delete_shared_space', { p_space_id: 'shared' }],
  ] as const) {
    const calls: string[] = [];
    const current = { ...space, membershipRole: actorId === 'owner' ? 'owner' : 'member' } as CurrentSpace;
    await executeSpaceLifecycle(action, current, [owner, member], actorId, targetId, {
      listSpaces: async () => { calls.push('spaces'); return [current]; },
      readMembers: async () => { calls.push('members'); return [owner, member]; },
      rpc: async (name, parameters) => { calls.push('rpc'); assert.equal(name, method); assert.deepEqual(parameters, args); return { error: null }; },
    });
    assert.deepEqual(calls, ['spaces', 'members', 'rpc']);
  }
});

test('stale Space/role/member state prevents mutation and backend conflicts are readable', async () => {
  for (const [listed, actualMembers] of [[[], [owner, member]], [[{ ...space, membershipRole: 'member' }], [owner, member]], [[space], [owner]]] as const) {
    let called = false;
    await assert.rejects(executeSpaceLifecycle('remove', space, [owner, member], 'owner', 'member', {
      listSpaces: async () => [...listed] as CurrentSpace[],
      readMembers: async () => [...actualMembers] as SpaceMember[],
      rpc: async () => { called = true; return { error: null }; },
    }), StaleSpaceLifecycleError);
    assert.equal(called, false);
  }
  assert.match(lifecycleErrorMessage('Shared Space not found'), /已不存在/);
  assert.match(lifecycleErrorMessage('Only the current owner may delete a Shared Space'), /角色已变化/);
  await assert.rejects(executeSpaceLifecycle('delete', space, [owner], 'owner', undefined, {
    listSpaces: async () => [space],
    readMembers: async () => [owner],
    rpc: async () => ({ error: { message: 'Only the current owner may delete a Shared Space' } }),
  }), /角色已变化/);
});

test('detail renders only authorized danger controls and keeps existing module controls', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { SpaceLifecycleControls, SpaceDetailContent } = await vite.ssrLoadModule('/src/components/SpaceManagementPage.tsx');
    const noop = () => undefined;
    const controls = (current: CurrentSpace, currentMembers: SpaceMember[], actor: string) => renderToStaticMarkup(React.createElement(SpaceLifecycleControls, { space: current, members: currentMembers, userId: actor, busy: false, onBusyChange: noop, onSettled: async () => undefined }));
    assert.equal(controls({ ...space, kind: 'personal' }, [], 'owner'), '');
    const ownerMarkup = controls(space, [owner, member], 'owner');
    assert.match(ownerMarkup, /移除成员|转让所有者|删除空间/);
    assert.doesNotMatch(ownerMarkup, /退出空间/);
    const soloOwner = controls(space, [owner], 'owner');
    assert.doesNotMatch(soloOwner, /移除成员|转让所有者/);
    const memberMarkup = controls({ ...space, membershipRole: 'member' }, [owner, member], 'member');
    assert.match(memberMarkup, /退出空间/);
    assert.doesNotMatch(memberMarkup, /移除成员|转让所有者|删除空间/);
    const staleMarkup = controls(space, [member], 'owner');
    assert.match(staleMarkup, /刷新空间列表/);
    assert.doesNotMatch(staleMarkup, /退出空间|移除成员|转让所有者|删除空间/);
    const detail = renderToStaticMarkup(React.createElement(SpaceDetailContent, { space: { ...space, kind: 'personal' }, members: [], moduleState: 'enabled', moduleError: '', moduleBusy: false, onModuleRetry: noop, onModuleToggle: noop, onSpaceChange: noop, lifecycleControls: React.createElement('span', {}, '危险操作') }));
    assert.match(detail, /使用的功能|任务/);
    assert.doesNotMatch(detail, /危险操作/);
  } finally { await vite.close(); }
});

test('confirmation and submission guard are present; App refresh does not mutate content filters', () => {
  const ui = readFileSync(new URL('../src/components/SpaceManagementPage.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(ui, /role="dialog" aria-modal="true"/);
  assert.match(ui, /deleteStep === 1/);
  assert.match(ui, /永久删除空间/);
  assert.match(ui, /submitting\.current = true/);
  assert.match(ui, /if \(!pending \|\| busy \|\| submitting\.current\) return/);
  const settled = app.split('async function lifecycleSettled(')[1]?.split('function updateSpace(')[0] ?? '';
  assert.match(settled, /settleSpaceLifecycle/);
  assert.match(settled, /setSpaceDetailRevision/);
  assert.match(settled, /setMyScreen\('management'\)/);
  assert.doesNotMatch(settled, /setCalendarFilter|setTaskFilter/);
});

test('successful leave/delete clear selection and detail before a failed refresh', async () => {
  for (const action of ['leave', 'delete'] as const) {
    const calls: string[] = [];
    let releaseRefresh: ((value: boolean) => void) | undefined;
    const refreshPending = new Promise<boolean>((resolve) => { releaseRefresh = resolve; });
    const operation = settleSpaceLifecycle(action, undefined, {
      clearSelection: () => { calls.push('clear-selection'); },
      closeDetail: () => { calls.push('close-detail'); },
      refresh: async (resetSelection) => { assert.equal(resetSelection, true); calls.push('refresh'); return refreshPending; },
      remountDetail: () => { calls.push('remount'); },
      showError: (message) => { assert.match(message, /已提交.*未能刷新/); calls.push('error'); },
    });
    assert.deepEqual(calls, ['clear-selection', 'close-detail', 'refresh']);
    releaseRefresh!(false);
    await operation;
    assert.deepEqual(calls, ['clear-selection', 'close-detail', 'refresh', 'error']);
  }
});

test('successful remove/transfer preserve selection and refresh current detail', async () => {
  for (const action of ['remove', 'transfer'] as const) {
    const calls: string[] = [];
    await settleSpaceLifecycle(action, undefined, {
      clearSelection: () => { calls.push('clear-selection'); },
      closeDetail: () => { calls.push('close-detail'); },
      refresh: async (resetSelection) => { assert.equal(resetSelection, false); calls.push('refresh'); return true; },
      remountDetail: () => { calls.push('remount'); },
      showError: () => { calls.push('error'); },
    });
    assert.deepEqual(calls, ['refresh', 'remount']);
  }
});

test('rejected lifecycle RPC refreshes canonical state without clearing a still-valid selection', async () => {
  const calls: string[] = [];
  await settleSpaceLifecycle('delete', '空间成员或角色已变化，请刷新后重试。', {
    clearSelection: () => { calls.push('clear-selection'); },
    closeDetail: () => { calls.push('close-detail'); },
    refresh: async (resetSelection) => { assert.equal(resetSelection, false); calls.push('refresh'); return true; },
    remountDetail: () => { calls.push('remount'); },
    showError: (message) => { assert.match(message, /角色已变化/); calls.push('error'); },
  });
  assert.deepEqual(calls, ['refresh', 'remount', 'error']);
});

test('canonical Calendar and Task eligibility reconcile lost filter targets, retaining valid filters', () => {
  const personal: CurrentSpace = { ...space, id: 'personal', kind: 'personal' };
  assert.equal(validCalendarFilter({ spaceId: space.id }, [personal]), 'all');
  assert.equal(normalizeTaskFilter({ spaceId: space.id }, [personal]), 'all');
  assert.deepEqual(validCalendarFilter({ spaceId: personal.id }, [personal]), { spaceId: personal.id });
  assert.deepEqual(normalizeTaskFilter({ spaceId: personal.id }, [personal]), { spaceId: personal.id });
});
