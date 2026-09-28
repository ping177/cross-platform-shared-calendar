import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { CurrentSpace, List, Task } from '../src/types.ts';

const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { ModuleHub } = await vite.ssrLoadModule('/src/components/ModuleHub.tsx');
const { TasksArea } = await vite.ssrLoadModule('/src/components/TasksArea.tsx');
const { ReviewHistoryPage } = await vite.ssrLoadModule('/src/components/ReviewHistoryPage.tsx');
const { ListsOverviewPage } = await vite.ssrLoadModule('/src/components/ListsOverviewPage.tsx');
const { sameModuleScope } = await vite.ssrLoadModule('/src/lib/module-availability.ts');
const { initialNavigation, selectTab, openTaskModule, openReviewModule, openListsModule } = await vite.ssrLoadModule('/src/lib/navigation.ts');
test.after(async () => { await vite.close(); });

const space = { id: 's', name: '共享空间', kind: 'shared', membershipRole: 'owner', created_by: 'me' } as CurrentSpace;
const entry = { memberSpaces: [space], eligibleSpaces: [space] };
const noop = () => undefined;
const hub = () => renderToStaticMarkup(React.createElement(ModuleHub, {
  availability: { tasksIds: ['s'], reviewIds: ['s'], listsIds: ['s'], tasksError: false, reviewError: false, listsError: false },
  onRefresh: noop, onOpenTasks: noop, onOpenReview: noop, onOpenLists: noop,
}));

test('Hub → Tasks → Hub → Tasks remount renders validated rows without a second loading view', () => {
  let nav = selectTab(initialNavigation, 'modules');
  assert.equal(nav.moduleScreen, 'hub');
  assert.match(hub(), /进入任务/);
  nav = openTaskModule(nav);
  assert.equal(nav.moduleScreen, 'tasks');
  const props = { screen: 'tasks', userId: 'me', entry, onScreenChange: noop, onHubBack: noop };
  assert.match(renderToStaticMarkup(React.createElement(TasksArea, props)), /正在读取任务/);
  const task = { id: 't', space_id: 's', title: '保留的任务', status: 'open', assigned_to_user_id: null, due_on: null, created_by: 'me', created_at: '2026-09-28', updated_at: '2026-09-28' } as Task;
  const validated = { filter: 'all', memberSpaces: [space], eligibleSpaces: [space], grouped: { open: [task], completed: [] }, sourceSpacesById: { s: space }, membersBySpaceId: { s: [] } };
  nav = selectTab(nav, 'modules');
  assert.equal(nav.moduleScreen, 'hub');
  hub();
  nav = openTaskModule(nav);
  const restored = renderToStaticMarkup(React.createElement(TasksArea, { ...props, initialData: validated }));
  assert.match(restored, /保留的任务/);
  assert.doesNotMatch(restored, /正在读取任务/);
});

test('Hub → Review → Hub → Review remount renders the selected validated history immediately', () => {
  let nav = selectTab(initialNavigation, 'modules');
  hub();
  nav = openReviewModule(nav);
  const props = { userId: 'me', entry, currentSpaceId: 's', onSpaceChange: noop, onOpenDetail: noop, onHubBack: noop };
  assert.match(renderToStaticMarkup(React.createElement(ReviewHistoryPage, props)), /正在读取历史回顾/);
  const round = { id: 'r', space_id: 's', round_no: 1, review_date: '2026-09-28', created_by: 'me', created_at: '2026-09-28' };
  const validated = { selectedSpaceId: 's', rows: [{ round, mine: '已填写', other: '编辑中' }], cursor: round, hasMore: false, totalCount: 1 };
  nav = selectTab(nav, 'modules');
  hub();
  nav = openReviewModule(nav);
  assert.equal(nav.moduleScreen, 'review');
  const restored = renderToStaticMarkup(React.createElement(ReviewHistoryPage, { ...props, initialSnapshot: validated }));
  assert.match(restored, /2026-09-28.*已填写/);
  assert.doesNotMatch(restored, /正在读取历史回顾/);
});

test('Hub → Lists → Hub → Lists remount renders validated overview before reread', () => {
  let nav = selectTab(initialNavigation, 'modules');
  hub();
  nav = openListsModule(nav);
  const props = { userId: 'me', entry, onHubBack: noop, onNoEligible: noop, onOpenDetail: noop };
  assert.match(renderToStaticMarkup(React.createElement(ListsOverviewPage, props)), /正在读取清单/);
  const list = { id: 'l', space_id: 's', name: '保留的清单', created_by: 'me', created_at: '2026-09-28', updated_at: '2026-09-28' } as List;
  const validated = { memberSpaces: [space], eligibleSpaces: [space], grouped: { active: [{ list, totalItems: 2, completedCount: 1 }], completed: [] } };
  nav = selectTab(nav, 'modules');
  hub();
  nav = openListsModule(nav);
  assert.equal(nav.moduleScreen, 'lists');
  const restored = renderToStaticMarkup(React.createElement(ListsOverviewPage, { ...props, initialData: validated }));
  assert.match(restored, /保留的清单/);
  assert.doesNotMatch(restored, /正在读取清单/);
});

test('confirmed scope change and unsafe hint reject restored views', () => {
  assert.equal(sameModuleScope(entry, [space], [space]), true);
  assert.equal(sameModuleScope({ memberSpaces: [space], eligibleSpaces: [] }, [space], [space]), false);
  assert.equal(sameModuleScope({ memberSpaces: [], eligibleSpaces: [] }, [space], [space]), false);
  assert.equal(sameModuleScope(null, [space], [space]), false);
});

test('session owner and view-owned Realtime lifecycle stay at their narrow boundaries', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const tasks = readFileSync(new URL('../src/components/useAggregateTasks.ts', import.meta.url), 'utf8');
  const lists = readFileSync(new URL('../src/components/useListsOverview.ts', import.meta.url), 'utf8');
  assert.match(app, /key=\{`\$\{session\.user\.id\}:\$\{authEpoch\}`\}/);
  assert.match(app, /event === 'SIGNED_OUT'\) setAuthEpoch/);
  assert.match(app, /tasksSnapshot\.current\?\.userId === userId && sameModuleScope/);
  assert.match(app, /listsSnapshot\.current\?\.userId === userId && sameModuleScope/);
  assert.match(app, /reviewSnapshot\.current\?\.userId === userId && reviewSnapshot\.current\.history\.selectedSpaceId === reviewSpaceId/);
  assert.match(tasks, /return \(\) => \{ active = false; cleanup\(\); \}/);
  assert.match(lists, /signal\.stop\(\);\s*cleanup\(\);/);
  assert.match(tasks, /const scopeIds = state\.status === 'ready' && !lostSpace/);
  assert.match(lists, /const activeScopeIds = lostSpace \? '' : scopeIds/);
});
