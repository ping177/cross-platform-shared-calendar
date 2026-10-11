import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const space = { id: 'personal', name: '我的空间', kind: 'personal', membershipRole: 'owner', created_by: 'me' };
const task = (id: string, status = 'open') => ({ id, space_id: space.id, title: id, status, assigned_to_user_id: null, due_on: '2026-10-15', created_by: 'me' });
const data = () => ({ memberSpaces: [space], eligibleSpaces: [space], filter: 'all', grouped: { open: [task('待办')], completed: [task('完成事项', 'completed')] }, sourceSpacesById: { personal: space }, membersBySpaceId: { personal: [{ space_id: space.id, user_id: 'me' }] } });

async function fixture(run: (env: any) => void) {
  const m: any = { tasks: { filter: 'all', state: { status: 'ready', data: data(), error: '' }, canAct: true, chooseFilter() {}, refresh() {} }, editor: { create: null, editing: null, openingCreate: false, openingTask: false, busyTaskId: null } };
  (globalThis as any).__slice7Tasks = m;
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{
    name: 'slice7-tasks-fixture', enforce: 'pre',
    resolveId(id) { if (id.endsWith('/useAggregateTasks')) return '\0slice7-data'; if (id.endsWith('/useTaskModuleEditor')) return '\0slice7-editor'; },
    load(id) { if (id === '\0slice7-data') return 'export const useAggregateTasks=()=>globalThis.__slice7Tasks.tasks;'; if (id === '\0slice7-editor') return 'export const useTaskModuleEditor=()=>globalThis.__slice7Tasks.editor;'; },
  }] } as any);
  try {
    const { TasksArea } = await vite.ssrLoadModule('/src/components/TasksArea.tsx');
    run({ m, render: (screen = 'tasks') => renderToStaticMarkup(React.createElement(TasksArea, { screen, userId: 'me', onScreenChange() {}, onHubBack() {} })) });
  } finally { await vite.close(); delete (globalThis as any).__slice7Tasks; }
}

test('completed tasks use a native same-page disclosure, initially folded, with original reopen and edit controls', () => fixture(({ render }) => {
  const html = render();
  assert.match(html, /<details[^>]*class="[^"]*ui-task-completed/);
  assert.doesNotMatch(html.match(/<details[^>]*>/)?.[0] ?? '', /\bopen(?:=|\s|>)/);
  assert.match(html, /<summary[^>]*>.*已完成/s);
  assert.match(html, /重新打开 完成事项/);
  assert.match(html, /打开任务 完成事项/);
}));
test('old completed navigation remains supported with its original title and direct completed rows', () => fixture(({ render }) => {
  const html = render('completed');
  assert.match(html, /已完成任务/);
  assert.match(html, /重新打开 完成事项/);
  assert.doesNotMatch(html, /<details/);
  assert.doesNotMatch(html, /data-task-id="待办"/);
}));
test('zero, loading, read failure and no-qualified-Space are distinct and do not expose stale rows', () => fixture(({ m, render }) => {
  m.tasks.state.data.grouped = { open: [], completed: [] };
  assert.match(render(), /暂无待完成事项/);
  assert.match(render(), /暂无已完成事项/);
  for (const status of ['loading', 'error']) {
    m.tasks.state = { status, data: data(), error: '任务读取失败' };
    const html = render(); assert.doesNotMatch(html, /data-task-id=/);
    assert.match(html, status === 'loading' ? /正在读取任务/ : /任务读取失败/);
  }
  m.tasks.state = { status: 'ready', data: { ...data(), eligibleSpaces: [], grouped: { open: [], completed: [] } }, error: '' }; m.tasks.canAct = false;
  assert.match(render(), /暂无已开启任务的空间/);
  assert.match(render(), /disabled=""[^>]*aria-label="新建任务"/);
}));
test('task create button uses the accepted Home plus size, transparent target and unchanged disabled rules', () => fixture(({ m, render }) => {
  const html = render();
  const button = html.match(/<button[^>]*aria-label="新建任务"[^>]*>.*?<\/button>/s)?.[0] ?? '';
  assert.match(button, /bg-transparent/); assert.match(button, /ui-focus/);
  assert.match(button, /h-11 w-11/); assert.match(button, /width="18" height="18"/);
  assert.doesNotMatch(button, /bg-ui-accent\b|text-ui-on-accent/);
  m.tasks.canAct = false; assert.match(render(), /disabled=""[^>]*aria-label="新建任务"/);
}));
