import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

test('bootstrap schema includes final recurrence objects and secure RPC definitions', () => {
  for (const name of ['event_occurrence_exceptions', 'series_id', 'parent_event_id', 'recurrence_until', 'recurring_occurrence_instant', 'assert_manage_recurring_event', 'upsert_occurrence_override', 'delete_occurrence', 'split_recurring_event', 'delete_logical_series', 'delete_occurrence_and_future']) {
    assert.match(schema, new RegExp(name));
  }
  assert.match(schema, /security definer/i);
  assert.match(schema, /set search_path = public/i);
  const split = schema.slice(schema.indexOf('create or replace function public.split_recurring_event('));
  assert.match(split, /source_event\.recurrence_until/);
  assert.doesNotMatch(split, /source_event\.id, null\s*\)/);
});
