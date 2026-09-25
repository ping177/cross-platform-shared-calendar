import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readAggregateTasks } from '../src/lib/aggregate-tasks.ts';
import type { CurrentSpace } from '../src/types.ts';

test('Tasks stays in Module navigation while eligibility reloads, errors or becomes empty', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { TasksArea } = await vite.ssrLoadModule('/src/components/TasksArea.tsx');
    const { initialNavigation, selectTab, openTaskModule, openCompletedTasks } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    const space = { id: 'space-a', name: '我的空间', kind: 'personal', created_by: 'user-a', membershipRole: 'owner' } as CurrentSpace;
    const tasks = openTaskModule(selectTab(initialNavigation, 'modules'));
    const completed = openCompletedTasks(tasks);
    assert.deepEqual(tasks, { tab: 'modules', moduleScreen: 'tasks' });
    assert.deepEqual(completed, { tab: 'modules', moduleScreen: 'completed' });
    const noTaskRead = async () => { throw new Error('Task rows must not load when disabled'); };
    const disabled = await readAggregateTasks([space], 'all', {
      modulePage: async () => ({ data: [{ space_id: space.id, enabled: false }], count: 1, error: null }),
      taskPage: noTaskRead,
    });
    assert.deepEqual(disabled.grouped, { open: [], completed: [] });
    await assert.rejects(readAggregateTasks([space], 'all', {
      modulePage: async () => ({ data: null, count: null, error: new Error('module unavailable') }),
      taskPage: noTaskRead,
    }), /module unavailable/);
    const openMarkup = renderToStaticMarkup(React.createElement(TasksArea, { screen: 'tasks', onScreenChange: () => undefined, onHubBack: () => undefined, userId: 'user-a' }));
    const completedMarkup = renderToStaticMarkup(React.createElement(TasksArea, { screen: 'completed', onScreenChange: () => undefined, onHubBack: () => undefined, userId: 'user-a' }));
    assert.match(openMarkup, /功能中心|正在读取任务/);
    assert.match(completedMarkup, /已完成任务|正在读取任务/);
    assert.doesNotMatch(openMarkup + completedMarkup, /查看日历|进入任务|开启任务模块|关闭任务模块/);
  } finally { await vite.close(); }
});
