import { personalExportClient } from './personal-export-client.ts';
import { syntheticExport } from './data-export-synthetic.ts';
import { exportTables } from '../../src/lib/data-export-format.ts';

export function spaceExportClient(cap = 500) {
  const f = personalExportClient(0, cap), input = syntheticExport();
  for (const table of exportTables) {
    const source = ({ space: 'spaces', members: 'space_members', modules: 'space_modules' })[table] ?? table;
    f.rows[source] = input.spaces.flatMap(space => space.tables[table].map(row => ({ ...row })));
  }
  // Legitimate unassigned task after a member leaves; creators are not ownership.
  f.rows.tasks[0].assigned_to_user_id = null;
  // Model the checked-in participant RLS for isolated tests; this is NOT a live RLS test.
  f.state.filterRows = (table, rows) => {
    if (!table.startsWith('review_')) return rows;
    const visible = new Set(f.rows.review_rounds.filter(round =>
      f.rows.space_members.some(m => m.space_id === round.space_id && m.user_id === f.state.user)
      && f.rows.review_entries.some(entry => entry.review_id === round.id && entry.user_id === f.state.user)).map(round => round.id));
    return rows.filter(row => visible.has(table === 'review_rounds' ? row.id : row.review_id));
  };
  return f;
}
