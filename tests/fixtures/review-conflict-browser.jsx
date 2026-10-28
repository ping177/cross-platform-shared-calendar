import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReviewEntryEditor } from '../../src/components/ReviewEntryEditor';
import '../../src/styles.css';

const row = { review_id: 'review', user_id: 'me', focus: '原专注', progress: '原进展', problems: '原问题', next_plan: '原计划', content_revision: 1, filled_revision: null, updated_at: '2030-01-01T00:00:00Z' };
window.reviewFixture = {
  row, calls: [], dirty: false, readError: false,
  remote() { this.row = { ...this.row, focus: '手机新专注', progress: '手机新进展', content_revision: this.row.content_revision + 1 }; },
  read() { this.calls.push({ name: 'read' }); return this.readError ? { data: null, error: { message: 'network' } } : { data: { ...this.row }, error: null }; },
  rpc(name, args) {
    this.calls.push({ name, args });
    if (args.p_expected_content_revision !== this.row.content_revision) return { data: null, error: { code: 'P0001', message: 'REVIEW_ENTRY_CONFLICT' } };
    if (name === 'save_my_review_entry') this.row = { ...this.row, focus: args.p_focus, progress: args.p_progress, problems: args.p_problems, next_plan: args.p_next_plan, content_revision: this.row.content_revision + 1 };
    else this.row = { ...this.row, filled_revision: this.row.content_revision };
    return { data: { ...this.row }, error: null };
  },
};
createRoot(document.getElementById('root')).render(<main className="mx-auto min-h-screen max-w-lg bg-ui-page px-ui-4 py-ui-6 font-ui"><ReviewEntryEditor reviewId="review" userId="me" startEditing onDirtyChange={dirty => { window.reviewFixture.dirty = dirty; }} /></main>);
