import { exportTables, type ExportRow, type ExportTable } from '../../src/lib/data-export-format.ts';
import type { ExportInput, ExportSpace } from '../../src/lib/data-export-archive.ts';

export const syntheticActor = '20000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const historical = '20000000-0000-4000-8000-000000000003';
const stamp = '2026-11-04T01:00:00.000Z';
const audit = { created_by: other, created_at: stamp, updated_at: stamp };
const uid = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function syntheticExport(): ExportInput {
  const startedAt = new Date().toISOString();
  const spaces: ExportSpace[] = [1, 2].map((n) => {
    const spaceId = `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const tables = Object.fromEntries(exportTables.map((table) => [table, []])) as Record<ExportTable, ExportRow[]>;
    tables.space = [{ id: spaceId, name: '../同名家人🐈', kind: n === 1 ? 'personal' : 'shared', created_by: syntheticActor, created_at: stamp }];
    tables.members = [{ space_id: spaceId, user_id: syntheticActor, role: 'owner', joined_at: stamp }];
    // Disabled modules still export retained data. Personal is deliberately empty.
    tables.modules = ['tasks', 'lists', 'important_dates', 'review'].map((module_key) => ({ space_id: spaceId, module_key, enabled: false }));
    if (n === 2) {
      tables.members.push({ space_id: spaceId, user_id: other, role: 'member', joined_at: stamp });
      const event = { id: uid(1), space_id: spaceId, ...audit, scope: 'shared', owner_user_id: null,
        title: '=HYPERLINK("https://example.invalid","样本")', description: '中文🐈, "引号"\n下一行\r\n末行',
        starts_at: stamp, ends_at: null, all_day: false, reminder_kind: null, time_zone: 'Asia/Shanghai',
        reminder_schedule_changed_at: stamp, recurrence_rule: null, series_id: null, parent_event_id: null, recurrence_until: null };
      tables.events = [event, { ...event, id: uid(2), title: '每日重复', description: '',
        recurrence_rule: '{"version":1,"frequency":"daily","interval":1,"time_zone":"Asia/Shanghai"}', series_id: uid(2) },
      { ...event, id: uid(3), title: '此后分段', starts_at: '2026-11-06T01:00:00.000Z', recurrence_rule: '{"version":1,"frequency":"daily","interval":1,"time_zone":"Asia/Shanghai"}', series_id: uid(2), parent_event_id: uid(2) }];
      tables.events[1].recurrence_until = '2026-11-06T01:00:00.000Z';
      tables.event_occurrence_exceptions = [
        { id: uid(4), event_id: uid(2), occurrence_date: '2026-11-05', exception_type: 'deleted', override_data: null, created_at: stamp, updated_at: stamp },
        { id: uid(5), event_id: uid(3), occurrence_date: '2026-11-07', exception_type: 'override', override_data: '{"title":"+危险公式🐈","description":""}', created_at: stamp, updated_at: stamp },
      ];
      tables.tasks = [{ id: uid(6), space_id: spaceId, ...audit, assigned_to_user_id: other, title: '@SUM(A1)', status: 'open', due_on: '2026-11-08', reminder_kind: null, time_zone: null, reminder_schedule_changed_at: stamp }];
      tables.lists = [{ id: uid(7), space_id: spaceId, name: '清单🐈', ...audit }];
      tables.list_sections = [{ id: uid(8), list_id: uid(7), name: '分组', sort_order: '9007199254740993', ...audit }];
      tables.list_items = [
        { id: uid(9), list_id: uid(7), space_id: spaceId, section_id: uid(8), content: '-1+2', completed: false, sort_order: '9223372036854775807', ...audit },
        { id: uid(10), list_id: uid(7), space_id: spaceId, section_id: null, content: '未分组', completed: true, sort_order: '1', ...audit },
      ];
      tables.important_dates = [{ id: uid(11), space_id: spaceId, name: '重要日', emoji: '🐈', repeat_kind: 'annual', month: 2, day: 29, year: null, reminder_kind: null, time_zone: 'Asia/Shanghai', reminder_schedule_changed_at: stamp, ...audit }];
      tables.review_rounds = [{ id: uid(12), space_id: spaceId, round_no: 1, review_date: '2026-11-04', created_by: syntheticActor, created_at: stamp }];
      tables.review_entries = [
        { review_id: uid(12), user_id: syntheticActor, focus: null, progress: '', problems: '\\N', next_plan: '\t＝1\n中文🐈', content_revision: '9007199254740993', filled_revision: null, updated_at: stamp },
        { review_id: uid(12), user_id: historical, focus: '历史参与者', progress: null, problems: null, next_plan: 'text:原文', content_revision: '1', filled_revision: '1', updated_at: stamp },
      ];
    }
    return { tables, expectedRows: Object.fromEntries(exportTables.map((table) => [table, tables[table].length])) as Record<ExportTable, number> };
  });
  return { actorId: syntheticActor, startedAt, finishedAt: new Date().toISOString(), synthetic: true, spaces };
}
