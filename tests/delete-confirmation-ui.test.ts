import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const review = readFileSync(new URL('../src/components/ReviewDetailPage.tsx', import.meta.url), 'utf8');
const list = readFileSync(new URL('../src/components/ListDetailPage.tsx', import.meta.url), 'utf8');

test('Review deletion opens an App dialog before the guarded RPC; error retains it', () => {
  const remove = review.slice(review.indexOf('async function removeReview'), review.indexOf('return <main', review.indexOf('async function removeReview')));
  assert.doesNotMatch(remove, /window\.confirm/);
  assert.match(remove, /!deleteOpen/);
  assert.match(review, /aria-labelledby="review-delete-title"/);
  assert.match(review, /本次双方填写的全部内容将永久删除/);
  assert.match(review, /useListModalKeyboard\(deleteOpen, deleteBusy/);
  assert.match(review, /setDeleteOpen\(true\)/);
  assert.match(remove, /deleting\.current = true;[\s\S]*await deleteReviewRound/);
  assert.doesNotMatch(remove.slice(remove.indexOf('catch')), /setDeleteOpen\(false\)/);
});

test('List Item deletion requires separate confirmation and uses the existing mutation path', () => {
  assert.match(list, /aria-labelledby="item-delete-title"/);
  assert.match(list, /onDeleteItem=\{\(item\) => \{[^}]*setItemDeleteId\(item\.id\)/);
  assert.match(list, /function confirmItemDelete/);
  assert.match(list, /deleteListItem\(supabase, target\.listId, itemToDelete\.id\)/);
});

test('empty List groups no longer delete immediately; nonempty groups retain both scopes', () => {
  const request = list.slice(list.indexOf('function requestSectionDelete'), list.indexOf('function confirmSectionDelete'));
  assert.doesNotMatch(request, /confirmSectionDelete\(/);
  assert.match(request, /setSectionDeleteId\(section\.id\)/);
  assert.match(list, /仅删除分组/);
  assert.match(list, /删除分组及其中内容/);
});

test('discarding recovered List inputs uses an explicit App confirmation', () => {
  assert.doesNotMatch(list, /window\.confirm\('清除提示后/);
  assert.match(list, /aria-labelledby="recovered-clear-title"/);
  assert.match(list, /setClearRecoveredOpen\(true\)/);
});

test('invite rotation requires an App confirmation while preserving original RPC and lock', () => {
  const source = readFileSync(new URL('../src/components/InvitePanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /aria-labelledby="invite-rotate-title"/);
  assert.match(source, /旧邀请码将立即失效/);
  assert.match(source, /if \(!confirmOpen \|\| rotating\.current\) return/);
  assert.match(source, /supabase\.rpc\('rotate_invite_code', \{ space_id: space\.id \}\)/);
});
