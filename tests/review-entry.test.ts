import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveReviewEntryStatus, hasReviewEntryContent, isReviewEntryDirty, reviewEntryDraft, reviewEntryErrorMessage } from '../src/lib/review-entry.ts';
import type { ReviewEntry } from '../src/types.ts';

const blankEntry: ReviewEntry = {
  review_id: 'review-1', user_id: 'user-1',
  focus: null, progress: null, problems: null, next_plan: null,
  content_revision: 0, filled_revision: null, updated_at: '2026-09-26T00:00:00Z',
};

test('canonical status follows persisted content and revisions', () => {
  assert.equal(deriveReviewEntryStatus(blankEntry), '未填写');
  assert.equal(deriveReviewEntryStatus({ ...blankEntry, focus: '目标', content_revision: 1 }), '编辑中');
  assert.equal(deriveReviewEntryStatus({ ...blankEntry, focus: '目标', content_revision: 1, filled_revision: 1 }), '已填写');
  assert.equal(deriveReviewEntryStatus({ ...blankEntry, focus: '新目标', content_revision: 2, filled_revision: 1 }), '有更新');
  assert.equal(deriveReviewEntryStatus({ ...blankEntry, focus: '', content_revision: 2, filled_revision: 1 }), '未填写');
});

test('blank detection accepts any non-whitespace field', () => {
  assert.equal(hasReviewEntryContent({ focus: '', progress: ' \t\n', problems: null, next_plan: '' }), false);
  assert.equal(hasReviewEntryContent({ focus: '\u00a0', progress: '\u3000', problems: null, next_plan: '' }), false);
  assert.equal(hasReviewEntryContent({ focus: '  ', progress: null, problems: '问题', next_plan: '' }), true);
  assert.equal(hasReviewEntryContent({ focus: null, progress: '', problems: '', next_plan: '  下步  ' }), true);
});

test('dirty comparison treats null as an empty visible field and clears on revert', () => {
  const original = reviewEntryDraft(blankEntry);
  assert.deepEqual(original, { focus: '', progress: '', problems: '', next_plan: '' });
  assert.equal(isReviewEntryDirty(blankEntry, original), false);
  assert.equal(isReviewEntryDirty(blankEntry, { ...original, progress: '有进展' }), true);
  assert.equal(isReviewEntryDirty(blankEntry, { ...original, progress: '' }), false);
  assert.equal(isReviewEntryDirty({ ...blankEntry, focus: '原内容' }, { ...original, focus: '' }), true);
});

test('known backend rejections have clear copy without treating them as success', () => {
  assert.match(reviewEntryErrorMessage({ message: 'Review module is disabled' }, 'save'), /回顾模块已关闭/);
  assert.match(reviewEntryErrorMessage({ message: 'Current review participant membership is required' }, 'mark'), /成员身份/);
  assert.match(reviewEntryErrorMessage({ message: 'Blank review entry cannot be marked filled' }, 'mark'), /至少一项/);
  assert.match(reviewEntryErrorMessage(new Error('network down'), 'save'), /未保存的内容仍保留/);
});
