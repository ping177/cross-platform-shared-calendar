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
    assert.match(personalTask, /标题/);
    assert.doesNotMatch(personalTask, /分配给|对方/);
    assert.match(sharedTask, /分配给/);

    const session = { user: { id: 'user-a' } } as Session;
    const appProps = { session, onSpaceUpdate: noop, onSpaceSelectorOpen: noop };
    const personalHub = renderToStaticMarkup(React.createElement(CurrentSpaceApp, { ...appProps, space: personal }));
    const sharedHub = renderToStaticMarkup(React.createElement(CurrentSpaceApp, { ...appProps, space: shared }));
    assert.doesNotMatch(personalHub, /邀请码|SECRET/);
    assert.match(sharedHub, /邀请码/);

    const hubProps = { screen: 'hub', members, userId: 'user-a', invitePanel: React.createElement('div', null, 'INVITE_CONTROL'), onScreenChange: noop, onMembersOpen: noop, onSpaceSelectorOpen: noop };
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(TasksArea, { ...hubProps, space: personal })), /INVITE_CONTROL/);
    assert.match(renderToStaticMarkup(React.createElement(TasksArea, { ...hubProps, space: shared })), /INVITE_CONTROL/);

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
