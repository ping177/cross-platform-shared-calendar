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

// Capture handlers while React supplies the dispatcher for the Picker's local focus hooks.

test('all Calendar and single Space each expose one unified create entry with explicit target', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CurrentSpaceApp, EventSheet } = await vite.ssrLoadModule('/src/App.tsx');
    const noop = () => undefined;
    const common = { session: { user: { id: 'user-a' } } as Session, space: shared, spaces: [personal, shared], allSpaces: [personal, shared], screen: 'calendar', onScreenChange: noop, onHubBack: noop, selectedDate: new Date('2026-09-24'), onSelectedDateChange: noop, viewMode: 'today', onViewModeChange: noop, onSpaceUpdate: noop, onCalendarFilterChange: noop };
    const all = renderToStaticMarkup(React.createElement(CurrentSpaceApp, { ...common, calendarFilter: 'all' }));
    const single = renderToStaticMarkup(React.createElement(CurrentSpaceApp, { ...common, calendarFilter: { spaceId: personal.id } }));
    assert.match(all, /aria-label="筛选日历"[^>]*>.*全部空间/);
    assert.doesNotMatch(all, /筛选：我的空间|筛选：旅行/);
    assert.equal((all.match(/aria-label="新建日程"/g) ?? []).length, 1);
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

test('Calendar filter adapter preserves independent Space IDs and uses the shared nonmodal dropdown', async () => {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CalendarFilterPicker } = await vite.ssrLoadModule('/src/App.tsx');
    const selectedSpaceId = shared.id;
    let filter: 'all' | { spaceId: string } = 'all';
    let opened = false;
    const props = { spaces: [personal, shared], filter, open: false, onOpen() { opened = true; }, onClose() { opened = false; }, onSelect(next: typeof filter) { filter = next; } };
    const html = renderToStaticMarkup(React.createElement(CalendarFilterPicker, props));
    assert.match(html, /aria-label="筛选日历".*aria-haspopup="listbox"/);
    assert.match(html, /全部空间/); assert.doesNotMatch(html, /<select|role="dialog"/);
    const adapter = CalendarFilterPicker(props).props;
    adapter.onOpenChange(true); assert.equal(opened, true);
    adapter.onChange(personal.id); assert.deepEqual(filter, { spaceId: personal.id });
    adapter.onChange(shared.id); assert.deepEqual(filter, { spaceId: shared.id });
    adapter.onChange('all'); assert.equal(filter, 'all');
    adapter.onOpenChange(false); assert.equal(opened, false); assert.equal(selectedSpaceId, shared.id);
    assert.match(renderToStaticMarkup(React.createElement(CalendarFilterPicker, { ...props, filter: { spaceId: shared.id } })), />旅行<\/button>/);
  } finally { await vite.close(); }
});

test('Calendar segmented views select all three modes without a modal and keep date and Space context independent', async () => {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CalendarViewPicker, CalendarFilterPicker, CurrentSpaceApp } = await vite.ssrLoadModule('/src/App.tsx');
    const noop = () => undefined, selectedDate = new Date(2026, 8, 24);
    let filter: 'all' | { spaceId: string } = { spaceId: shared.id };
    let view: 'today' | 'week' | 'month' = 'today'; let closes = 0;
    const props = { open: false, onOpen: () => assert.fail('segmented views must not open a modal'), onClose: () => closes++, onSelect: (next: typeof view) => { view = next; } };
    for (const [mode, label] of [['today', '今日'], ['week', '本周'], ['month', '本月']] as const) {
      const tree = CalendarViewPicker({ ...props, mode: view });
      const html = renderToStaticMarkup(React.createElement(CalendarViewPicker, { ...props, mode }));
      assert.match(html, /role="group" aria-label="选择日历视图"/);
      assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
      assert.equal((html.match(/<button/g) ?? []).length, 3);
      assert.doesNotMatch(html, /role="dialog"|aria-haspopup/);
      const button = findButton(tree, `视图：${label}`); assert.ok(button); button.props.onClick();
      assert.equal(view, mode); assert.deepEqual(filter, { spaceId: shared.id });
    }
    assert.equal(closes, 3);
    CalendarFilterPicker({ spaces: [personal, shared], filter, open: false, onOpen: noop, onClose: noop, onSelect: (next: typeof filter) => { filter = next; } }).props.onChange(personal.id);
    assert.equal(view, 'month'); assert.deepEqual(filter, { spaceId: personal.id });
    assert.equal(selectedDate.getTime(), new Date(2026, 8, 24).getTime());
    for (const mode of ['today', 'week', 'month']) {
      const html = renderToStaticMarkup(React.createElement(CurrentSpaceApp, { session: { user: { id: 'user-a' } }, spaces: [shared], allSpaces: [personal, shared], calendarFilter: 'all', selectedDate, viewMode: mode, onSelectedDateChange: noop, onViewModeChange: noop, onCalendarFilterChange: noop }));
      const filterIndex = html.indexOf('aria-label="筛选日历"'), viewIndex = html.indexOf('aria-label="选择日历视图"');
      const previous = html.indexOf('aria-label="上一段"'), current = html.indexOf(`aria-label="回到${mode === 'today' ? '今天' : mode === 'week' ? '本周' : '本月'}"`), next = html.indexOf('aria-label="下一段"');
      assert.ok(filterIndex >= 0 && filterIndex < viewIndex && viewIndex < previous && previous < current && current < next);
    }
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


test('v2 day/week retain exact event and Important Date click identities, all-day, cross-day, owner labels and sorted contents', async () => {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CalendarViews } = await vite.ssrLoadModule('/src/App.tsx');
    const selectedDate = new Date(2026, 9, 9, 12);
    const make = (id: string, start: Date, end: Date | null, all_day = false, scope = 'personal') => ({ occurrence_id: id, source_event_id: id, occurrence_date: '2026-10-09', occurrence_starts_at: start.toISOString(), occurrence_ends_at: end?.toISOString() ?? null, all_day, title: id === 'long' ? '很长的标题_ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(8) : id, description: '保留原描述', source_event: { id, space_id: scope === 'shared' ? shared.id : personal.id, scope, owner_user_id: scope === 'shared' ? null : 'user-a', recurrence_rule: id === 'repeat' ? { frequency: 'daily' } : null } });
    const events = [make('long', new Date(2026,9,9,19), null), make('repeat',new Date(2026,9,9,9),new Date(2026,9,9,10),false,'shared'), make('all-day',new Date(2026,9,9),null,true),make('cross-day',new Date(2026,9,8,23),new Date(2026,9,10,1))];
    const important = { importantDateId: 'date', spaceId: shared.id, occurrenceDate: { year: 2026, month: 10, day: 9 }, name: '纪念日', emoji: '❤️' };
    const clicks: any[] = [];
    const common = { expansion: { occurrences: events, errors: [] }, importantDates: [important], membersBySpaceId: { personal: [{ user_id: 'user-a', profiles: { display_name: '本人姓名' } }] }, spacesById: { personal, shared }, showSpaceLabel: true, selectedDate, userId: 'user-a', onEdit: (item: any) => clicks.push(item), onOpenImportantDate: (item: any) => clicks.push(item), onSelectDate: () => undefined };
    const expand = (node: any): any[] => {
      if (!React.isValidElement(node)) return [];
      const el: any = node;
      if (['DaySection', 'EventCard', 'CalendarImportantDateCard'].includes(el.type?.name)) return expand(el.type(el.props));
      return [el, ...React.Children.toArray(el.props.children).flatMap(expand)];
    };
    const tree = CalendarViews({ ...common, viewMode: 'today' });
    const buttons = expand(tree).filter(el => el.props['data-calendar-event-id']);
    assert.deepEqual(buttons.map(el => el.props['data-calendar-event-id']), ['cross-day','all-day','repeat','long']);
    for (const button of buttons) { button.props.onClick(); assert.equal(clicks.at(-1), events.find(e => e.occurrence_id === button.props['data-calendar-event-id'])); }
    const dateButton = expand(tree).find(el => el.type === 'button' && el.props['data-important-date-id']); dateButton.props.onClick(); assert.equal(clicks.at(-1), important);
    const html = renderToStaticMarkup(React.createElement(CalendarViews, { ...common, viewMode: 'today' }));
    for (const content of ['全天','跨日期','本人姓名','保留原描述','纪念日','我的空间','共享空间 · 旅行']) assert.ok(html.includes(content), content);
    assert.doesNotMatch(html, /lucide-chevron-right/);
    const week = renderToStaticMarkup(React.createElement(CalendarViews, { ...common, viewMode: 'week' }));
    assert.equal((week.match(/data-calendar-day=/g) ?? []).length, 7); assert.doesNotMatch(week, /grid-cols-7/);
    assert.doesNotMatch(week, /lucide-chevron-right/);
    assert.equal((week.match(/class="ui-week-date/g) ?? []).length, 7);
    assert.equal((week.match(/class="ui-week-content min-w-0"/g) ?? []).length, 7);
    assert.match(week, /ui-week-sunday/);
    const weekButtons = expand(CalendarViews({ ...common, viewMode: 'week' })).filter(el => el.props['data-calendar-event-id']);
    for (const button of weekButtons) { button.props.onClick(); assert.equal(clicks.at(-1), events.find(e => e.occurrence_id === button.props['data-calendar-event-id'])); }
    assert.doesNotMatch(week, /农历|初一|初二/);
    const month = renderToStaticMarkup(React.createElement(CalendarViews, { ...common, viewMode: 'month' }));
    assert.match(month, /grid-cols-7/); assert.match(month, /data-month-item/); assert.doesNotMatch(month, /border-l-4|role="dialog"/); assert.doesNotMatch(month, /data-calendar-event-id|ui-calendar-timeline|ui-calendar-week/);
  } finally { await vite.close(); }
});

test('v2 empty week keeps Monday through Sunday compact groups and never calls unknown Important Dates empty', async () => {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CalendarViews } = await vite.ssrLoadModule('/src/App.tsx');
    const props = { expansion: { occurrences: [], errors: [] }, membersBySpaceId: {}, spacesById: {}, showSpaceLabel: false, selectedDate: new Date(2026,9,9), userId: 'user-a', onEdit() {}, onSelectDate() {} };
    const html = (mode: string, complete = true) => renderToStaticMarkup(React.createElement(CalendarViews, { ...props, viewMode: mode, importantDatesComplete: complete }));
    assert.equal((html('week').match(/暂无日程/g) ?? []).length, 7);
    assert.match(html('week'), /10月5日周一/); assert.match(html('week'), /10月11日周日/);
    assert.equal((html('today').match(/暂无日程/g) ?? []).length, 1);
    assert.doesNotMatch(html('week',false), /暂无日程/); assert.equal((html('week',false).match(/重要日尚未完整确认/g) ?? []).length,7);
  } finally { await vite.close(); }
});

test('Space markers avoid six-color collisions and stay consistent across day/week, order and filtered content', async () => {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { calendarSpaceDotClasses, CalendarViews } = await vite.ssrLoadModule('/src/App.tsx');
    const ids = ['space-a','space-g','space-m','space-s','space-y','space-aa'];
    const mapping = calendarSpaceDotClasses(ids);
    assert.equal(new Set(Object.values(mapping)).size, 6);
    assert.deepEqual(calendarSpaceDotClasses([...ids].reverse()), mapping);
    assert.deepEqual(calendarSpaceDotClasses([...ids, ids[0]]), mapping);
    assert.deepEqual(calendarSpaceDotClasses([]), {});
    const over = calendarSpaceDotClasses([...ids,'space-extra']);
    assert.equal(Object.keys(over).length, 7);
    assert.equal(new Set(Object.values(over)).size, 6);
    const spacesById = Object.fromEntries(ids.map((id, index) => [id, { ...shared, id, name: `空间${index + 1}` }]));
    const events = ids.map((id, index) => ({ occurrence_id: `event-${index}`, source_event_id: `event-${index}`, occurrence_date: '2026-10-09', title: `事项${index + 1}`, all_day: false, occurrence_starts_at: new Date(2026,9,9,9 + index).toISOString(), occurrence_ends_at: null, source_event: { id: `event-${index}`, space_id: id, scope: 'shared', owner_user_id: null } }));
    const props = { expansion: { occurrences: events, errors: [] }, importantDates: [{ importantDateId: 'date', spaceId: ids[0], occurrenceDate: { year: 2026, month: 10, day: 9 }, name: '纪念日', emoji: null }], membersBySpaceId: {}, spacesById, showSpaceLabel: true, selectedDate: new Date(2026,9,9), userId: 'user-a', onEdit() {}, onOpenImportantDate() {}, onSelectDate() {} };
    const html = (mode: string, occurrences = events) => renderToStaticMarkup(React.createElement(CalendarViews, { ...props, viewMode: mode, expansion: { occurrences, errors: [] } }));
    const markers = (markup: string) => Array.from(markup.matchAll(/class="ui-calendar-time[^"]*?(ui-calendar-space-[a-z]+)/g), match => match[1]);
    const day = html('today');
    assert.deepEqual(markers(day), ids.map(id => mapping[id]));
    assert.deepEqual(markers(html('week')), markers(day));
    assert.deepEqual(markers(html('today', [events[3]])), [mapping[ids[3]]]);
    assert.ok(day.includes(`ui-calendar-important-date mb-ui-2 ${mapping[ids[0]]}`));
    ids.forEach((_, index) => assert.ok(day.includes(`空间${index + 1}`)));
    assert.doesNotMatch(day, /bg-ui-accent-soft|bg-ui-auxiliary-soft/);
  } finally { await vite.close(); }
});


test('month grid shows two real titles and an exact remainder across four, five and six weeks', async () => {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false } });
  try {
    const { CalendarViews } = await vite.ssrLoadModule('/src/App.tsx');
    const day = new Date(2026, 9, 9);
    const events = Array.from({ length: 4 }, (_, index) => ({ occurrence_id: `occ-${index}`, title: `真实事项${index}`, all_day: index === 0,
      occurrence_starts_at: new Date(2026, 9, 9, index + 8).toISOString(), occurrence_ends_at: null, source_event: { id: `source-${index}`, space_id: shared.id } }));
    const important = { importantDateId: 'important', spaceId: personal.id, occurrenceDate: { year: 2026, month: 10, day: 9 }, name: '真实重要日', emoji: null };
    const props = { expansion: { occurrences: events, errors: [] }, importantDates: [important], membersBySpaceId: {}, spacesById: { personal, shared }, showSpaceLabel: true,
      selectedDate: day, viewMode: 'month', userId: 'me', onEdit() {}, onSelectDate() {} };
    for (const count of [0, 1, 2, 4]) {
      const html = renderToStaticMarkup(React.createElement(CalendarViews, { ...props, expansion: { occurrences: events.slice(0, count), errors: [] }, importantDates: [] }));
      assert.equal((html.match(/data-month-item=/g) ?? []).length, Math.min(count, 2));
      if (count > 2) assert.match(html, /还有 2 项事项[^>]*>\+2</); else assert.doesNotMatch(html, /data-month-more/);
      assert.doesNotMatch(html, /role="dialog"|border-l-4/);
    }
    const mixed = renderToStaticMarkup(React.createElement(CalendarViews, props));
    assert.match(mixed, /真实重要日/); assert.match(mixed, /还有 3 项事项[^>]*>\+3</);
    assert.match(mixed, /ui-calendar-space-/);
    for (const [date, expected] of [[new Date(2021, 1, 10), 28], [day, 35], [new Date(2026, 2, 10), 42], [new Date(2028, 1, 10), 35], [new Date(2026, 11, 31), 35]] as const) {
      const html = renderToStaticMarkup(React.createElement(CalendarViews, { ...props, selectedDate: date, expansion: { occurrences: [], errors: [] }, importantDates: [] }));
      assert.equal((html.match(/data-month-date=/g) ?? []).length, expected);
    }
    const sixIds = ['aa','bb','cc','dd','ee','ff'];
    const palette = (await vite.ssrLoadModule('/src/App.tsx')).calendarSpaceDotClasses(sixIds);
    const colored = renderToStaticMarkup(React.createElement(CalendarViews, { ...props, importantDates: [],
      spacesById: Object.fromEntries(sixIds.map(id => [id, { ...shared, id }])),
      expansion: { errors: [], occurrences: sixIds.map((id, index) => ({ ...events[0], occurrence_id: id,
        occurrence_starts_at: new Date(2026,9,9+index,9).toISOString(), source_event: { ...events[0].source_event, space_id: id } })) } }));
    const dots = Array.from(colored.matchAll(/data-month-item="([^"]+)"[^>]*>.*?ui-month-dot (ui-calendar-space-[a-z]+)/g), match => [match[1], match[2]]);
    assert.deepEqual(Object.fromEntries(dots), palette);
    const html = renderToStaticMarkup(React.createElement(CalendarViews, { ...props, selectedDate: new Date(2026, 11, 31) }));
    assert.match(html, /data-month-date="2027-01-03"/);
  } finally { await vite.close(); }
});


test('calendar patch uses one stable header and real cross-year week subtitles', async () => {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CurrentSpaceApp } = await vite.ssrLoadModule('/src/App.tsx');
    const noop = () => undefined;
    const render = (mode: string, date: Date) => renderToStaticMarkup(React.createElement(CurrentSpaceApp, { session: { user: { id: 'user-a' } }, spaces: [shared], allSpaces: [personal, shared], calendarFilter: 'all', selectedDate: date, viewMode: mode, onSelectedDateChange: noop, onViewModeChange: noop, onCalendarFilterChange: noop }));
    const day = render('today', new Date(2026, 9, 13));
    const week = render('week', new Date(2026, 9, 13));
    const month = render('month', new Date(2026, 9, 13));
    for (const html of [day, week, month]) {
      assert.match(html, /<h1 class="text-ui-page-title">日历<\/h1>/);
      assert.match(html, /ui-calendar-subtitle/);
      assert.ok(html.indexOf('ui-calendar-subtitle') < html.indexOf('ui-calendar-controls'));
    }
    assert.match(day, /2026年10月13日周二/);
    assert.match(week, /2026年10月12日 — 10月18日/);
    assert.match(month, /2026年10月/);
    assert.match(render('week', new Date(2026, 9, 31)), /2026年10月26日 — 11月1日/);
    const subtitle = week.match(/ui-calendar-subtitle[^>]*>([^<]+)/)?.[1];
    assert.equal(subtitle, '2026年10月12日 — 10月18日');
    assert.match(render('week', new Date(2026, 11, 31)), /2026年12月28日 — 2027年1月3日/);
  } finally { await vite.close(); }
});
