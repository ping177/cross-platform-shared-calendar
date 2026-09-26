import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const patchPath = new URL('../supabase/patches/2026-09-26-v0.1.14-review-date-chronology.sql', import.meta.url);
const patchExists = existsSync(patchPath);
const patch = patchExists ? readFileSync(patchPath, 'utf8') : '';

function functionDefinition(sql: string, name: string) {
  const escaped = name.replaceAll('.', '\\.');
  return (sql.match(new RegExp(`create(?: or replace)? function ${escaped}\\([\\s\\S]*?\\$\\$;`, 'i'))?.[0] ?? '')
    .replace(/^create or replace function/i, 'create function');
}

test('the v0.1.14 date chronology forward patch exists', () => {
  assert.equal(patchExists, true);
});

for (const [label, sql] of [['bootstrap schema', schema], ['forward patch', patch]] as const) {
  test(`${label} enforces one review per Space date`, () => {
    assert.match(sql, /review_rounds_space_review_date_key[\s\S]*unique\s*\(space_id,\s*review_date\)/i);
    assert.match(sql, /create(?: or replace)? function public\.create_review_round\(p_space_id uuid,p_review_date date\)[\s\S]*这一天已经有一篇回顾/i);
    assert.match(sql, /create(?: or replace)? function public\.correct_review_date\(p_review_id uuid,p_review_date date\)[\s\S]*id<>p_review_id[\s\S]*这一天已经有一篇回顾/i);
  });

  test(`${label} resolves previous plan strictly by review date`, () => {
    const fn = sql.match(/create(?: or replace)? function public\.get_my_previous_review_plan\(p_review_id uuid\)([\s\S]*?)\$\$;/i)?.[1] ?? '';
    assert.notEqual(fn, '');
    assert.match(fn, /review_date<current_review_date/i);
    assert.match(fn, /order by review_date desc/i);
    assert.match(fn, /limit 1/i);
    assert.match(fn, /previous_round_id[\s\S]*user_id=actor/i);
    assert.doesNotMatch(fn, /round_no|created_at/i);
    assert.match(sql, /grant execute on function public\.get_my_previous_review_plan\(uuid\) to authenticated/i);
  });
}

test('bootstrap schema and forward patch keep changed function definitions in parity', () => {
  for (const name of ['public.create_review_round', 'public.correct_review_date', 'public.get_my_previous_review_plan']) {
    assert.notEqual(functionDefinition(schema, name), '');
    assert.equal(functionDefinition(patch, name), functionDefinition(schema, name));
  }
});

test('the forward patch is additive and never cleans existing reviews', () => {
  assert.match(patch, /^--[\s\S]*\nbegin;/i);
  assert.match(patch, /commit;\s*$/i);
  assert.match(patch, /duplicate review dates must be resolved before applying/i);
  assert.doesNotMatch(patch, /\bdrop\s+(?:table|function|constraint)\b/i);
  assert.doesNotMatch(patch, /delete\s+from\s+public\.review_(?:rounds|entries)|truncate\s+(?:table\s+)?public\.review_/i);
  assert.equal(patch.match(/update\s+public\.review_rounds\s+set\s+review_date\s*=/gi)?.length, 1);
});
