// Real components, React scheduling, DnD, detail hook and mutations. Only backend I/O is fake.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ListDetailPage } from '../../src/components/ListDetailPage';
import { ImportantDateDeleteDialog } from '../../src/components/ImportantDateSheet';
import { SpaceLifecycleControls } from '../../src/components/SpaceManagementPage';
import { ReviewDetailPage } from '../../src/components/ReviewDetailPage';
import { InvitePanel } from '../../src/components/InvitePanel';
import { EventSheet } from '../../src/App';
import { TaskSheet } from '../../src/components/TaskSheet';
import '../../src/styles.css';

const space = { id: 's', name: '测试空间', kind: 'shared', membershipRole: 'owner', created_by: 'me', invite_code: 'TEST' };
const own = { review_id: 'r', user_id: 'me', focus: null, progress: null, problems: null, next_plan: null, content_revision: 0, filled_revision: null, updated_at: '2026-10-15T00:00:00Z' };
window.fixture = {
  calls: [], fail: false, hold: false,
  data: {
    status: 'ready', space, list: { id: 'l', space_id: 's', name: '测试清单' },
    sections: [{ id: 'empty', list_id: 'l', name: '空分组', sort_order: 1 }, { id: 'full', list_id: 'l', name: '非空分组', sort_order: 2 }],
    items: [{ id: 'i', list_id: 'l', space_id: 's', section_id: 'full', content: '牛奶', completed: false, sort_order: 1 }],
  },
  review: { round: { id: 'r', space_id: 's', round_no: 2, review_date: '2026-10-15' }, own, other: { ...own, user_id: 'other' } },
  async write(method, args) {
    this.calls.push({ method, args });
    if (this.hold) await new Promise(resolve => { this.release = resolve; });
    if (this.fail) return { data: null, error: new Error('操作失败，请重试。') };
    const { data } = this;
    if (method === 'rename-section') {
      const row = data.sections.find(row => row.id === args.id);
      Object.assign(row, args.value);
      return { data: { ...row }, error: null };
    }
    if (method === 'rename-list') {
      Object.assign(data.list, args.value);
      return { data: { ...data.list }, error: null };
    }
    if (method === 'delete_list_section') {
      data.sections = data.sections.filter(row => row.id !== args.p_section_id);
      data.items = args.p_preserve_items
        ? data.items.map(row => row.section_id === args.p_section_id ? { ...row, section_id: null } : row)
        : data.items.filter(row => row.section_id !== args.p_section_id);
    }
    if (method === 'delete_list_item') data.items = data.items.filter(row => row.id !== args.p_item_id);
    if (method === 'delete_list') this.unavailable = true;
    return { data: null, error: null };
  },
};
const noop = () => {};
const target = { spaceId: 's', listId: 'l' };
const members = [{ space_id: 's', user_id: 'me', role: 'owner' }, { space_id: 's', user_id: 'other', role: 'member' }];
const event = { id: 'e', space_id: 's', title: '测试日程', created_by: 'me', owner_user_id: null, scope: 'shared', starts_at: '2026-10-15T09:00:00Z', ends_at: null, all_day: false, recurrence_rule: null, reminder_kind: null };
const mode = new URLSearchParams(location.search).get('mode');
const Component = mode === 'important' || mode === 'important-module'
  ? <ImportantDateDeleteDialog moduleView={mode === 'important-module'} date={{ name: '测试重要日' }} space={space} busy={false} canAct error="" onCancel={noop} onConfirm={noop} />
  : mode === 'space' || mode === 'leave'
    ? <SpaceLifecycleControls space={mode === 'leave' ? { ...space, membershipRole: 'member' } : space} members={members} userId={mode === 'leave' ? 'other' : 'me'} busy={false} onBusyChange={noop} onSettled={async () => {}} />
    : mode === 'review'
      ? <ReviewDetailPage userId="me" target={{ spaceId: 's', reviewId: 'r', justCreated: false }} onBack={noop} onUnavailable={noop} onDirtyChange={noop} />
      : mode === 'invite'
        ? <InvitePanel space={space} onSpaceChange={noop} />
        : mode === 'event' || mode === 'recurring'
          ? <EventSheet target={mode === 'event' ? { kind: 'event', event } : { kind: 'occurrence', event: { ...event, recurrence_rule: { version: 1, frequency: 'daily', interval: 1, time_zone: 'Asia/Shanghai' } }, occurrence: { occurrence_id: 'e:2026-10-15', occurrence_date: '2026-10-15', title: event.title, description: null, occurrence_starts_at: event.starts_at, occurrence_ends_at: null, all_day: false } }} space={space} userId="me" members={members} partnerId="other" onClose={noop} onSaved={noop} />
          : mode === 'task'
            ? <TaskSheet task={{ id: 't', title: '测试任务', status: 'open', assigned_to_user_id: null, due_on: null }} spaceId="s" spaceKind="shared" userId="me" members={members} onClose={noop} onSaved={async () => {}} />
            : <ListDetailPage userId="me" target={target} onBack={noop} onUnavailable={() => { window.fixture.unavailable = true; }} />;
createRoot(document.getElementById('root')).render(Component);
