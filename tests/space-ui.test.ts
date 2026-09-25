import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { Session } from '@supabase/supabase-js';
import type { CurrentSpace, SpaceMember, Task } from '../src/types.ts';

const personal: CurrentSpace = { id: 'personal-a', name: '个人空间', kind: 'personal', invite_code: 'TEST', created_by: 'user-a', created_at: '2026-01-01', membershipRole: 'owner' };
const shared: CurrentSpace = { ...personal, id: 'shared-a', name: '旅行', kind: 'shared' };
const secondShared: CurrentSpace = { ...shared, id: 'shared-b' };
const members: SpaceMember[] = [{ space_id: shared.id, user_id: 'user-a', role: 'owner', joined_at: '2026-01-01', profiles: { display_name: 'A' } }];
const noop = () => undefined;
const task = (id: string, spaceId: string, assignee: string | null = null): Task => ({
  id, space_id: spaceId, created_by: 'user-a', assigned_to_user_id: assignee, title: id,
  status: 'open', due_on: null, created_at: '2026-09-24', updated_at: '2026-09-24',
});

test('Calendar and canonical TaskSheet retain existing Personal and Shared behavior', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CurrentSpaceApp, EventSheet } = await vite.ssrLoadModule('/src/App.tsx');
    const { TaskSheet } = await vite.ssrLoadModule('/src/components/TaskSheet.tsx');
    const eventProps = { target: null, userId: 'user-a', members, partnerId: null, onClose: noop, onSaved: noop, validateCreateTarget: async () => true };
    const personalEvent = renderToStaticMarkup(React.createElement(EventSheet, { ...eventProps, space: personal }));
    const sharedEvent = renderToStaticMarkup(React.createElement(EventSheet, { ...eventProps, space: shared }));
    assert.doesNotMatch(personalEvent, /归属|对方/);
    assert.match(sharedEvent, /归属/);

    const taskProps = { task: null, spaceId: personal.id, userId: 'user-a', members, onClose: noop, onSaved: async () => undefined };
    const personalTask = renderToStaticMarkup(React.createElement(TaskSheet, { ...taskProps, spaceKind: 'personal' }));
    const sharedTask = renderToStaticMarkup(React.createElement(TaskSheet, { ...taskProps, spaceKind: 'shared' }));
    assert.match(personalTask, /新建任务|标题/);
    assert.doesNotMatch(personalTask, /分配给|对方/);
    assert.match(sharedTask, /分配给/);
    const editTask = renderToStaticMarkup(React.createElement(TaskSheet, { ...taskProps, task: task('task-1', personal.id), spaceKind: 'personal' }));
    assert.match(editTask, /编辑任务|删除任务/);

    const calendar = renderToStaticMarkup(React.createElement(CurrentSpaceApp, {
      session: { user: { id: 'user-a' } } as Session, spaces: [shared], allSpaces: [personal, shared],
      calendarFilter: { spaceId: shared.id }, onCalendarFilterChange: noop,
      selectedDate: new Date('2026-09-24'), onSelectedDateChange: noop, viewMode: 'today', onViewModeChange: noop,
    }));
    assert.match(calendar, /筛选日历|新建日程/);
    assert.doesNotMatch(calendar, /邀请码|关闭任务模块|进入任务|查看日历/);
    assert.match(personalEvent, /fixed inset-0 z-20/);
    assert.match(personalTask, /fixed inset-0 z-20/);
  } finally { await vite.close(); }
});

test('four-tab Module Hub and Aggregate Tasks cards keep IDs, compact controls and safe areas', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { BottomNavigation } = await vite.ssrLoadModule('/src/App.tsx');
    const { ModuleHub } = await vite.ssrLoadModule('/src/components/ModuleHub.tsx');
    const { TaskFilterPicker, TaskRows, TasksArea } = await vite.ssrLoadModule('/src/components/TasksArea.tsx');
    const { MyPage } = await vite.ssrLoadModule('/src/components/MyPage.tsx');
    const nav = renderToStaticMarkup(React.createElement(BottomNavigation, { tab: 'modules', onChange: noop }));
    assert.match(nav, /首页.*日历.*功能中心.*我的/);
    assert.equal((nav.match(/<button/g) ?? []).length, 4);
    assert.doesNotMatch(nav, />空间<\/button>/);
    assert.match(nav, /grid-cols-4|bottom-nav.*min-h-12/);
    const hub = renderToStaticMarkup(React.createElement(ModuleHub, { onOpenTasks: noop }));
    assert.match(hub, /功能中心.*进入任务.*任务/);
    assert.doesNotMatch(hub, /清单|Review|纪念日|Memo|开启任务模块/);
    assert.match(hub, /min-h-16|safe-bottom/);

    const filter = renderToStaticMarkup(React.createElement(TaskFilterPicker, {
      spaces: [shared, { ...secondShared, name: '一个很长很长很长的共享空间名称' }],
      filter: 'all', onChange: noop,
    }));
    assert.match(filter, /筛选任务空间.*全部空间.*旅行.*一个很长很长很长的共享空间名称/);
    assert.doesNotMatch(filter, /个人空间/);
    assert.match(filter, /h-11.*min-w-0|truncate/);
    const rows = renderToStaticMarkup(React.createElement(TaskRows, {
      tasks: [task('共享任务一', shared.id, 'other'), task('共享任务二', secondShared.id)],
      sourceSpacesById: { [shared.id]: shared, [secondShared.id]: secondShared },
      membersBySpaceId: { [shared.id]: members, [secondShared.id]: members },
      userId: 'user-a', completed: false, busyTaskId: null, openingTask: false,
      onOpen: noop, onChangeStatus: noop,
    }));
    assert.match(rows, /data-space-id="shared-a" data-task-id="共享任务一"/);
    assert.match(rows, /data-space-id="shared-b" data-task-id="共享任务二"/);
    assert.equal((rows.match(/>旅行<\/span>/g) ?? []).length, 2);
    assert.match(rows, /由负责人完成/);
    assert.match(rows, /完成 共享任务二/);
    const tasksLoading = renderToStaticMarkup(React.createElement(TasksArea, { screen: 'tasks', onScreenChange: noop, onHubBack: noop, userId: 'user-a' }));
    assert.match(tasksLoading, /功能中心|正在读取任务/);
    assert.doesNotMatch(tasksLoading, /查看日历|邀请码|关闭任务模块/);
    const me = renderToStaticMarkup(React.createElement(MyPage, { userId: 'user-a', onManageSpaces: noop }));
    assert.match(me, /空间管理/);
    const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(styles, /min-width: 320px/);
    assert.match(styles, /\.pb-nav[\s\S]*padding-bottom: calc\(3rem \+ max\(1rem, env\(safe-area-inset-bottom\)\)\)/);
    assert.match(styles, /\.bottom-nav[\s\S]*padding-bottom: env\(safe-area-inset-bottom\)/);
    assert.match(html, /viewport-fit=cover/);
  } finally { await vite.close(); }
});
