import { personalExportClient } from './personal-export-client.ts';
import { syntheticExport } from './data-export-synthetic.ts';
import { exportTables } from '../../src/lib/data-export-format.ts';

export function spaceExportClient(cap = 500) {
  const f = personalExportClient(0, cap), input = syntheticExport();
  for (const table of exportTables) {
    if (table.startsWith('review_')) continue;
    const source = ({ space: 'spaces', members: 'space_members', modules: 'space_modules' })[table] ?? table;
    f.rows[source] = input.spaces.flatMap(space => space.tables[table].map(row => ({ ...row })));
  }
  // Legitimate unassigned task after a member leaves; creators are not ownership.
  f.rows.tasks[0].assigned_to_user_id = null;
  return f;
}
