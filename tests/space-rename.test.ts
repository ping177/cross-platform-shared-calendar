import assert from 'node:assert/strict';
import test from 'node:test';
import { canRenameSpace, normalizeSpaceName, renameSpace } from '../src/lib/space-rename.ts';
import type { CurrentSpace } from '../src/types.ts';

const shared = { id: 's', name: '原名称', kind: 'shared', created_by: 'former-owner', membershipRole: 'owner', invite_code: 'UNCHANGED', created_at: '2026-01-01' } as CurrentSpace;
function fixture(fields: any = {}) {
  const calls: any[] = [];
  const response = { data: { ...shared, name: '新名称' }, error: null, ...fields };
  const query: any = { update(value: any) { calls.push(['update', value]); return query; }, eq(key: string, value: string) { calls.push(['eq', key, value]); return query; }, select(value: string) { calls.push(['select', value]); return query; }, async maybeSingle() { return response; } };
  const client: any = { auth: { async getUser() { calls.push(['auth']); return { data: { user: { id: 'me' } }, error: null }; } }, from(table: string) { calls.push(['from', table]); return query; } };
  return { client, calls, response };
}
test('name uses trim and 1–80 Unicode code points, including astral Emoji', () => {
  assert.equal(normalizeSpaceName('\t\u00a0新名称\ufeff\u3000'), '新名称');
  assert.equal(normalizeSpaceName('🌿'.repeat(80)), '🌿'.repeat(80));
  for (const value of ['', ' \t\u00a0\ufeff\u3000', '🌿'.repeat(81)]) assert.throws(() => normalizeSpaceName(value), /1–80/);
});
test('Shared rename uses current owner role, not creator; Personal requires own identity', () => {
  assert.equal(canRenameSpace(shared, 'me'), true);
  assert.equal(canRenameSpace({ ...shared, membershipRole: 'member', created_by: 'me' }, 'me'), false);
  assert.equal(canRenameSpace({ ...shared, kind: 'personal', created_by: 'me' }, 'me'), true);
  assert.equal(canRenameSpace({ ...shared, kind: 'personal' }, 'me'), false);
});
test('name-only UPDATE uses exact ID and old name, and returns canonical fields', async () => {
  const e = fixture();
  assert.deepEqual(await renameSpace(e.client, shared, 'me', ' 新名称 '), e.response.data);
  assert.deepEqual(e.calls.filter(c => c[0] === 'update'), [['update', { name: '新名称' }]]);
  assert.deepEqual(e.calls.filter(c => c[0] === 'eq'), [['eq', 'id', 's'], ['eq', 'name', '原名称']]);
  assert.equal(shared.name, '原名称');
});
test('Personal owner can rename and unchanged legacy names cause no network or UPDATE', async () => {
  const e = fixture({ data: { ...shared, kind: 'personal', created_by: 'me', name: '新名称' } });
  await renameSpace(e.client, { ...shared, kind: 'personal', created_by: 'me' }, 'me', '新名称');
  for (const name of ['原名称', '  旧名称  ', '旧'.repeat(90)]) {
    const noOp = fixture();
    assert.equal(await renameSpace(noOp.client, { ...shared, name }, 'me', name), null);
    assert.equal(noOp.calls.length, 0);
  }
});
test('members and changed sessions are rejected before mutation', async () => {
  const e = fixture();
  await assert.rejects(renameSpace(e.client, { ...shared, membershipRole: 'member' }, 'me', '新名称'), /所有者/);
  assert.equal(e.calls.length, 0);
  e.client.auth.getUser = async () => ({ data: { user: { id: 'other' } }, error: null });
  await assert.rejects(renameSpace(e.client, shared, 'me', '新名称'), /登录状态/);
  assert.equal(e.calls.length, 0);
});
test('failed write, stale rows and unexpected canonical return do not report success', async () => {
  for (const fields of [{ error: { message: '网络失败' } }, { data: null }, { data: { ...shared, id: 'wrong', name: '新名称' } }]) {
    const e = fixture(fields);
    await assert.rejects(renameSpace(e.client, shared, 'me', '新名称'));
    assert.equal(shared.name, '原名称');
  }
});
