import assert from 'node:assert/strict';
import test from 'node:test';
import { activeNotificationAccounts, requireActiveAccount } from '../supabase/functions/_shared/account-access.ts';

test('only an explicit active result authorizes a notification operation', async () => {
  await requireActiveAccount(async () => ({ data: true, error: null }));
  for (const data of [false, null, undefined, 'true', {}, []]) {
    await assert.rejects(requireActiveAccount(async () => ({ data, error: null })), /Authentication required/);
  }
});

test('RPC errors and network uncertainty fail closed without exposing details', async () => {
  await assert.rejects(requireActiveAccount(async () => ({ data: true, error: { detail: 'internal' } })), /^Error: Authentication required\.$/);
  await assert.rejects(requireActiveAccount(async () => { throw new Error('internal'); }), /^Error: Authentication required\.$/);
});

test('a state change after lookup prevents the second authorization from sending', async () => {
  let active = true;
  let sends = 0;
  const read = async () => ({ data: active, error: null });
  await requireActiveAccount(read);
  active = false;
  await assert.rejects((async () => { await requireActiveAccount(read); sends += 1; })(), /Authentication required/);
  assert.equal(sends, 0);
});

test('service prefilter keeps only active requested recipients, including an empty result', async () => {
  assert.deepEqual(await activeNotificationAccounts(async () => ({ data: ['a'], error: null }), ['a','b']), new Set(['a']));
  assert.deepEqual(await activeNotificationAccounts(async () => ({ data: [], error: null }), ['a']), new Set());
});

test('malformed, foreign, duplicate or failed account batch cannot authorize dispatch', async () => {
  for (const data of [null, {}, ['other'], ['a','a'], [1]]) {
    await assert.rejects(activeNotificationAccounts(async () => ({ data, error: null }), ['a']), /eligibility lookup failed/);
  }
  await assert.rejects(activeNotificationAccounts(async () => ({ data: ['a'], error: 'failed' }), ['a']), /eligibility lookup failed/);
});
