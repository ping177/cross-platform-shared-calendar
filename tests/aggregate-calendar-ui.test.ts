import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { Session } from '@supabase/supabase-js';
import type { CalendarEvent, CalendarOccurrence, CurrentSpace, SpaceMember } from '../src/types.ts';

const personal = { id: 'personal', kind: 'personal', name: '私人', membershipRole: 'owner' } as CurrentSpace;
const shared = { id: 'shared', kind: 'shared', name: '旅行', membershipRole: 'member' } as CurrentSpace;

function findButton(node: React.ReactNode, label: string): React.ReactElement<{ onClick: () => void }> | null {
  if (!React.isValidElement(node)) return null;
  const element = node as React.ReactElement<{ 'aria-label'?: string; onClick?: () => void; children?: React.ReactNode }>;
  if (element.type === 'button' && element.props['aria-label'] === label) return element as React.ReactElement<{ onClick: () => void }>;
  for (const child of React.Children.toArray(element.props.children)) {
    const found = findButton(child, label);
    if (found) return found;
  }
  return null;
}

test('all Calendar has filters and no create; single Space has create with explicit target', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CurrentSpaceApp, EventSheet } = await vite.ssrLoadModule('/src/App.tsx');
    const noop = () => undefined;
    const common = { session: { user: { id: 'user-a' } } as Session, space: shared, spaces: [personal, shared], allSpaces: [personal, shared], screen: 'calendar', onScreenChange: noop, onHubBack: noop, selectedDate: new Date('2026-09-24'), onSelectedDateChange: noop, viewMode: 'today', onViewModeChange: noop, onSpaceUpdate: noop, onCalendarFilterChange: noop };
    const all = renderToStaticMarkup(React.createElement(CurrentSpaceApp, { ...common, calendarFilter: 'all' }));
    const single = renderToStaticMarkup(React.createElement(CurrentSpaceApp, { ...common, calendarFilter: { spaceId: personal.id } }));
    assert.match(all, /aria-label="筛选日历"[^>]*>.*全部空间/);
    assert.doesNotMatch(all, /筛选：我的空间|筛选：旅行/);
    assert.doesNotMatch(all, /aria-label="新建日程"/);
    assert.match(single, /aria-label="新建日程"/);
    assert.match(single, /aria-label="筛选日历"[^>]*>.*私人/);
    const createSheet = (space: CurrentSpace) => renderToStaticMarkup(React.createElement(EventSheet, { target: null, space, userId: 'user-a', members: [], partnerId: null, onClose: noop, onSaved: noop, validateCreateTarget: async () => true }));
    const personalCreate = createSheet({ ...personal, name: '我的空间' });
    const sharedCreate = createSheet({ ...shared, name: '我们的日历' });
    assert.match(personalCreate, /保存到：我的空间/);
    assert.match(sharedCreate, /保存到：我们的日历/);
    assert.doesNotMatch(personalCreate + sharedCreate, /共享空间 ·|个人空间 ·|Shared Space ·|Personal Space ·/);
  } finally { await vite.close(); }
});

test('Calendar filter selector opens as a bounded sheet and chooses all or one unprefixed Space without changing the Hub selection', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CalendarFilterPicker } = await vite.ssrLoadModule('/src/App.tsx');
    const selectedSpaceId = shared.id;
    let currentFilter: 'all' | { spaceId: string } = 'all';
    let closeCount = 0;
    let openCount = 0;
    const props = {
      spaces: [personal, shared, { ...shared, id: 'family', name: '很长的家庭空间名称用于验证选项换行与布局' }],
      filter: currentFilter,
      open: false,
      onOpen: () => { openCount += 1; },
      onClose: () => { closeCount += 1; },
      onSelect: (filter: 'all' | { spaceId: string }) => { currentFilter = filter; },
    };
    const closed = renderToStaticMarkup(React.createElement(CalendarFilterPicker, props));
    assert.match(closed, /aria-label="筛选日历"/);
    assert.match(closed, /全部空间/);
    assert.doesNotMatch(closed, />空间</);
    assert.doesNotMatch(closed, /role="dialog"|筛选：私人|筛选：旅行/);

    const opened = renderToStaticMarkup(React.createElement(CalendarFilterPicker, { ...props, open: true }));
    assert.match(opened, /role="dialog"/);
    assert.match(opened, /safe-bottom/);
    assert.match(opened, /筛选：全部空间/);
    assert.match(opened, /筛选：私人/);
    assert.match(opened, /筛选：旅行/);
    assert.match(opened, /筛选：很长的家庭空间名称用于验证选项换行与布局/);
    assert.doesNotMatch(opened, /共享空间 · 旅行/);
    assert.match(opened, /truncate/);
    assert.match(opened, /break-all/);

    const click = (filter: 'all' | { spaceId: string }, label: string) => {
      const tree = CalendarFilterPicker({ ...props, filter, open: true });
      const button = findButton(tree, label);
      assert.ok(button, `missing ${label}`);
      button.props.onClick();
    };
    const opener = findButton(CalendarFilterPicker(props), '筛选日历');
    assert.ok(opener);
    opener.props.onClick();
    assert.equal(openCount, 1);
    click('all', '筛选：私人');
    assert.deepEqual(currentFilter, { spaceId: personal.id });
    click(currentFilter, '筛选：旅行');
    assert.deepEqual(currentFilter, { spaceId: shared.id });
    click(currentFilter, '筛选：全部空间');
    assert.equal(currentFilter, 'all');
    assert.equal(closeCount, 3);
    assert.equal(selectedSpaceId, shared.id);
    assert.match(renderToStaticMarkup(React.createElement(CalendarFilterPicker, { ...props, filter: { spaceId: shared.id } })), /aria-label="筛选日历"[^>]*>.*旅行/);
  } finally { await vite.close(); }
});

test('Calendar view selector shows one mode, opens a sheet, and changes view independently of Space', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CalendarViewPicker, CalendarFilterPicker, CurrentSpaceApp, CalendarViews } = await vite.ssrLoadModule('/src/App.tsx');
    const noop = () => undefined;
    const selectedSpaceId = shared.id;
    let filter: 'all' | { spaceId: string } = { spaceId: shared.id };
    let view: 'today' | 'week' | 'month' = 'today';
    let opens = 0;
    let closes = 0;
    const viewProps = { mode: view, open: false, onOpen: () => { opens += 1; }, onClose: () => { closes += 1; }, onSelect: (next: typeof view) => { view = next; } };
    for (const [mode, label] of [['today', '今日'], ['week', '本周'], ['month', '本月']] as const) {
      const closed = renderToStaticMarkup(React.createElement(CalendarViewPicker, { ...viewProps, mode }));
      assert.match(closed, new RegExp(`aria-label="选择日历视图"[^>]*>.*${label}`));
      assert.doesNotMatch(closed, />视图</);
      assert.doesNotMatch(closed, /role="dialog"|aria-label="视图：/);
    }
    const opener = findButton(CalendarViewPicker(viewProps), '选择日历视图');
    assert.ok(opener);
    opener.props.onClick();
    assert.equal(opens, 1);
    const opened = renderToStaticMarkup(React.createElement(CalendarViewPicker, { ...viewProps, open: true }));
    assert.match(opened, /role="dialog"/);
    assert.match(opened, /safe-bottom/);
    for (const label of ['今日', '本周', '本月']) assert.match(opened, new RegExp(`aria-label="视图：${label}"`));
    const choose = (label: string) => {
      const button = findButton(CalendarViewPicker({ ...viewProps, mode: view, open: true }), `视图：${label}`);
      assert.ok(button);
      button.props.onClick();
    };
    choose('本周');
    assert.equal(view, 'week');
    choose('本月');
    assert.equal(view, 'month');
    choose('今日');
    assert.equal(view, 'today');
    assert.equal(closes, 3);
    assert.deepEqual(filter, { spaceId: shared.id });
    const spaceButton = findButton(CalendarFilterPicker({ spaces: [personal, shared], filter, open: true, onOpen: noop, onClose: noop, onSelect: (next: typeof filter) => { filter = next; } }), '筛选：私人');
    assert.ok(spaceButton);
    spaceButton.props.onClick();
    assert.equal(view, 'today');
    assert.equal(selectedSpaceId, shared.id);

    const common = { session: { user: { id: 'user-a' } } as Session, space: shared, spaces: [shared], allSpaces: [personal, shared], calendarFilter: 'all', screen: 'calendar', onScreenChange: noop, onHubBack: noop, selectedDate: new Date('2026-09-24'), onSelectedDateChange: noop, onViewModeChange: noop, onSpaceUpdate: noop, onCalendarFilterChange: noop };
    for (const [mode, label] of [['today', '今日'], ['week', '本周'], ['month', '本月']] as const) {
      const html = renderToStaticMarkup(React.createElement(CurrentSpaceApp, { ...common, viewMode: mode }));
      assert.match(html, new RegExp(`aria-label="选择日历视图"[^>]*>.*${label}`));
      assert.doesNotMatch(html, /grid-cols-3 gap-2 rounded-lg bg-white p-1/);
      assert.match(html, /class="mt-3 grid w-full max-w-sm grid-cols-2 gap-2"/);
      assert.match(html, /aria-label="筛选日历"[^>]*>.*truncate/);
      assert.match(html, /class="flex h-11 w-full min-w-0 items-center gap-2 rounded-lg bg-white/);
    }
    const away = renderToStaticMarkup(React.createElement(CurrentSpaceApp, { ...common, selectedDate: new Date(2000, 0, 1), viewMode: 'month' }));
    const rowStart = away.indexOf('class="mt-3 grid w-full max-w-sm grid-cols-2 gap-2"');
    const spaceSelector = away.indexOf('aria-label="筛选日历"');
    const viewSelector = away.indexOf('aria-label="选择日历视图"');
    const navigationRow = away.indexOf('class="mt-3 flex items-center justify-between"');
    const action = away.indexOf('aria-label="回到本月"');
    const leftArrow = away.indexOf('aria-label="上一段"');
    const rightArrow = away.indexOf('aria-label="下一段"');
    assert.ok(rowStart !== -1 && rowStart < spaceSelector && spaceSelector < viewSelector && viewSelector < navigationRow);
    assert.ok(navigationRow < leftArrow && leftArrow < action && action < rightArrow);
    const calendar = (mode: 'today' | 'week' | 'month') => renderToStaticMarkup(React.createElement(CalendarViews, { expansion: { occurrences: [], errors: [] }, membersBySpaceId: {}, spacesById: {}, showSpaceLabel: false, selectedDate: new Date(2026, 8, 24), viewMode: mode, userId: 'user-a', onEdit: noop, onSelectDate: noop }));
    assert.equal((calendar('today').match(/<h2/g) ?? []).length, 1);
    assert.equal((calendar('week').match(/<h2/g) ?? []).length, 7);
    assert.match(calendar('month'), /grid-cols-7/);
  } finally { await vite.close(); }
});

test('date navigation always shows the current-period action between arrows and returns to today safely', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CalendarDateNavigation } = await vite.ssrLoadModule('/src/App.tsx');
    const today = new Date(2026, 8, 24, 12);
    const selectedSpaceId = shared.id;
    const calendarFilter = { spaceId: personal.id };
    let selected: Date | null = null;
    const props = { selectedDate: today, viewMode: 'today' as const, today, onSelectedDateChange: (date: Date) => { selected = date; } };
    const markup = (viewMode: 'today' | 'week' | 'month', selectedDate: Date) => renderToStaticMarkup(React.createElement(CalendarDateNavigation, { ...props, viewMode, selectedDate }));
    const click = (viewMode: 'today' | 'week' | 'month', selectedDate: Date, label: string) => {
      const button = findButton(CalendarDateNavigation({ ...props, viewMode, selectedDate }), label);
      assert.ok(button, `missing ${label}`);
      button.props.onClick();
      assert.equal(selected?.getTime(), today.getTime());
    };
    const otherDay = new Date(2026, 8, 23, 12);
    const sameWeek = new Date(2026, 8, 27, 12);
    const otherWeek = new Date(2026, 9, 1, 12);
    const otherMonth = new Date(2026, 9, 1);
    for (const [mode, label, current, away] of [
      ['today', '回到今天', today, otherDay],
      ['week', '回到本周', sameWeek, otherWeek],
      ['month', '回到本月', otherDay, otherMonth],
    ] as const) {
      for (const date of [current, away]) {
        const html = markup(mode, date);
        const left = html.indexOf('aria-label="上一段"');
        const action = html.indexOf(`aria-label="${label}"`);
        const right = html.indexOf('aria-label="下一段"');
        assert.ok(left !== -1 && left < action && action < right);
        click(mode, date, label);
      }
    }
    const arrows = renderToStaticMarkup(React.createElement(CalendarDateNavigation, { ...props, viewMode: 'week', selectedDate: otherWeek }));
    assert.match(arrows, /aria-label="上一段"/);
    assert.match(arrows, /aria-label="下一段"/);
    assert.match(arrows, /回到本周/);
    const navigate = (mode: 'today' | 'week' | 'month', date: Date, direction: '上一段' | '下一段') => {
      const button = findButton(CalendarDateNavigation({ ...props, viewMode: mode, selectedDate: date }), direction);
      assert.ok(button);
      selected = null;
      button.props.onClick();
      assert.ok(selected);
      return selected;
    };
    const date = new Date(2026, 8, 24, 12);
    assert.equal(navigate('today', date, '上一段').getTime(), new Date(2026, 8, 23, 12).getTime());
    assert.equal(navigate('today', date, '下一段').getTime(), new Date(2026, 8, 25, 12).getTime());
    assert.equal(navigate('today', navigate('today', date, '上一段'), '上一段').getTime(), new Date(2026, 8, 22, 12).getTime());
    assert.equal(navigate('today', navigate('today', date, '下一段'), '下一段').getTime(), new Date(2026, 8, 26, 12).getTime());
    assert.equal(navigate('week', date, '上一段').getTime(), new Date(2026, 8, 17, 12).getTime());
    assert.equal(navigate('week', date, '下一段').getTime(), new Date(2026, 9, 1, 12).getTime());
    const monthCases = [
      [new Date(2026, 8, 24, 12), '上一段', new Date(2026, 7, 24, 12)],
      [new Date(2026, 8, 24, 12), '下一段', new Date(2026, 9, 24, 12)],
      [new Date(2026, 11, 15, 12), '下一段', new Date(2027, 0, 15, 12)],
      [new Date(2026, 0, 15, 12), '上一段', new Date(2025, 11, 15, 12)],
      [new Date(2026, 0, 31, 12), '下一段', new Date(2026, 1, 28, 12)],
      [new Date(2026, 2, 31, 12), '上一段', new Date(2026, 1, 28, 12)],
      [new Date(2028, 0, 31, 12), '下一段', new Date(2028, 1, 29, 12)],
      [new Date(2027, 0, 31, 12), '下一段', new Date(2027, 1, 28, 12)],
    ] as const;
    for (const [from, direction, expected] of monthCases) {
      assert.equal(navigate('month', from, direction).getTime(), expected.getTime());
    }
    assert.deepEqual(calendarFilter, { spaceId: personal.id });
    assert.equal(selectedSpaceId, shared.id);
  } finally { await vite.close(); }
});

test('aggregate cards retain both same-time Events and resolve each owner from its source Space', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CalendarViews } = await vite.ssrLoadModule('/src/App.tsx');
    const selectedDate = new Date(2026, 8, 24, 10);
    const startsAt = selectedDate.toISOString();
    const source = (id: string, space_id: string, owner_user_id: string) => ({ id, space_id, owner_user_id, scope: 'personal', title: '同名日程', description: null, all_day: false }) as CalendarEvent;
    const occurrence = (id: string, source_event: CalendarEvent): CalendarOccurrence => ({ occurrence_id: `${id}:2026-09-24`, occurrence_date: '2026-09-24', source_event_id: id, occurrence_starts_at: startsAt, occurrence_ends_at: null, title: '同名日程', description: null, all_day: false, source_event });
    const membersBySpaceId: Record<string, SpaceMember[]> = {
      personal: [{ space_id: 'personal', user_id: 'user-a', profiles: { display_name: '甲' } } as SpaceMember],
      shared: [{ space_id: 'shared', user_id: 'user-b', profiles: { display_name: '乙' } } as SpaceMember],
    };
    const markup = renderToStaticMarkup(React.createElement(CalendarViews, {
      expansion: { occurrences: [occurrence('p', source('p', personal.id, 'user-a')), occurrence('s', source('s', shared.id, 'user-b'))], errors: [] },
      membersBySpaceId, spacesById: { personal, shared }, showSpaceLabel: true, selectedDate, viewMode: 'today', userId: 'user-a', onEdit: () => undefined, onSelectDate: () => undefined,
    }));
    assert.equal((markup.match(/同名日程/g) ?? []).length, 2);
    assert.match(markup, /我的空间/);
    assert.match(markup, /共享空间 · 旅行/);
    assert.match(markup, /甲/);
    assert.match(markup, /乙/);
    const failed = renderToStaticMarkup(React.createElement(CalendarViews, {
      expansion: { occurrences: [occurrence('p', source('p', personal.id, 'user-a'))], errors: [{ source_event_id: 's', error: 'projection failed' }] },
      membersBySpaceId, spacesById: { personal, shared }, showSpaceLabel: true, selectedDate, viewMode: 'today', userId: 'user-a', onEdit: () => undefined, onSelectDate: () => undefined,
    }));
    assert.match(failed, /无法完整显示/);
    assert.doesNotMatch(failed, /同名日程/);
  } finally { await vite.close(); }
});
