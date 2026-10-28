// Real React lifecycle, Calendar hook, complete reader and members adapter;
// only Supabase I/O is replaced with in-memory rows. No login or network.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useCalendarEvents } from '../../src/components/useCalendarEvents';
import '../../src/styles.css';

const spaces = [{ id: 'personal', kind: 'personal', name: '个人', membershipRole: 'owner' },
  { id: 'shared', kind: 'shared', name: '共享', membershipRole: 'member' }];
const event = (id, space_id, title) => ({ id, space_id, title, scope: 'shared', owner_user_id: null,
  starts_at: new Date(2026, 9, 10, 12).toISOString(), ends_at: null, all_day: false, recurrence_rule: null });
const fixture = window.calendarFixture = {
  channels: [], auth: new Set(), requests: [], pending: [], validated: [], invalidations: 0,
  hold: false, fail: false, memberId: 'me',
  rows: [event('personal-event', 'personal', '个人日程'), event('shared-event', 'shared', '共享日程')],
  exceptions: [],
  async read(table, filters, start, end) {
    this.requests.push({ table, filters, start, end });
    let rows;
    if (table === 'space_members') rows = [{ space_id: filters.space_id, user_id: this.memberId, role: 'owner', joined_at: '2026-01-01', profiles: { display_name: '测试成员' } }];
    else if (table === 'events') rows = this.rows.filter(row => row.space_id === filters.space_id);
    else if (table === 'event_occurrence_exceptions') rows = this.exceptions.filter(row => filters.event_id.includes(row.event_id));
    else throw new Error('Unexpected table: ' + table);
    const result = this.fail && table === 'events' ? { data: null, count: null, error: { message: '模拟 REST 读取失败' } }
      : { data: structuredClone(rows.slice(start, end + 1)), count: rows.length, error: null };
    if (this.hold && table === 'events') await new Promise(resolve => this.pending.push(resolve));
    return result;
  },
  release() { this.hold = false; for (const resolve of this.pending.splice(0)) resolve(); },
  status(index, status) { this.channels[index].status(status); },
};
if (new URLSearchParams(location.search).has('many')) {
  fixture.rows = Array.from({ length: 501 }, (_, i) => event('e' + i, 'personal', i === 500 ? '末页日程' : '日程' + i));
  fixture.rows.push({ ...event('repeat', 'personal', '已排除重复日程'), recurrence_rule: { version: 1, frequency: 'daily', interval: 1, time_zone: 'Asia/Shanghai' } });
  fixture.exceptions = [{ id: 'exception', event_id: 'repeat', occurrence_date: '2026-10-10', exception_type: 'deleted', override_data: {} }];
}
fixture.client = {
  auth: { onAuthStateChange(fn) { fixture.auth.add(fn); return { data: { subscription: { unsubscribe() { fixture.auth.delete(fn); } } } }; } },
  channel(name) {
    const channel = { name, on(_event, config, changed) { this.config = config; this.changed = changed; return this; }, subscribe(status) { this.status = status; return this; } };
    fixture.channels.push(channel); return channel;
  },
  removeChannel(channel) { fixture.channels = fixture.channels.filter(item => item !== channel); },
  from(table) {
    const filters = {}; let start = 0, end = Number.MAX_SAFE_INTEGER;
    const query = { select() { return query; }, order() { return query; },
      eq(key, value) { filters[key] = value; return query; }, in(key, value) { filters[key] = value; return query; },
      range(first, last) { start = first; end = last; return query; },
      then(resolve, reject) { return fixture.read(table, filters, start, end).then(resolve, reject); } };
    return query;
  },
};

function CalendarFixture() {
  const [userId, setUserId] = useState('me');
  const [single, setSingle] = useState(false);
  const [opened, setOpened] = useState('');
  const visible = single ? [spaces[1]] : spaces;
  const view = useCalendarEvents(userId, spaces, visible, single ? { spaceId: 'shared' } : 'all', 'today', new Date(2026, 9, 10), {
    onValidated: data => fixture.validated.push(data), onInvalidate: () => { fixture.invalidations += 1; },
  });
  Object.assign(fixture, { view, setUserId, setSingle });
  return <main>
    <output aria-label="读取状态">{view.status}</output>
    <output aria-label="读取错误">{view.error}</output>
    <output aria-label="同步错误">{view.syncError}</output>
    <output aria-label="已确认日程">{opened}</output>
    <button onClick={view.retry}>重试读取</button>
    <button onClick={view.refresh}>模拟保存后刷新</button>
    {view.presentation?.items.map(row => <button key={row.occurrence_id} onClick={async () => {
      const qualified = await view.qualify(row);
      setOpened(qualified?.isCurrent() ? qualified.occurrence.title : '无权或无法确认');
    }}>{row.title}</button>)}
  </main>;
}
const root = createRoot(document.getElementById('root'));
fixture.unmount = () => root.unmount();
root.render(<React.StrictMode><CalendarFixture /></React.StrictMode>);
