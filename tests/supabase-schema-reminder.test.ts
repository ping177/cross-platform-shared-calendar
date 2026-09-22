import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const patch = readFileSync(new URL('../supabase/patches/2026-09-20-v0.1.8.2-reminder-persistence.sql', import.meta.url), 'utf8');
const recurrencePatch = readFileSync(new URL('../supabase/patches/2026-09-22-v0.1.8-slice3-recurrence-reminders.sql', import.meta.url), 'utf8');

test('bootstrap schema defines the Slice B event reminder persistence contract', () => {
  assert.match(schema, /reminder_kind text/);
  assert.match(schema, /time_zone text/);
  assert.match(schema, /reminder_schedule_changed_at timestamptz not null/);

  for (const name of [
    'events_reminder_kind_check',
    'events_reminder_kind_matches_all_day_check',
    'events_reminder_requires_time_zone_check',
    'events_recurring_time_zone_consistency_check',
    'prepare_event_reminder_schedule',
    'events_prepare_reminder_schedule',
  ]) {
    assert.match(schema, new RegExp(name));
  }

  assert.doesNotMatch(schema, /reminder_offset_minutes/);
  assert.doesNotMatch(schema, /events_recurring_reminder_unsupported_check/);
});

test('schedule marker trigger compares only the frozen schedule fields', () => {
  const markerFunction = schema.slice(
    schema.indexOf('create or replace function public.prepare_event_reminder_schedule()'),
    schema.indexOf('create or replace function public.can_manage_event('),
  );

  for (const field of ['starts_at', 'all_day', 'reminder_kind', 'time_zone', 'recurrence_rule']) {
    assert.match(markerFunction, new RegExp(`new[.]${field}`));
    assert.match(markerFunction, new RegExp(`old[.]${field}`));
  }

  for (const field of ['title', 'description', 'ends_at', 'recurrence_until']) {
    assert.doesNotMatch(markerFunction, new RegExp(`new[.]${field}`));
    assert.doesNotMatch(markerFunction, new RegExp(`old[.]${field}`));
  }
});

test('split child inherits the source event canonical timezone', () => {
  const splitFunction = schema.slice(
    schema.indexOf('create or replace function public.split_recurring_event('),
    schema.indexOf('create or replace function public.delete_logical_series('),
  );

  assert.match(splitFunction, /recurrence_rule, reminder_kind, time_zone, series_id/);
  assert.match(splitFunction, /source_event[.]recurrence_rule, source_event[.]reminder_kind, source_event[.]time_zone/);
});

test('Slice 3 extends ledger identity and adds a separate hardened recurring claim', () => {
  assert.match(schema, /occurrence_date date/);
  assert.match(schema, /unique nulls not distinct \(event_id, occurrence_date, subscription_id, due_at\)/i);
  assert.match(schema, /create or replace function public[.]claim_recurring_reminder_delivery\(/i);
  assert.match(schema, /set search_path = pg_catalog, pg_temp/i);
  assert.match(schema, /event_occurrence_exceptions/i);
  assert.match(schema, /p_expected_source_updated_at/i);
  assert.match(schema, /p_expected_exception_id/i);
  assert.match(schema, /p_effective_schedule_changed_at/i);
});

test('Slice 3 ships one guarded additive patch without rewriting historical Reminder values', () => {
  assert.match(recurrencePatch, /drop constraint events_recurring_reminder_unsupported_check/i);
  assert.match(recurrencePatch, /add column occurrence_date date/i);
  assert.match(recurrencePatch, /claim_recurring_reminder_delivery/i);
  assert.doesNotMatch(recurrencePatch, /update public[.]events[\s\S]*set reminder_kind/i);
});

test('forward patch guards assumptions and preserves the historical migration policy', () => {
  assert.match(patch, /Slice B Event columns already or partially exist/);
  assert.match(patch, /Legacy reminder_offset_minutes exists/);
  assert.match(patch, /Unexpected legacy reminder field exists/);
  assert.match(patch, /Canonical split_recurring_event signature is missing/);
  assert.match(patch, /Canonical split_recurring_event definition has drifted/);
  assert.match(patch, /Required Event trigger baseline has drifted/);
  assert.match(patch, /Event RLS policy baseline has drifted/);
  assert.match(patch, /Event Realtime or replica identity baseline has drifted/);
  assert.match(patch, /Historical recurring Event has a missing or invalid recurrence timezone/);
  assert.match(patch, /set time_zone = recurrence_rule ->> 'time_zone'\s+where recurrence_rule is not null/);
  assert.doesNotMatch(patch, /set reminder_kind\s*=/);
  assert.doesNotMatch(patch, /set time_zone =[^;]+where recurrence_rule is null/);
  assert.match(patch, /alter column reminder_schedule_changed_at drop default/);
  assert.doesNotMatch(patch, /create table (?:if not exists )?public[.]reminder_deliveries/i);
  assert.doesNotMatch(patch, /create or replace function public[.]send_reminders/i);
});
