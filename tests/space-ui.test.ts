import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { Session } from '@supabase/supabase-js';
import type { CurrentSpace, SpaceMember } from '../src/types.ts';

const personal: CurrentSpace = { id: 'personal-a', name: '个人空间', kind: 'personal', invite_code: 'SECRET', created_by: 'user-a', created_at: '2026-01-01', membershipRole: 'owner' };
const shared: CurrentSpace = { ...personal, id: 'shared-a', name: '旅行', kind: 'shared' };
const members: SpaceMember[] = [{ space_id: shared.id, user_id: 'user-a', role: 'owner', joined_at: '2026-01-01', profiles: { display_name: 'A' } }];

test('static Personal and Shared Space UI follows the frozen form and Hub boundaries', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CurrentSpaceApp, EventSheet, SpaceSelector } = await vite.ssrLoadModule('/src/App.tsx');
    const { TaskSheet } = await vite.ssrLoadModule('/src/components/TaskSheet.tsx');
    const { TasksArea } = await vite.ssrLoadModule('/src/components/TasksArea.tsx');
    const noop = () => undefined;
    const eventProps = { target: null, userId: 'user-a', members, partnerId: null, onClose: noop, onSaved: noop };
    const personalEvent = renderToStaticMarkup(React.createElement(EventSheet, { ...eventProps, space: personal }));
    const sharedEvent = renderToStaticMarkup(React.createElement(EventSheet, { ...eventProps, space: shared }));
    assert.doesNotMatch(personalEvent, /归属|对方/);
    assert.match(sharedEvent, /归属/);

    const taskProps = { task: null, spaceId: personal.id, userId: 'user-a', members, onClose: noop, onSaved: async () => undefined };
    const personalTask = renderToStaticMarkup(React.createElement(TaskSheet, { ...taskProps, spaceKind: 'personal' }));
    const sharedTask = renderToStaticMarkup(React.createElement(TaskSheet, { ...taskProps, spaceKind: 'shared' }));
    assert.match(personalTask, /新建任务|标题/);
    assert.doesNotMatch(personalTask, /\bTasks?\b/);
    assert.doesNotMatch(personalTask, /分配给|对方/);
    assert.match(sharedTask, /分配给/);
    const editTask = renderToStaticMarkup(React.createElement(TaskSheet, { ...taskProps, task: { id: 'task-1', space_id: personal.id, created_by: 'user-a', assigned_to_user_id: null, title: '测试任务', status: 'open', due_on: null, created_at: '2026-09-24', updated_at: '2026-09-24' }, spaceKind: 'personal' }));
    assert.match(editTask, /编辑任务|删除任务/);
    assert.doesNotMatch(editTask, /\bTasks?\b/);

    const session = { user: { id: 'user-a' } } as Session;
    const appProps = { session, onSpaceUpdate: noop, onSpaceSelectorOpen: noop };
    const personalHub = renderToStaticMarkup(React.createElement(CurrentSpaceApp, { ...appProps, space: personal }));
    const sharedHub = renderToStaticMarkup(React.createElement(CurrentSpaceApp, { ...appProps, space: shared }));
    assert.doesNotMatch(personalHub, /邀请码|SECRET/);
    assert.match(sharedHub, /邀请码/);

    const hubProps = { screen: 'hub', members, userId: 'user-a', moduleState: 'enabled', moduleError: '', moduleBusy: false, isOwner: true, onModuleRetry: noop, onModuleToggle: noop, invitePanel: React.createElement('div', null, 'INVITE_CONTROL'), onScreenChange: noop, onMembersOpen: noop, onSpaceSelectorOpen: noop };
    const personalEnabled = renderToStaticMarkup(React.createElement(TasksArea, { ...hubProps, space: personal }));
    const sharedEnabled = renderToStaticMarkup(React.createElement(TasksArea, { ...hubProps, space: shared }));
    assert.doesNotMatch(personalEnabled, /INVITE_CONTROL|\bTasks?\b/);
    assert.match(sharedEnabled, /INVITE_CONTROL/);
    for (const markup of [personalEnabled, sharedEnabled]) {
      assert.match(markup, /关闭任务模块/);
      assert.match(markup, /进入任务/);
      assert.match(markup, /项待完成|载入中/);
    }

    const disabled = renderToStaticMarkup(React.createElement(TasksArea, { ...hubProps, space: personal, moduleState: 'disabled' }));
    assert.match(disabled, /开启任务模块/);
    assert.doesNotMatch(disabled, /进入任务|项待完成/);
    const member = renderToStaticMarkup(React.createElement(TasksArea, { ...hubProps, space: shared, isOwner: false }));
    assert.match(member, /已开启/);
    assert.doesNotMatch(member, /关闭任务模块|开启任务模块/);
    const memberDisabled = renderToStaticMarkup(React.createElement(TasksArea, { ...hubProps, space: shared, isOwner: false, moduleState: 'disabled' }));
    assert.match(memberDisabled, /已关闭/);
    assert.doesNotMatch(memberDisabled, /进入任务|开启任务模块/);
    const unknown = renderToStaticMarkup(React.createElement(TasksArea, { ...hubProps, space: shared, moduleState: 'error', moduleError: '任务模块状态读取失败，请重试。' }));
    assert.match(unknown, /任务模块状态读取失败|重试/);
    assert.doesNotMatch(unknown, /进入任务|关闭任务模块|开启任务模块/);
    const safeHub = renderToStaticMarkup(React.createElement(TasksArea, { ...hubProps, space: shared, screen: 'tasks', moduleState: 'disabled' }));
    assert.match(safeHub, /模块/);
    assert.doesNotMatch(safeHub, /新建任务|待完成 ·|已完成 ·/);
    const unknownHub = renderToStaticMarkup(React.createElement(TasksArea, { ...hubProps, space: shared, screen: 'completed', moduleState: 'error' }));
    assert.match(unknownHub, /模块/);
    assert.doesNotMatch(unknownHub, /已完成任务|重新打开/);
    const completed = renderToStaticMarkup(React.createElement(TasksArea, { ...hubProps, space: shared, screen: 'completed' }));
    assert.match(completed, /已完成任务/);
    assert.doesNotMatch(completed, /\bTasks?\b/);

    const selector = renderToStaticMarkup(React.createElement(SpaceSelector, {
      spaces: [personal, shared], selectedSpaceId: personal.id, onSelect: noop, onClose: noop, onSharedReady: async () => true,
    }));
    assert.match(selector, /我的空间/);
    assert.match(selector, /旅行/);
    assert.match(selector, /创建共享空间/);
    assert.match(selector, /加入空间/);
  } finally {
    await vite.close();
  }
});
