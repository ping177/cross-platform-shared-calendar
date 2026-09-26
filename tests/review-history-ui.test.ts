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
    assert.doesNotMatch(markup, /第\s*2\s*次|round_no/);
    assert.match(markup, /我：已填写/);
    assert.match(markup, /对方：编辑中/);
    assert.match(renderToStaticMarkup(React.createElement(ReviewHistorySummary, { totalCount: 0 })), /共 0 篇回顾/);
    assert.match(renderToStaticMarkup(React.createElement(ReviewHistorySummary, { totalCount: 47 })), /共 47 篇回顾/);
    const button = (tree.props as { children: React.ReactElement[] }).children[0];
    (button.props as { onClick: () => void }).onClick();
    assert.deepEqual(targets, [{ spaceId: 's', reviewId: 'r2', justCreated: false }]);
  } finally { await vite.close(); }
});
