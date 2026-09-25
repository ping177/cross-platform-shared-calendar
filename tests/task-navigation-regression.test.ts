import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { tasksModuleForcesHub, type TasksModuleState } from '../src/lib/space-modules.ts';

test('Tasks remains on its own screen through module recheck, error/retry, and confirmed disable', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { TasksArea } = await vite.ssrLoadModule('/src/components/TasksArea.tsx');
    const { initialNavigation, selectTab, openSpace, openSpaceScreen } = await vite.ssrLoadModule('/src/lib/navigation.ts');
    const noop = () => undefined;
    const props = {
      onScreenChange: noop, onHubBack: noop,
      space: { id: 'space-a', name: '我的空间', kind: 'personal', created_by: 'user-a', created_at: '2026-01-01' },
      members: [], userId: 'user-a', moduleBusy: false,
      isOwner: true, onModuleRetry: noop, onModuleToggle: noop, invitePanel: null, onMembersOpen: noop,
    };
    let navigation = openSpace(selectTab(initialNavigation, 'spaces'));
    const afterModuleUpdate = (moduleState: TasksModuleState) => {
      if (tasksModuleForcesHub(moduleState, navigation.spaceScreen)) navigation = openSpaceScreen(navigation, 'hub');
      return renderToStaticMarkup(React.createElement(TasksArea, {
        ...props, screen: navigation.spaceScreen, moduleState,
        moduleError: moduleState === 'error' ? '任务模块状态读取失败，请重试。' : '',
      }));
    };

    assert.match(afterModuleUpdate('enabled'), /进入任务/);
    navigation = openSpaceScreen(navigation, 'tasks'); // User enters Tasks from the Space Hub.
    const enabledBefore = afterModuleUpdate('enabled');
    assert.match(enabledBefore, /新建任务|待完成/);
    const loading = afterModuleUpdate('loading'); // Effect starts the authoritative re-read after Hub → Tasks.
    assert.equal(navigation.spaceScreen, 'tasks');
    assert.match(loading, /正在确认任务模块/);
    assert.doesNotMatch(loading, /新建任务|查看日历|进入任务|待完成|重新打开/);
    const enabledAfter = afterModuleUpdate('enabled'); // Re-render after loading → enabled.
    assert.equal(navigation.spaceScreen, 'tasks');
    assert.match(enabledAfter, /新建任务|待完成/);

    afterModuleUpdate('loading');
    const error = afterModuleUpdate('error'); // Re-render after loading → error.
    assert.equal(navigation.spaceScreen, 'tasks');
    assert.match(error, /任务模块状态读取失败/);
    assert.match(error, /重试/);
    assert.doesNotMatch(error, /新建任务|查看日历|进入任务|待完成|重新打开/);
    afterModuleUpdate('loading'); // Retry re-reads module state in place.
    const recovered = afterModuleUpdate('enabled');
    assert.equal(navigation.spaceScreen, 'tasks');
    assert.match(recovered, /新建任务|待完成/);

    afterModuleUpdate('loading');
    const disabled = afterModuleUpdate('disabled');
    assert.equal(navigation.spaceScreen, 'hub');
    assert.match(disabled, /查看日历/);
    assert.doesNotMatch(disabled, /新建任务|待完成/);
    assert.equal(tasksModuleForcesHub('loading', 'completed'), false);
    assert.equal(tasksModuleForcesHub('error', 'completed'), false);
    assert.equal(tasksModuleForcesHub('disabled', 'completed'), true);
  } finally {
    await vite.close();
  }
});
