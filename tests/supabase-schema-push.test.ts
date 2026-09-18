import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const patch = readFileSync(new URL('../supabase/patches/2026-09-18-v0.1.8.1-push-infrastructure.sql', import.meta.url), 'utf8');

for (const [label, sql] of [['bootstrap schema', schema], ['forward patch', patch]] as const) {
  test(`${label} defines the push subscription table and authenticated RPC boundary`, () => {
    for (const name of [
      'push_subscriptions',
      'installation_id',
      'expiration_time',
      'platform_hint',
      'disabled_at',
      'last_seen_at',
      'register_push_subscription',
      'disable_push_subscription',
    ]) {
      assert.match(sql, new RegExp(name));
    }

    assert.match(sql, /unique\s*\(user_id, installation_id\)/i);
    assert.match(sql, /endpoint text not null unique/i);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /security definer[\s\S]*set search_path = public/i);
    assert.match(sql, /revoke all on table public\.push_subscriptions from anon, authenticated/i);
    assert.match(sql, /grant execute on function public\.register_push_subscription[\s\S]*to authenticated/i);
    assert.doesNotMatch(sql, /reminder_offset_minutes/i);
  });
}
