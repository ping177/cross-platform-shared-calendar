import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { ReviewEntry, ReviewRound } from '../src/types.ts';

const round = { id: 'r2', space_id: 's', round_no: 2, review_date: '2026-09-26', created_by: 'me', created_at: '2026-09-26T00:00:00Z' } as ReviewRound;
const own = { review_id: 'r2', user_id: 'me', focus: null, progress: null, problems: null, next_plan: null, content_revision: 0, filled_revision: null, updated_at: '2026-09-26T00:00:00Z' } as ReviewEntry;
const other = { ...own, user_id: 'former-member', focus: '长期目标\n第二行', content_revision: 1 };
const detailSource = readFileSync(new URL('../src/components/ReviewDetailPage.tsx', import.meta.url), 'utf8');

test('detail uses date as the visible identity and calls previous context 上一份计划', () => {
  assert.match(detailSource, /上一份计划/);
  assert.match(detailSource, /上一份计划暂无内容/);
  assert.doesNotMatch(detailSource, /第 \{detail\.round\.round_no\} 次回顾|上一次下一步计划|上一次暂无计划/);
});

test('successful date correction refreshes the date-driven previous plan', () => {
  assert.match(detailSource, /const changed = await correctReviewDate[\s\S]*setDetail\(updated\);[\s\S]*void refreshPrevious\(changed\);/);
});

test('only canonical unavailability closes restored detail; transient auth reads remain retryable', () => {
  assert.match(detailSource, /if \(loadError instanceof ReviewUnavailableError\) \{[\s\S]*?setPhase\('unavailable'\)/);
  assert.doesNotMatch(detailSource, /\/登录状态已变化\/u\.test\(/);
  assert.match(detailSource, /setPhase\('error'\)/);
});

test('Shared keeps both panels mounted with mobile switching and desktop own-left layout', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ReviewDetailPanels } = await vite.ssrLoadModule('/src/components/ReviewDetailPage.tsx');
    const props = { detail: { round, own, other }, userId: 'me', onMobilePanelChange: () => undefined, onDirtyChange: () => undefined };
    const mine = renderToStaticMarkup(React.createElement(ReviewDetailPanels, { ...props, mobilePanel: 'mine' }));
    const partner = renderToStaticMarkup(React.createElement(ReviewDetailPanels, { ...props, mobilePanel: 'other' }));
    assert.match(mine, /role="tablist"/);
    assert.match(mine, /aria-selected="true" aria-controls="review-mine-panel"/);
    assert.match(mine, /md:grid-cols-2/);
    assert.match(mine, /class="min-w-0 hidden md:block" id="review-other-panel"/);
    assert.match(partner, /class="min-w-0 hidden md:block" id="review-mine-panel"/);
    assert.match(partner, /正在读取回顾内容/);
    assert.match(partner, /长期目标/);
  } finally { await vite.close(); }
});

test('Personal has only its editor; counterpart is fixed-height read-only with no actions', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ReviewDetailPanels } = await vite.ssrLoadModule('/src/components/ReviewDetailPage.tsx');
    const { ReviewReadOnlyEntry } = await vite.ssrLoadModule('/src/components/ReviewReadOnlyEntry.tsx');
    const personal = renderToStaticMarkup(React.createElement(ReviewDetailPanels, { detail: { round, own, other: null }, userId: 'me', mobilePanel: 'mine', onMobilePanelChange: () => undefined, onDirtyChange: () => undefined }));
    assert.doesNotMatch(personal, /tablist|review-other-panel|md:grid-cols-2|对方/);
    assert.match(personal, /正在读取回顾内容/);
    const counterpart = renderToStaticMarkup(React.createElement(ReviewReadOnlyEntry, { entry: other }));
    assert.equal((counterpart.match(/role="textbox"/g) ?? []).length, 4);
    assert.equal((counterpart.match(/overflow-y-auto/g) ?? []).length, 4);
    assert.equal((counterpart.match(/h-36/g) ?? []).length, 3);
    assert.equal((counterpart.match(/h-24/g) ?? []).length, 1);
    assert.match(counterpart, /whitespace-pre-wrap/);
    assert.doesNotMatch(counterpart, /<button|<textarea|我已填写/);
  } finally { await vite.close(); }
});
