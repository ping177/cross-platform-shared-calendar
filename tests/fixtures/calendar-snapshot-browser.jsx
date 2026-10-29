// Real Calendar and projection lifecycle; only canonical backend I/O is synthetic.
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CurrentSpaceApp } from '../../src/App';
import '../../src/styles.css';
const personal = { id: 'personal', kind: 'personal', name: '个人', membershipRole: 'owner' };
const shared = { id: 'shared', kind: 'shared', name: '共享', membershipRole: 'member' };
const spaces = [personal, shared];
const date = (id, day, name) => ({ id, space_id: 'shared', name, emoji: '❤️', repeat_kind: 'none', year: 2026, month: 10, day,
  reminder_kind: null, time_zone: 'Asia/Shanghai' });
const fixture = window.snapshotFixture = {
  rows: new URLSearchParams(location.search).has('empty') ? [] : [date('before', 5, '周初重要日'), date('today', 10, '当天重要日'), date('later', 20, '月内重要日')],
  hold: false, pending: [], reads: 0, validated: [], channels: [], listeners: new Set(),
  async load(_user, ids, range, _client, _spaces, qualify) {
    this.reads += 1; const scope = { memberSpaces: spaces, eligibleSpaces: spaces }; qualify?.(scope);
    const result = { ...scope, dates: structuredClone(this.rows.filter(row => ids.includes(row.space_id))) };
    if (this.hold) await new Promise(resolve => this.pending.push(resolve));
    return result;
  },
  release() { this.hold = false; for (const resolve of this.pending.splice(0)) resolve(); },
};
fixture.client = {
  auth: { onAuthStateChange(fn) { fixture.listeners.add(fn); return { data: { subscription: { unsubscribe() { fixture.listeners.delete(fn); } } } }; } },
  channel() { const channel = { on(_event, _config, change) { this.change = change; return this; }, subscribe(fn) { queueMicrotask(() => fn('SUBSCRIBED')); return this; } }; fixture.channels.push(channel); return channel; },
  removeChannel(channel) { fixture.channels = fixture.channels.filter(item => item !== channel); },
  from(table) {
    let spaceId; const query = { select() { return query; }, eq(_key, id) { spaceId = id; return query; }, order() { return query; }, range() { return query; }, in() { return query; },
      then(resolve, reject) { const data = table === 'space_members' ? [{ space_id: spaceId, user_id: 'me', role: 'owner', profiles: { display_name: '测试成员' } }] : [];
        return Promise.resolve({ data, count: data.length, error: null }).then(resolve, reject); } };
    return query;
  },
};
function Fixture() {
  const snapshot = useRef(); const [view, setView] = useState('month'); const [selectedDate, setDate] = useState(new Date(2026, 9, 10));
  const [filter, setFilter] = useState('all'); const [mounted, setMounted] = useState(true);
  Object.assign(fixture, { setView, setDate, setMounted, setFilter });
  return mounted ? <CurrentSpaceApp session={{ user: { id: 'me' } }} spaces={filter === 'all' ? spaces : spaces.filter(space => space.id === filter.spaceId)} allSpaces={spaces}
    importantDatesEntry={{ memberSpaces: spaces, eligibleSpaces: spaces }} initialCalendarImportantDates={snapshot.current}
    onCalendarImportantDatesValidated={data => { snapshot.current = data; fixture.validated.push(data); }} onCalendarImportantDatesInvalidate={() => { snapshot.current = undefined; }}
    calendarFilter={filter} onCalendarFilterChange={setFilter} selectedDate={selectedDate} onSelectedDateChange={setDate} viewMode={view} onViewModeChange={setView} /> : null;
}
const root = createRoot(document.getElementById('root'));
fixture.unmount = () => root.unmount();
root.render(<React.StrictMode><Fixture /></React.StrictMode>);
