import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { CurrentSpace, ImportantDate } from '../src/types.ts';

export const personal = { id: 'personal', name: '我的空间', kind: 'personal', created_by: 'me', membershipRole: 'owner' } as CurrentSpace;
export const shared = { ...personal, id: 'shared', name: '我们的空间', kind: 'shared', created_by: 'other', membershipRole: 'member' } as CurrentSpace;
export const row = { id: 'date-a', space_id: shared.id, name: '相识', emoji: null, repeat_kind: 'annual', month: 9, day: 30, year: 2020,
  time_zone: 'Asia/Shanghai', reminder_kind: null, created_by: 'other', created_at: '2026-09-30T00:00:00Z', updated_at: '2026-09-30T00:00:00Z', reminder_schedule_changed_at: '2026-09-30T00:00:00Z' } as ImportantDate;

async function core(run: (module: Record<string, any>) => Promise<void> | void) {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try { await run(await vite.ssrLoadModule('/src/lib/important-dates.ts')); } finally { await vite.close(); }
}

test('Important Date filter preselects Personal or exact eligible Space, never a fallback', () => core((m) => {
  assert.equal(m.defaultImportantDateTarget('all', [personal, shared], [shared], 'me'), personal.id);
  assert.equal(m.defaultImportantDateTarget('all', [shared], [shared], 'me'), null);
  assert.equal(m.defaultImportantDateTarget({ spaceId: shared.id }, [personal, shared], [shared], 'me'), shared.id);
  assert.equal(m.defaultImportantDateTarget({ spaceId: 'removed' }, [personal, shared], [shared], 'me'), null);
  assert.equal(m.canSaveImportantDateTarget(personal.id, [shared]), false);
  assert.equal(m.canSaveImportantDateTarget(shared.id, [shared]), true);
  assert.deepEqual(m.normalizeImportantDateFilter({ spaceId: 'gone' }, [shared]), 'all');
}));

test('Important Date draft normalizes name/Emoji and delegates invalid dates to Task 1', () => core((m) => {
  assert.deepEqual(m.normalizeImportantDateDraft({ ...row, name: ' 相识 ', emoji: ' ❤️ ' }), { name: '相识', emoji: '❤️', repeat_kind: 'annual', year: 2020, month: 9, day: 30 });
  for (const bad of [{ name: '' }, { name: 'a\nb' }, { name: 'x'.repeat(201) }, { emoji: 'x'.repeat(33) }, { day: 31 }, { repeat_kind: 'none', year: null }, { year: 2027, month: 2, day: 29 }]) {
    assert.throws(() => m.normalizeImportantDateDraft({ ...row, ...bad }));
  }
  assert.equal(m.normalizeImportantDateDraft({ ...row, emoji: '  ', year: null, month: 2, day: 29 }).emoji, null);
}));

test('Important Date display uses inclusive Day 1, real anniversaries, Feb29 and future anchors', () => core((m) => {
  const show = (patch: Partial<ImportantDate>, year: number, month: number, day: number) => m.importantDatePresentation({ ...row, ...patch }, { year, month, day });
  assert.equal(show({ year: 2026 }, 2026, 9, 30).primary, '第 1 天');
  assert.equal(show({ year: 2025 }, 2026, 9, 30).primary, '1 周年');
  assert.equal(show({ year: null }, 2026, 9, 30).primary, '就是今天');
  assert.equal(show({ year: null, month: 2, day: 29 }, 2027, 2, 28).primary, '就是今天');
  assert.equal(show({ year: 2028, month: 2, day: 29 }, 2029, 2, 28).primary, '1 周年');
  assert.equal(show({ year: 2030 }, 2026, 9, 30).dateLabel, '2030-09-30');
  assert.equal(show({ repeat_kind: 'none', year: 2026 }, 2026, 10, 1).primary, '已过去 1 天');
}));

test('Important Date grouping sorts next occurrence with stable IDs; only past non-repeat enters Past', () => core((m) => {
  const dates = [{ ...row, id: 'b', year: null }, { ...row, id: 'a', year: null }, { ...row, id: 'past', repeat_kind: 'none', year: 2020 }];
  const grouped = m.groupImportantDates(dates, { year: 2026, month: 10, day: 1 }, 'all');
  assert.deepEqual(grouped.current.map((item: any) => item.date.id), ['a', 'b']);
  assert.deepEqual(grouped.past.map((item: any) => item.date.id), ['past']);
  assert.equal(m.groupImportantDates(dates, { year: 2026, month: 10, day: 1 }, { spaceId: personal.id }).current.length, 0);
}));
