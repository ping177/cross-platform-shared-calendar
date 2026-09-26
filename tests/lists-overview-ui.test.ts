import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { CurrentSpace, List } from '../src/types.ts';

const personal = { id: 'personal', name: '我的空间', kind: 'personal', created_by: 'me', membershipRole: 'owner' } as CurrentSpace;
const shared = { id: 'shared', name: '共同空间', kind: 'shared', created_by: 'other', membershipRole: 'member' } as CurrentSpace;
const list = { id: 'list-a', space_id: shared.id, name: '旅行采购', created_by: 'me', created_at: '2026-09-27', updated_at: '2026-09-27' } as List;

test('overview rows show source and progress without a fake detail target', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ListsRows } = await vite.ssrLoadModule('/src/components/ListsOverviewPage.tsx');
    const markup = renderToStaticMarkup(React.createElement(ListsRows, {
      rows: [{ list, totalItems: 3, completedCount: 2 }], spaces: [personal, shared], showSource: true,
      onRename: () => undefined, onDelete: () => undefined,
    }));
    assert.match(markup, /旅行采购|共同空间|已完成 2 \/ 3|改名|删除/);
    assert.doesNotMatch(markup, /打开清单|清单详情/);
  } finally { await vite.close(); }
});

test('both List deletion confirmation steps identify List and Space', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ListDeleteDialog } = await vite.ssrLoadModule('/src/components/ListSheets.tsx');
    for (const step of [1, 2]) {
      const markup = renderToStaticMarkup(React.createElement(ListDeleteDialog, {
        list, space: shared, step, busy: false, error: '', onCancel: () => undefined, onConfirm: () => undefined,
      }));
      assert.match(markup, /旅行采购|共同空间/);
      assert.match(markup, step === 1 ? /继续确认/ : /永久删除清单/);
    }
  } finally { await vite.close(); }
});

test('New List keeps disabled Personal selected and requires an active Shared choice', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ListEditorSheet } = await vite.ssrLoadModule('/src/components/ListSheets.tsx');
    const markup = renderToStaticMarkup(React.createElement(ListEditorSheet, {
      mode: 'create', memberSpaces: [personal, shared], eligibleSpaces: [shared], userId: 'me',
      onSubmit: async () => undefined, onCancel: () => undefined,
    }));
    assert.match(markup, /value="personal" selected=""/);
    assert.match(markup, /我的空间未启用清单/);
    assert.match(markup, /value="shared"/);
    assert.match(markup, /type="submit" disabled=""/);
  } finally { await vite.close(); }
});

test('Hub waits for both module checks before showing the final ordered cards', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ModuleHub, ModuleHubContent } = await vite.ssrLoadModule('/src/components/ModuleHub.tsx');
    const noop = () => undefined;
    const props = { loading: false, tasksAvailable: false, tasksError: false, reviewAvailable: false, reviewError: false, listsAvailable: false, listsError: false,
      onOpenTasks: noop, onOpenReview: noop, onOpenLists: noop, onRetryTasks: noop, onRetryReview: noop, onRetryLists: noop };
    const initial = renderToStaticMarkup(React.createElement(ModuleHub, { availability: null, onRefresh: noop, onOpenTasks: noop, onOpenReview: noop, onOpenLists: noop }));
    assert.match(initial, /正在读取功能模块/);
    assert.doesNotMatch(initial, /进入任务|进入回顾|进入清单/);
    const partial = renderToStaticMarkup(React.createElement(ModuleHubContent, { ...props, loading: true, reviewAvailable: true }));
    assert.match(partial, /正在读取功能模块/);
    assert.doesNotMatch(partial, /进入任务|进入回顾|进入清单/);
    const ready = renderToStaticMarkup(React.createElement(ModuleHubContent, { ...props, tasksAvailable: true, reviewAvailable: true, listsAvailable: true }));
    assert.ok(ready.indexOf('进入任务') < ready.indexOf('进入回顾'));
    assert.ok(ready.indexOf('进入回顾') < ready.indexOf('进入清单'));
    assert.doesNotMatch(ready, /正在读取功能模块/);
    const absent = renderToStaticMarkup(React.createElement(ModuleHubContent, props));
    assert.doesNotMatch(absent, /进入任务|进入回顾|进入清单/);
    const tasksOnly = renderToStaticMarkup(React.createElement(ModuleHubContent, { ...props, tasksAvailable: true }));
    assert.match(tasksOnly, /进入任务/);
    assert.doesNotMatch(tasksOnly, /进入回顾|进入清单/);
    const available = renderToStaticMarkup(React.createElement(ModuleHubContent, { ...props, listsAvailable: true }));
    assert.match(available, /进入清单/);
    assert.match(available, /class="mt-4[^\"]*"[^>]*aria-label="进入清单"/);
    const reviewOnly = renderToStaticMarkup(React.createElement(ModuleHubContent, { ...props, reviewAvailable: true }));
    assert.match(reviewOnly, /class="mt-4[^\"]*"[^>]*aria-label="进入回顾"/);
    const failed = renderToStaticMarkup(React.createElement(ModuleHubContent, { ...props, reviewAvailable: true, listsError: true }));
    assert.doesNotMatch(failed, /进入清单/);
    assert.match(failed, /进入回顾/);
    assert.match(failed, /清单模块状态读取失败.*重试/);
    const reviewFailed = renderToStaticMarkup(React.createElement(ModuleHubContent, { ...props, listsAvailable: true, reviewError: true }));
    assert.doesNotMatch(reviewFailed, /进入回顾/);
    assert.match(reviewFailed, /进入清单/);
    assert.match(reviewFailed, /回顾模块状态读取失败.*重试/);
    const tasksFailed = renderToStaticMarkup(React.createElement(ModuleHubContent, { ...props, tasksError: true }));
    assert.doesNotMatch(tasksFailed, /进入任务/);
    assert.match(tasksFailed, /任务模块状态读取失败.*重试/);
  } finally { await vite.close(); }
});

test('Hub focus refresh resolves Review and Lists as one snapshot', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { resolveHubEligibility } = await vite.ssrLoadModule('/src/components/ModuleHub.tsx');
    let finishTasks!: (value: { eligibleSpaces: CurrentSpace[] }) => void;
    let finishReview!: (value: CurrentSpace[]) => void;
    let finishLists!: (value: { eligibleSpaces: CurrentSpace[] }) => void;
    const tasks = new Promise<{ eligibleSpaces: CurrentSpace[] }>((resolve) => { finishTasks = resolve; });
    const review = new Promise<CurrentSpace[]>((resolve) => { finishReview = resolve; });
    const lists = new Promise<{ eligibleSpaces: CurrentSpace[] }>((resolve) => { finishLists = resolve; });
    let published = false;
    const refresh = resolveHubEligibility(() => tasks, () => review, () => lists).then((result: unknown) => { published = true; return result; });
    finishReview([personal]);
    await Promise.resolve();
    assert.equal(published, false);
    finishLists({ eligibleSpaces: [shared] });
    await Promise.resolve();
    assert.equal(published, false);
    finishTasks({ eligibleSpaces: [personal] });
    assert.deepEqual(await refresh, { tasksIds: ['personal'], reviewIds: ['personal'], listsIds: ['shared'] });
    assert.equal(published, true);
    assert.deepEqual(await resolveHubEligibility(
      async () => { throw new Error('offline'); },
      async () => { throw new Error('offline'); },
      async () => ({ eligibleSpaces: [shared] }),
    ), { tasksIds: null, reviewIds: null, listsIds: ['shared'] });
  } finally { await vite.close(); }
});

test('Hub remounts from session availability without loading and retains cards on background error', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ModuleHub } = await vite.ssrLoadModule('/src/components/ModuleHub.tsx');
    const noop = () => undefined;
    const props = { onRefresh: noop, onOpenTasks: noop, onOpenReview: noop, onOpenLists: noop };
    const known = { tasksIds: ['personal'], reviewIds: ['personal'], listsIds: ['shared'], tasksError: false, reviewError: false, listsError: false };
    const render = (availability: typeof known | null) => renderToStaticMarkup(React.createElement(ModuleHub, { ...props, availability }));
    const first = render(known);
    const returned = render(known);
    assert.equal(returned, first);
    assert.match(returned, /进入任务|进入回顾|进入清单/);
    assert.doesNotMatch(returned, /正在读取功能模块/);
    const failed = render({ ...known, listsError: true });
    assert.match(failed, /进入清单|清单模块状态读取失败.*重试/);
    const tasksDisabled = render({ ...known, tasksIds: [] });
    assert.doesNotMatch(tasksDisabled, /进入任务/);
    assert.match(tasksDisabled, /进入回顾|进入清单/);
    const tasksFailed = render({ ...known, tasksError: true });
    assert.match(tasksFailed, /进入任务|任务模块状态读取失败.*重试/);
    const nextAccount = render(null);
    assert.match(nextAccount, /正在读取功能模块/);
    assert.doesNotMatch(nextAccount, /进入任务|进入回顾|进入清单/);
  } finally { await vite.close(); }
});

test('New List Sheet treats eligibility read failure as retryable rather than disabled Personal', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ListEditorSheet } = await vite.ssrLoadModule('/src/components/ListSheets.tsx');
    const markup = renderToStaticMarkup(React.createElement(ListEditorSheet, {
      mode: 'create', memberSpaces: [personal, shared], eligibleSpaces: [], userId: 'me',
      eligibilityStatus: 'error', eligibilityError: '网络暂不可用', onRetryEligibility: () => undefined,
      onSubmit: async () => undefined, onCancel: () => undefined,
    }));
    assert.match(markup, /网络暂不可用|重新读取空间资格/);
    assert.doesNotMatch(markup, /我的空间未启用清单/);
    assert.match(markup, /type="submit" disabled=""/);
  } finally { await vite.close(); }
});
