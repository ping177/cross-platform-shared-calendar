import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
function rule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(escaped + '\\s*\\{([^}]+)\\}'))?.[1] ?? '';
}
// iOS's UA theme may impose intrinsic minimum width/content-box on native date
// inputs and centers the internal value. Keep the opt-out local to these Sheets and the Review create form.
const dateSelector = '.ui-event-sheet-body input[type="datetime-local"],\n.ui-task-sheet-body input[type="date"],\n.ui-review-create-form input[type="date"]';
test('Sheet dates opt out of iOS theme sizing and retain native input types', () => {
  const declarations = rule(dateSelector);
  assert.match(declarations, /-webkit-appearance:\s*none/);
  assert.match(declarations, /appearance:\s*none/);
  assert.match(declarations, /min-width:\s*0/);
  assert.match(declarations, /box-sizing:\s*border-box/);
  assert.match(declarations, /text-align:\s*left/);
  assert.match(readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'), /type="datetime-local"/);
  assert.match(readFileSync(new URL('../src/components/TaskSheet.tsx', import.meta.url), 'utf8'), /type="date"/);
  assert.match(readFileSync(new URL('../src/components/ReviewHistoryPage.tsx', import.meta.url), 'utf8'), /id="review-date"[^>]*type="date"/);
});
test('iOS internal date value is left aligned only in Event, Task and Review create forms', () => {
  assert.match(rule('.ui-event-sheet-body input[type="datetime-local"]::-webkit-date-and-time-value,\n.ui-task-sheet-body input[type="date"]::-webkit-date-and-time-value,\n.ui-review-create-form input[type="date"]::-webkit-date-and-time-value'), /text-align:\s*left/);
  assert.doesNotMatch(css, /(?:^|\n)input(?:::[\w-]+)?\s*\{[^}]*text-align:\s*left/);
});
test('Event body stays vertically scrollable with a stable horizontal boundary', () => {
  const body = rule('.ui-event-sheet-body');
  assert.match(body, /overflow-y:\s*auto/);
  assert.match(body, /overflow-x:\s*hidden/);
  assert.match(body, /min-width:\s*0/);
  assert.match(body, /overscroll-behavior:\s*contain/);
  assert.match(body, /env\(safe-area-inset-bottom/);
});

test('Review create form stays inside the viewport and scrolls long content locally', () => {
  const form = rule('.ui-review-create-form');
  assert.match(form, /max-height:\s*calc\(100dvh - 2rem\)/);
  assert.match(form, /min-width:\s*0/);
  assert.match(form, /min-height:\s*0/);
  assert.match(form, /overflow-x:\s*hidden/);
  assert.match(form, /overflow-y:\s*auto/);
  assert.match(form, /overscroll-behavior:\s*contain/);
  assert.match(form, /overflow-wrap:\s*anywhere/);
  const source = readFileSync(new URL('../src/components/ReviewHistoryPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /<form className="ui-review-create-form [^"]*ui-safe-bottom" onSubmit=/);
});


test('Review date correction has its own constrained native date and scrolling dialog', () => {
  const source = readFileSync(new URL('../src/components/ReviewDetailPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /<form className="ui-review-date-form /);
  for (const selector of ['.ui-review-date-form input[type="date"]', '.ui-review-date-form input[type="date"]::-webkit-date-and-time-value']) {
    assert.match(rule(selector), /text-align:\s*left/);
  }
  const form = rule('.ui-review-date-form');
  assert.match(form, /min-width:\s*0/);
  assert.match(form, /max-height:\s*calc\(100dvh - 2rem\)/);
  assert.match(form, /overflow-x:\s*hidden/);
  assert.match(form, /overflow-y:\s*auto/);
});
