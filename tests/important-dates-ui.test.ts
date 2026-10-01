import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { CurrentSpace, ImportantDate } from '../src/types.ts';
const personal = { id: 'personal', name: '我的空间', kind: 'personal', created_by: 'me', membershipRole: 'owner' } as CurrentSpace;
const shared = { ...personal, id: 'shared', name: '共同', kind: 'shared', created_by: 'other', membershipRole: 'member' } as CurrentSpace;
const row = { id: 'date-a', space_id: shared.id, name: '相识', emoji: null, repeat_kind: 'annual', year: 2026, month: 9, day: 30,
  created_by: 'other', time_zone: 'Asia/Shanghai', reminder_kind: null } as ImportantDate;
async function ui(run: (page: Record<string, any>, sheets: Record<string, any>) => Promise<void> | void) {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try { await run(await vite.ssrLoadModule('/src/components/ImportantDatesPage.tsx'), await vite.ssrLoadModule('/src/components/ImportantDateSheet.tsx')); } finally { await vite.close(); }
}
const noop = () => undefined;
test('Important Date create target is explicit and disabled or missing target cannot save', () => ui((_p, m) => {
  const render = (target: string | null, eligible: CurrentSpace[], status = 'ready') => renderToStaticMarkup(React.createElement(m.ImportantDateSheet, {
    userId: 'me', memberSpaces: [personal, shared], eligibleSpaces: eligible, initialTargetId: target, canAct: status === 'ready',
    onSubmit: async () => undefined, onCancel: noop, onDelete: noop,
  }));
  const disabled = render(personal.id, [shared]);
  assert.match(disabled, /value="personal"[^>]*selected=""/);
  assert.match(disabled, /未启用重要日|空间已不可用/);
  assert.match(disabled, /type="submit" disabled=""/);
  assert.match(render(null, [shared]), /请主动选择空间/);
  assert.match(render('removed', [shared]), /当前空间已不可用/);
  assert.match(render(shared.id, [shared], 'error'), /type="submit" disabled=""/);
  assert.doesNotMatch(disabled, /提醒|08:00|20:00|reminder/i);
}));
test('Important Date edit keeps Space immutable and allows Shared non-creator actions', () => ui((_p, m) => {
  const markup = renderToStaticMarkup(React.createElement(m.ImportantDateSheet, { date: row, userId: 'me', memberSpaces: [personal, shared], eligibleSpaces: [shared], canAct: true,
    onSubmit: async () => undefined, onCancel: noop, onDelete: noop }));
  assert.doesNotMatch(markup, /<select[^>]*id="important-date-space"/);
  assert.match(markup, /删除重要日/);
  assert.match(markup, /保存修改/);
  assert.doesNotMatch(markup, /提醒|08:00|20:00|reminder/i);
}));
test('Important Date delete dialog names exact object/Space and requires explicit confirmation', () => ui((_p, m) => {
  const markup = renderToStaticMarkup(React.createElement(m.ImportantDateDeleteDialog, { date: row, space: shared, busy: false, canAct: true, error: '', onCancel: noop, onConfirm: noop }));
  assert.match(markup, /相识/);
  assert.match(markup, /共同/);
  assert.match(markup, /永久删除|无法恢复/);
  assert.match(markup, /取消/);
  assert.match(markup, /role="dialog"/);
}));
test('Important Dates content shows sorted date derivation, source context and collapsed Past, no Reminder UI', () => ui((m) => {
  const markup = renderToStaticMarkup(React.createElement(m.ImportantDatesContent, { data: { memberSpaces: [personal, shared], eligibleSpaces: [shared], dates: [row, { ...row, id: 'past', name: '旅行', repeat_kind: 'none', year: 2025 }] },
    filter: 'all', today: { year: 2026, month: 9, day: 30 }, pastExpanded: false, canAct: true, onOpen: noop, onPastToggle: noop }));
  assert.match(markup, /第 1 天/);
  assert.match(markup, /距 1 周年还有 365 天/);
  assert.match(markup, /共同/);
  assert.match(markup, /过去 · 1/);
  assert.match(markup, /aria-expanded="false"/);
  assert.doesNotMatch(markup, /旅行|提醒|08:00|20:00|reminder/i);
}));

test('Important Date year/month/day layout keeps weighted annual columns in one row with aligned labels and preserves non-repeat', () => ui((_p, m) => {
  for (const repeat_kind of ['annual', 'none'] as const) {
    const markup = renderToStaticMarkup(React.createElement(m.ImportantDateSheet, { date: { ...row, repeat_kind }, memberSpaces: [personal, shared], eligibleSpaces: [shared], canAct: true,
      onSubmit: async () => undefined, onCancel: noop, onDelete: noop }));
    if (repeat_kind === 'annual') {
      assert.ok(markup.includes('grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-3'));
      assert.equal((markup.match(/class="block min-h-10 sm:min-h-5"/g) ?? []).length, 3);
      assert.doesNotMatch(markup, /col-span-2/);
      assert.match(markup, /aria-label="开始年份（可选）"[^>]*value="2026"/);
      for (const name of ['月', '日']) {
        assert.ok(markup.includes(`aria-label="${name}" class="mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-ink/20 px-2 sm:px-3"`));
      }
    } else {
      assert.match(markup, /class="mt-4 grid gap-2 grid-cols-3"/);
      assert.doesNotMatch(markup, /col-span-2|min-h-10|px-2 sm:px-3/);
    }
    for (const name of [repeat_kind === 'annual' ? '开始年份（可选）' : '年份', '月', '日']) {
      assert.ok(markup.includes(`aria-label="${name}" class="mt-2 block min-h-11 w-full min-w-0`));
    }
  }
}));
