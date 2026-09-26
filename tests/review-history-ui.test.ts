import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { CurrentSpace } from '../src/types.ts';

const owner = { id: 's', name: '真实名称', kind: 'shared', membershipRole: 'owner' } as CurrentSpace;

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

test('Review list starts without body or create placeholder; Hub starts with Tasks', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ModuleHub } = await vite.ssrLoadModule('/src/components/ModuleHub.tsx');
    const { ReviewHistoryPage } = await vite.ssrLoadModule('/src/components/ReviewHistoryPage.tsx');
    const hub = renderToStaticMarkup(React.createElement(ModuleHub, { userId: 'me', onOpenTasks: () => undefined, onOpenReview: () => undefined }));
    const review = renderToStaticMarkup(React.createElement(ReviewHistoryPage, { userId: 'me', currentSpaceId: null, onSpaceChange: () => undefined, onHubBack: () => undefined }));
    assert.match(hub, /进入任务/);
    assert.doesNotMatch(hub, /进入回顾/);
    assert.match(review, /功能中心/);
    assert.match(review, /正在读取回顾空间/);
    assert.doesNotMatch(review, /下一步计划|近期进展|我已填写/);
  } finally { await vite.close(); }
});
