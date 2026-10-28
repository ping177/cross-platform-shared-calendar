import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReviewDetailPage } from '../../src/components/ReviewDetailPage';
import { createSwipeClickGuard } from '../../src/lib/mobile-swipe';
import '../../src/styles.css';

const mode = new URLSearchParams(location.search).get('mode');
const own = { review_id: 'review', user_id: 'me', focus: '已保存专注', progress: '已保存进展', problems: '已保存问题', next_plan: '已保存计划', content_revision: 3, filled_revision: null, updated_at: '2030-01-01T00:00:00Z' };
if (mode === 'blank') Object.assign(own, { focus: null, progress: null, problems: null, next_plan: null, content_revision: 0 });
if (mode === 'completed') own.filled_revision = 3;
window.reviewUx = {
  row: own, calls: [], dirty: false, backs: 0, hold: false, error: null,
  remote() { this.row = { ...this.row, focus: '其他会话新专注', content_revision: this.row.content_revision + 1 }; },
  tables() {
    return {
      spaces: [{ id: 'space', kind: mode === 'personal' ? 'personal' : 'shared', name: '合成测试空间', created_by: 'me' }],
      space_members: [{ space_id: 'space', user_id: 'me', role: 'owner' }],
      space_modules: [{ space_id: 'space', module_key: 'review', enabled: true }],
      review_rounds: [{ id: 'review', space_id: 'space', round_no: 1, review_date: '2030-01-01', created_by: 'me', created_at: '2030-01-01' }],
      review_entries: [this.row, ...(mode === 'personal' ? [] : [{ ...own, user_id: 'other', focus: '对方只读内容' }])],
    };
  },
  query(table) {
    let rows = this.tables()[table];
    if (!rows) throw new Error('Unexpected fixture table: ' + table);
    let single = false;
    const q = {
      select() { return q; }, eq(key, value) { rows = rows.filter(row => row[key] === value); return q; },
      order() { return q; }, range() { return q; }, maybeSingle() { single = true; return q; },
      then(resolve, reject) { return Promise.resolve({ data: structuredClone(single ? rows[0] ?? null : rows), count: rows.length, error: null }).then(resolve, reject); },
    };
    return q;
  },
  async rpc(name, args) {
    this.calls.push({ name, args });
    if (this.hold) await new Promise(resolve => { this.release = resolve; });
    if (this.error) return { data: null, error: { message: this.error } };
    if (args.p_expected_content_revision !== this.row.content_revision) return { data: null, error: { message: 'REVIEW_ENTRY_CONFLICT', code: 'P0001' } };
    if (name === 'mark_my_review_filled') this.row = { ...this.row, filled_revision: this.row.content_revision };
    else if (name === 'save_my_review_entry') this.row = { ...this.row, focus: args.p_focus, progress: args.p_progress, problems: args.p_problems, next_plan: args.p_next_plan, content_revision: this.row.content_revision + 1 };
    else throw new Error('Unexpected fixture RPC: ' + name);
    return { data: { ...this.row }, error: null };
  },
};

function Fixture() {
  const guard = useRef(createSwipeClickGuard()).current;
  const [history, setHistory] = useState(false);
  return <div onPointerDownCapture={guard.onPointerDownCapture} onClickCapture={guard.onClickCapture}>
    {history ? <main className="min-h-screen"><h1>回顾历史列表</h1></main> : <ReviewDetailPage
      swipeClickGuard={guard} target={{ spaceId: 'space', reviewId: 'review', justCreated: false }} userId="me"
      onDirtyChange={dirty => { window.reviewUx.dirty = dirty; }}
      onBack={() => { window.reviewUx.backs += 1; setHistory(true); }}
    />}
  </div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
