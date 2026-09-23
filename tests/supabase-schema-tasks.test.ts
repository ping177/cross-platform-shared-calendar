import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const schemaPath = new URL('../supabase/schema.sql', import.meta.url);
const patchPath = new URL(
  '../supabase/patches/2026-09-22-v0.1.9-shared-tasks-slice1.sql',
  import.meta.url,
);

const schema = readFileSync(schemaPath, 'utf8');
const patchExists = existsSync(patchPath);
const patch = patchExists ? readFileSync(patchPath, 'utf8') : '';
const correctionPath = new URL('../supabase/patches/2026-09-23-v0.1.9-task-status-ownership.sql', import.meta.url);
const correction = existsSync(correctionPath) ? readFileSync(correctionPath, 'utf8') : '';

const expectedColumns = [
  'id',
  'space_id',
  'created_by',
  'assigned_to_user_id',
  'title',
  'status',
  'due_on',
  'created_at',
  'updated_at',
];

const forbiddenColumns = [
  'description',
  'scope',
  'completed_at',
  'completed_by',
  'reminder_config',
  'recurrence',
  'priority',
  'tags',
  'comments',
  'attachments',
  'ordering',
  'json_config',
  'event_id',
];

function taskTableDefinition(sql: string) {
  return sql.match(/create table(?: if not exists)? public\.tasks \(([\s\S]*?)\n\);/i)?.[1] ?? '';
}

test('the v0.1.9 Slice 1 forward patch exists', () => {
  assert.equal(patchExists, true);
});

for (const [label, sql] of [['bootstrap schema', schema], ['forward patch', patch]] as const) {
  test(`${label} defines only the frozen Task columns and constraints`, () => {
    const table = taskTableDefinition(sql);
    assert.notEqual(table, '');

    for (const column of expectedColumns) {
      assert.match(table, new RegExp(`\\b${column}\\b`, 'i'));
    }

    for (const column of forbiddenColumns) {
      assert.doesNotMatch(table, new RegExp(`\\b${column}\\b`, 'i'));
    }

    assert.match(table, /id uuid primary key default gen_random_uuid\(\)/i);
    assert.match(table, /space_id uuid not null references public\.spaces\(id\) on delete cascade/i);
    assert.match(table, /created_by uuid not null default auth\.uid\(\) references public\.profiles\(id\) on delete cascade/i);
    assert.match(
      table,
      /foreign key \(space_id, assigned_to_user_id\)[\s\S]*references public\.space_members\(space_id, user_id\)[\s\S]*on delete set null \(assigned_to_user_id\)/i,
    );
    assert.match(table, /status text not null default 'open'/i);
    assert.match(table, /status in \('open', 'completed'\)/i);
    assert.match(table, /due_on date/i);
    assert.match(table, /char_length\(title\) between 1 and 200/i);
    assert.match(table, /title = regexp_replace\(title,/i);
  });

  test(`${label} defines the Task authorization and lifecycle foundation`, () => {
    assert.match(sql, /create index(?: if not exists)? tasks_space_status_due_created_id_idx[\s\S]*\(space_id, status, due_on, created_at, id\)/i);
    assert.match(sql, /alter table public\.tasks replica identity full/i);
    assert.match(sql, /create trigger tasks_touch_updated_at[\s\S]*execute function public\.touch_updated_at\(\)/i);
    assert.match(sql, /create or replace function public\.validate_task_identity\(\)[\s\S]*new\.space_id is distinct from old\.space_id[\s\S]*new\.created_by is distinct from old\.created_by/i);
    assert.match(sql, /alter table public\.tasks enable row level security/i);

    for (const policy of [
      'tasks_select_member',
      'tasks_insert_member',
      'tasks_update_member',
      'tasks_delete_member',
    ]) {
      assert.match(sql, new RegExp(`create policy ["']?${policy}["']?`, 'i'));
    }

    assert.match(sql, /grant select, insert, update, delete on table public\.tasks to authenticated/i);
    assert.match(sql, /alter publication supabase_realtime add table public\.tasks/i);
    assert.doesNotMatch(sql, /create or replace function public\.(?:create|update|delete)_task/i);
  });
}

for (const [label, sql] of [['bootstrap schema', schema], ['status corrective patch', correction]] as const) {
  test(`${label} enforces status ownership from the old assignment`, () => {
    assert.match(sql, /function public\.enforce_task_status_owner\(\)/i);
    assert.match(sql, /old\.status is distinct from new\.status[\s\S]*old\.assigned_to_user_id is not null[\s\S]*old\.assigned_to_user_id is distinct from auth\.uid\(\)/i);
    assert.match(sql, /create trigger tasks_enforce_status_owner[\s\S]*before update on public\.tasks[\s\S]*execute function public\.enforce_task_status_owner\(\)/i);
    assert.doesNotMatch(sql, /create or replace function public\.(?:create|update|delete)_task/i);
  });
}
