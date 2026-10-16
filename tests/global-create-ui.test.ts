import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { Session } from '@supabase/supabase-js';
import type { CurrentSpace, SpaceMember } from '../src/types.ts';

const personal = { id: 'personal', name: '我的空间', kind: 'personal', created_by: 'me', membershipRole: 'owner' } as CurrentSpace;
const shared = { id: 'shared', name: '我们的日历', kind: 'shared', created_by: 'me', membershipRole: 'owner' } as CurrentSpace;
const members = [{ space_id: 'personal', user_id: 'me', role: 'owner' }] as SpaceMember[];
const noop = () => undefined;

test('Home has direct section create actions and no old title action or type chooser', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { HomePage } = await vite.ssrLoadModule('/src/components/HomePage.tsx');
    const { CurrentSpaceApp, BottomNavigation } = await vite.ssrLoadModule('/src/App.tsx');
    const { MyPage } = await vite.ssrLoadModule('/src/components/MyPage.tsx');
    const { ModuleHub } = await vite.ssrLoadModule('/src/components/ModuleHub.tsx');
    const home = renderToStaticMarkup(React.createElement(HomePage, { spaces: [personal, shared], userId: 'me', EventSheetComponent: () => null, onMembershipRefresh: async () => undefined }));
    assert.match(home, /<h1[^>]*>今日安排<\/h1>/);
    assert.doesNotMatch(home, /<h1[^>]*>今日安排<\/h1><button|<h2[^>]*>创建<\/h2>|>日程<\/button>|>任务<\/button>/);
    assert.match(home, /<section[^>]*aria-label="近期日程"[^>]*>.*?<h2[^>]*>近期日程<\/h2><button[^>]*aria-label="新建日程"/);
    assert.match(home, /<section[^>]*aria-label="重要日"[^>]*>.*?aria-label="新建重要日"/);
    assert.match(home, /<section[^>]*aria-label="待办事项"[^>]*>.*?<h2[^>]*>待办事项<\/h2><button[^>]*aria-label="新建任务"/);
    const common = { session: { user: { id: 'me' } } as Session, space: personal, spaces: [personal], allSpaces: [personal, shared], calendarFilter: 'all' as const, onCalendarFilterChange: noop, screen: 'calendar' as const, onScreenChange: noop, onHubBack: noop, selectedDate: new Date(), onSelectedDateChange: noop, viewMode: 'today' as const, onViewModeChange: noop, onSpaceUpdate: noop };
    assert.equal((renderToStaticMarkup(React.createElement(CurrentSpaceApp, common)).match(/aria-label="新建日程"/g) ?? []).length, 1);
    for (const markup of [
      renderToStaticMarkup(React.createElement(ModuleHub, { onOpenTasks: noop })),
      renderToStaticMarkup(React.createElement(MyPage, { userId: 'me' })),
      renderToStaticMarkup(React.createElement(BottomNavigation, { tab: 'home', onChange: noop })),
    ]) assert.doesNotMatch(markup, /aria-label="新建日程"|aria-label="新建任务"/);
  } finally { await vite.close(); }
});

test('global create keeps target selection with one header save; local create keeps its Space constraint', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { EventSheet } = await vite.ssrLoadModule('/src/App.tsx');
    const { TaskSheet } = await vite.ssrLoadModule('/src/components/TaskSheet.tsx');
    const control = { spaces: [personal, shared], selectedId: personal.id, enabledIds: [shared.id], state: 'ready' as const, error: '', onSelect: noop, onRetry: noop };
    const eventProps = { target: null, space: personal, userId: 'me', members, partnerId: null, onClose: noop, onSaved: noop, validateCreateTarget: async () => true };
    const globalEvent = renderToStaticMarkup(React.createElement(EventSheet, { ...eventProps, createTarget: control }));
    const localEvent = renderToStaticMarkup(React.createElement(EventSheet, eventProps));
    assert.match(globalEvent, /保存到.*<button[^>]*id="event-create-target"/);
    assert.match(globalEvent, /type="submit" form="event-sheet-form"[^>]*>保存<\/button>/);
    assert.match(globalEvent, /aria-haspopup="listbox"[^>]*>我的空间<\/button>/);
    assert.doesNotMatch(localEvent, /event-create-target|确认保存/);
    assert.match(localEvent, />保存<\/button>/);
    const taskProps = { task: null, spaceId: personal.id, spaceKind: personal.kind, userId: 'me', members, onClose: noop, onSaved: async () => undefined };
    const globalTask = renderToStaticMarkup(React.createElement(TaskSheet, { ...taskProps, createTarget: control, validateGlobalCreate: async () => undefined }));
    const localTask = renderToStaticMarkup(React.createElement(TaskSheet, taskProps));
    assert.match(globalTask, /保存到.*<button[^>]*id="task-create-target"/);
    assert.match(globalTask, /type="submit" form="task-sheet-form"[^>]*>保存<\/button>/);
    assert.match(globalTask, /aria-haspopup="listbox"[^>]*>我的空间<\/button>/);
    assert.doesNotMatch(localTask, /task-create-target|确认保存/);
    assert.match(localTask, />保存<\/button>/);
    const loadingShared = { ...control, selectedId: shared.id, state: 'loading' as const };
    const sharedMembers = [{ space_id: shared.id, user_id: 'me', role: 'owner' }, { space_id: shared.id, user_id: 'other', role: 'member' }] as SpaceMember[];
    const loadingEvent = renderToStaticMarkup(React.createElement(EventSheet, { ...eventProps, space: shared, members: sharedMembers, partnerId: 'other', createTarget: loadingShared }));
    const loadingTask = renderToStaticMarkup(React.createElement(TaskSheet, { ...taskProps, spaceId: shared.id, spaceKind: shared.kind, members: sharedMembers, createTarget: loadingShared, validateGlobalCreate: async () => undefined }));
    assert.doesNotMatch(loadingEvent, /归属/);
    assert.doesNotMatch(loadingTask, /分配给/);
  } finally { await vite.close(); }
});

test('four-tab navigation preserves every destination, active page and native disabled controls', async () => {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const elements = (node: any): any[] => React.isValidElement(node) ? [node, ...React.Children.toArray((node.props as any).children).flatMap(elements)] : [];
  try {
    const { BottomNavigation } = await vite.ssrLoadModule('/src/App.tsx');
    const ids = ['home', 'calendar', 'modules', 'me'];
    for (const current of ids) {
      const calls: string[] = [];
      const tree = BottomNavigation({ tab: current, onChange: (id: string) => calls.push(id) });
      const buttons = elements(tree).filter((el) => el.type === 'button');
      assert.equal(buttons.length, 4);
      assert.deepEqual(buttons.map((el) => el.props['aria-current']), ids.map((id) => id === current ? 'page' : undefined));
      for (const control of buttons) control.props.onClick();
      assert.deepEqual(calls, ids);
      const markup = renderToStaticMarkup(tree);
      assert.equal((markup.match(/aria-hidden="true"/g) ?? []).length, 4);
      assert.match(markup, />首页<.*>日历<.*>功能中心<.*>我的</);
      const blocked = elements(BottomNavigation({ tab: current, disabled: true, onChange: noop })).filter((el) => el.type === 'button');
      assert.equal(blocked.every((el) => el.props.disabled === true), true);
    }
  } finally { await vite.close(); }
});
