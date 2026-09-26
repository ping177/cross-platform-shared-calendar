import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { CurrentSpace, SpaceMember } from '../src/types.ts';

const personal: CurrentSpace = { id: 'personal-1', name: '个人空间', kind: 'personal', invite_code: 'HIDDEN', created_by: 'me', created_at: '2026-01-01', membershipRole: 'owner' };
const shared: CurrentSpace = { ...personal, id: 'shared-1', kind: 'shared', name: '同名空间', invite_code: 'VISIBLE' };
const sameName: CurrentSpace = { ...shared, id: 'shared-2' };
const members: SpaceMember[] = [
  { space_id: shared.id, user_id: 'me', role: 'owner', joined_at: '2026-01-01', profiles: { display_name: '我' } },
  { space_id: shared.id, user_id: 'other', role: 'member', joined_at: '2026-01-02', profiles: { display_name: '同伴' } },
];

test('My and management list keep profile actions and identify personal and same-name shared spaces by ID', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { MyPage } = await vite.ssrLoadModule('/src/components/MyPage.tsx');
    const { SpaceManagementPage } = await vite.ssrLoadModule('/src/components/SpaceManagementPage.tsx');
    const noop = () => undefined;
    const my = renderToStaticMarkup(React.createElement(MyPage, { userId: 'me', onManageSpaces: noop }));
    assert.match(my, /显示名称|空间管理|此设备通知设置|退出登录/);
    const props = { spaces: [personal, shared, sameName], selectedSpaceId: null, onSelect: noop, onBack: noop, onReady: async () => true, onSpaceChange: noop, busy: false, onBusyChange: noop };
    const list = renderToStaticMarkup(React.createElement(SpaceManagementPage, props));
    assert.match(list, /个人空间|共享空间|创建共享空间|加入空间/);
    assert.equal((list.match(/同名空间/g) ?? []).length, 2);
    assert.match(list, /共享空间 1/);
    assert.match(list, /共享空间 2/);
    assert.match(list, /shared-1/);
    assert.match(list, /shared-2/);
    assert.match(list, /max-w-3xl|safe-bottom/);
    assert.match(list, /min-h-14|break-all/);
    const selected = renderToStaticMarkup(React.createElement(SpaceManagementPage, { ...props, selectedSpaceId: personal.id }));
    assert.match(selected, /个人空间|使用的功能/);
    assert.doesNotMatch(selected, /创建共享空间|加入空间/);
    const emptyShared = renderToStaticMarkup(React.createElement(SpaceManagementPage, { ...props, spaces: [personal] }));
    assert.match(emptyShared, /暂无共享空间/);
  } finally {
    await vite.close();
  }
});

test('Space detail limits personal controls and preserves shared roles, invitation and owner-only Tasks toggle', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { SpaceDetailContent } = await vite.ssrLoadModule('/src/components/SpaceManagementPage.tsx');
    const noop = () => undefined;
    const props = { space: personal, members: [], moduleState: 'disabled', moduleError: '', moduleBusy: false, onModuleRetry: noop, onModuleToggle: noop, onSpaceChange: noop };
    const personalMarkup = renderToStaticMarkup(React.createElement(SpaceDetailContent, props));
    assert.match(personalMarkup, /个人空间|使用的功能|任务|开启任务模块/);
    assert.match(personalMarkup, /清单|开启清单模块/);
    assert.doesNotMatch(personalMarkup, /邀请码|复制邀请码|轮换邀请码|空间成员|移除成员|邀请成员|所有者/);
    const sharedMarkup = renderToStaticMarkup(React.createElement(SpaceDetailContent, { ...props, space: shared, members, moduleState: 'enabled' }));
    assert.match(sharedMarkup, /同名空间|空间成员|我|同伴|所有者|成员|VISIBLE|复制邀请码|轮换邀请码|关闭任务模块/);
    assert.match(sharedMarkup, /min-h-11/);
    const memberMarkup = renderToStaticMarkup(React.createElement(SpaceDetailContent, { ...props, space: { ...shared, membershipRole: 'member' }, members, moduleState: 'disabled' }));
    assert.match(memberMarkup, /已关闭/);
    assert.doesNotMatch(memberMarkup, /开启清单模块|关闭清单模块/);
    assert.doesNotMatch(memberMarkup, /开启任务模块|关闭任务模块/);
    const unknownMarkup = renderToStaticMarkup(React.createElement(SpaceDetailContent, { ...props, space: shared, members, moduleState: 'error', moduleError: '读取失败' }));
    assert.match(unknownMarkup, /读取失败|重试/);
    assert.doesNotMatch(unknownMarkup, /开启任务模块|关闭任务模块/);
  } finally {
    await vite.close();
  }
});

test('My is the only Space management entry and selection does not drive content filters', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const forms = readFileSync(new URL('../src/components/SharedSpaceForms.tsx', import.meta.url), 'utf8');
  const management = readFileSync(new URL('../src/components/SpaceManagementPage.tsx', import.meta.url), 'utf8');
  const selection = app.split('async function selectManagedSpace(')[1]?.split('async function refreshSpaces(')[0] ?? '';
  const managedReady = app.split('async function managedSpaceReady(')[1]?.split('function updateSpace(')[0] ?? '';
  assert.match(app, /<SpaceManagementPage[\s\S]*onReady=\{managedSpaceReady\}/);
  assert.match(management, /<SharedSpaceForms onReady=\{onReady\}/);
  assert.doesNotMatch(app, /<SpacePage|sharedSpaceReady|legacySpaceId/);
  assert.match(forms, /completeSharedSpaceAction\(action, value/);
  assert.match(managedReady, /refreshSpaces\(false, spaceId\)/);
  assert.match(managedReady, /setSelectedSpaceId\(spaceId\)/);
  assert.match(managedReady, /setMyScreen\('detail'\)/);
  assert.doesNotMatch(`${selection}${managedReady}`, /setCalendarFilter|setTaskFilter|createTarget/);
});
