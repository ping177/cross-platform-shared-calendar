import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { CurrentSpace } from '../src/types.ts';

const owner = { id: 's', name: '真实名称', kind: 'shared', membershipRole: 'owner' } as CurrentSpace;
const historySource = readFileSync(new URL('../src/components/ReviewHistoryPage.tsx', import.meta.url), 'utf8');

test('history keeps server total across pagination and clears it when Space changes', () => {
  assert.match(historySource, /if \(page\.totalCount !== null\) setTotalCount\(page\.totalCount\)/);
  assert.doesNotMatch(historySource, /setTotalCount\([^)]*rows\.length/);
  assert.match(historySource, /setSelectedId\(id\)[\s\S]*setTotalCount\(null\)/);
  assert.match(historySource, /onOpenDetail\(reviewDetailTarget\(created, true\)\)/);
});

test('Space module row follows owner/member controls without changing Tasks', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { SpaceDetailContent } = await vite.ssrLoadModule('/src/components/SpaceManagementPage.tsx');
    const props = { space: owner, members: [], moduleState: 'enabled', moduleError: '', moduleBusy: false, onModuleRetry: () => undefined, onModuleToggle: () => undefined, reviewModuleState: 'disabled', onReviewModuleRetry: () => undefined, onReviewModuleToggle: () => undefined, onSpaceChange: () => undefined };
    const ownerMarkup = renderToStaticMarkup(React.createElement(SpaceDetailContent, props));
    assert.match(ownerMarkup, /aria-label="任务模块" aria-checked="true"/);
    assert.match(ownerMarkup, /aria-label="回顾模块" aria-checked="false"/);
    assert.match(ownerMarkup, /开启回顾模块/);
    const memberMarkup = renderToStaticMarkup(React.createElement(SpaceDetailContent, { ...props, space: { ...owner, membershipRole: 'member' } }));
    assert.doesNotMatch(memberMarkup, /aria-label="回顾模块"/);
    assert.match(memberMarkup, /已关闭/);
  } finally { await vite.close(); }
});

test('Review list starts without body or create placeholder; Hub waits for eligibility', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ModuleHub } = await vite.ssrLoadModule('/src/components/ModuleHub.tsx');
    const { ReviewHistoryPage } = await vite.ssrLoadModule('/src/components/ReviewHistoryPage.tsx');
    const hub = renderToStaticMarkup(React.createElement(ModuleHub, { availability: null, onRefresh: () => undefined, onOpenTasks: () => undefined, onOpenReview: () => undefined, onOpenLists: () => undefined }));
    const review = renderToStaticMarkup(React.createElement(ReviewHistoryPage, { userId: 'me', currentSpaceId: null, onSpaceChange: () => undefined, onOpenDetail: () => undefined, onHubBack: () => undefined }));
    assert.match(hub, /正在读取功能模块/);
    assert.doesNotMatch(hub, /进入任务|进入回顾/);
    assert.match(review, /功能中心/);
    assert.match(review, /正在读取回顾空间/);
    assert.doesNotMatch(review, /下一步计划|近期进展|我已填写/);
  } finally { await vite.close(); }
});

test('warm Review entry selects its Space before canonical history loads', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ReviewHistoryPage } = await vite.ssrLoadModule('/src/components/ReviewHistoryPage.tsx');
    const review = renderToStaticMarkup(React.createElement(ReviewHistoryPage, {
      userId: 'me', entry: { memberSpaces: [owner], eligibleSpaces: [owner] }, currentSpaceId: null,
      onSpaceChange: () => undefined, onOpenDetail: () => undefined, onHubBack: () => undefined,
    }));
    assert.match(review, /真实名称/);
    assert.match(review, /正在读取历史回顾/);
    assert.doesNotMatch(review, /正在读取回顾空间/);
  } finally { await vite.close(); }
});

test('same-Space Review refresh keeps confirmed history mounted', () => {
  assert.match(historySource, /else if \(rereadSameSpace\)[\s\S]*readPage\(space, null, true, true\)/);
  assert.match(historySource, /if \(!background\) setHistoryStatus/);
  assert.match(historySource, /setHistoryStatus\(background \? 'ready' : 'error'\)/);
  assert.match(historySource, /historyStatus === 'ready' \? readPage\(selectedSpace, null, true, true\)/);
  assert.doesNotMatch(historySource, /\brevision\b/);
});

test('historical row opens the canonical review id without newly-created context', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ReviewHistoryRows, ReviewHistorySummary } = await vite.ssrLoadModule('/src/components/ReviewHistoryPage.tsx');
    const round = { id: 'r2', space_id: 's', round_no: 2, review_date: '2026-09-26' };
    const targets: unknown[] = [];
    const tree = ReviewHistoryRows({ rows: [{ round, mine: '已填写', other: '编辑中' }], onOpenDetail: (target: unknown) => targets.push(target) });
    const markup = renderToStaticMarkup(tree);
    assert.match(markup, /打开 2026-09-26 回顾，我：已填写，对方：编辑中/);
    assert.match(markup, /<time[^>]*>2026-09-26<\/time>/);
    assert.match(markup, /第\s*2\s*次/);
    assert.match(markup, /我：已填写/);
    assert.match(markup, /对方：编辑中/);
    assert.match(renderToStaticMarkup(React.createElement(ReviewHistorySummary, { totalCount: 0 })), /共 0 篇回顾/);
    assert.match(renderToStaticMarkup(React.createElement(ReviewHistorySummary, { totalCount: 47 })), /共 47 篇回顾/);
    const button = (tree.props as { children: React.ReactElement[] }).children[0];
    (button.props as { onClick: () => void }).onClick();
    assert.deepEqual(targets, [{ spaceId: 's', reviewId: 'r2', justCreated: false }]);
  } finally { await vite.close(); }
});


test('history preserves supplied canonical order, real round numbers, and personal participants only', async () => {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ReviewHistoryRows } = await vite.ssrLoadModule('/src/components/ReviewHistoryPage.tsx');
    const rows = [{ round: { id: 'new-date', space_id: 's', round_no: 2, review_date: '2026-10-11' }, mine: '编辑中', other: null }, { round: { id: 'older-date', space_id: 's', round_no: 9, review_date: '2026-10-01' }, mine: '有更新', other: null }];
    const html = renderToStaticMarkup(React.createElement(ReviewHistoryRows, { rows, onOpenDetail() {} }));
    assert.ok(html.indexOf('new-date') < html.indexOf('older-date'));
    assert.match(html, /第\s*2\s*次/); assert.match(html, /第\s*9\s*次/);
    assert.match(html, /我：编辑中/); assert.match(html, /我：有更新/);
    assert.doesNotMatch(html, /对方|近期进展|下一步计划|Review/);
  } finally { await vite.close(); }
});


test('Review create control uses the accepted transparent 18px plus and 44px focusable target', async () => {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ReviewHistoryPage } = await vite.ssrLoadModule('/src/components/ReviewHistoryPage.tsx');
    const html = renderToStaticMarkup(React.createElement(ReviewHistoryPage, {
      userId: 'me', entry: { memberSpaces: [owner], eligibleSpaces: [owner] }, currentSpaceId: owner.id,
      onSpaceChange() {}, onOpenDetail() {}, onHubBack() {},
    }));
    const create = html.match(/<button[^>]*aria-label="新建回顾"[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.ok(create);
    assert.match(create, /h-11 w-11/);
    assert.match(create, /bg-transparent/);
    assert.match(create, /text-ui-accent/);
    assert.match(create, /ui-focus/);
    assert.match(create, /width="18" height="18"/);
    assert.match(create, /aria-hidden="true"/);
    assert.doesNotMatch(create, /bg-ui-accent|text-ui-on-accent/);
  } finally { await vite.close(); }
});
