import assert from 'node:assert/strict';
import test from 'node:test';
import { avatarPresets, isAvatarPath, validateAvatarFile } from '../src/lib/avatar.ts';
import { changeAvatar, cleanupAvatarFiles, findUnusedAvatarPhotos } from '../src/lib/avatar-data.ts';

const me = 'a0000000-0000-4000-8000-000000000001';
const oldPath = `${me}/b0000000-0000-4000-8000-000000000001.jpg`;
const newPath = `${me}/b0000000-0000-4000-8000-000000000002.jpg`;
function fixture() {
  const state: any = { profile: { display_name: '本人', avatar_preset: null, avatar_path: oldPath }, files: new Set([oldPath]), authId: me, writes: 0, failWrite: false, ambiguous: false, failRead: false, failRemove: false, race: false };
  const client: any = {
    auth: { getUser: async () => ({ data: { user: { id: state.authId } }, error: null }) },
    storage: { from: () => ({ upload: async (path: string) => { state.files.add(path); return { error: null }; }, remove: async (paths: string[]) => { if (state.failRemove) return { error: new Error('offline') }; for (const path of paths) { assert.notEqual(path, state.profile.avatar_path); state.files.delete(path); } return { error: null }; } }) },
    from: () => {
      let update: any; const filters: Record<string, any> = {};
      const q: any = { select: () => q, eq: (k: string, v: any) => { filters[k] = v; return q; }, is: (k: string, v: any) => { filters[k] = v; return q; }, update: (v: any) => { update = v; return q; }, maybeSingle: async () => {
        if (!update) { if (state.failRead) return { data: null, error: new Error('offline') }; return { data: { ...state.profile }, error: null }; }
        state.writes++; if (state.race) state.profile.avatar_preset = 'moon';
        if (state.failWrite) return { data: null, error: new Error('offline') };
        if (['avatar_path', 'avatar_preset'].some(k => filters[k] !== state.profile[k])) return { data: null, error: null };
        Object.assign(state.profile, update); if (state.ambiguous) { state.failRead = true; return { data: null, error: new Error('response lost') }; }
        return { data: { ...state.profile }, error: null };
      } }; return q;
    },
  }; return { state, client };
}
test('12 stable presets, strict owned paths and input size/type validation', () => {
  assert.equal(avatarPresets.length, 12); assert.equal(new Set(avatarPresets.map(p => p.id)).size, 12);
  assert.equal(avatarPresets.filter(p => p.group === 'animal').length, 6);
  assert.equal(isAvatarPath(oldPath, me), true); assert.equal(isAvatarPath(oldPath, 'other'), false);
  for (const path of ['../x.jpg', `${me}/../../x.jpg`, 'https://outside/image.jpg']) assert.equal(isAvatarPath(path, me), false);
  for (const [type, size] of [['image/svg+xml', 10], ['image/gif', 10], ['image/jpeg', 11 * 1024 * 1024], ['image/png', 0]]) assert.throws(() => validateAvatarFile({ type, size } as File));
  validateAvatarFile({ type: 'image/webp', size: 100 } as File);
});
test('upload then publish metadata; clean old photo only after success and preserve name', async () => {
  const { state, client } = fixture(); const result = await changeAvatar(client, me, { photo: new Blob(['jpeg'], { type: 'image/jpeg' }) }, () => newPath.split('/')[1].slice(0, -4));
  assert.equal(result.profile.avatar_path, newPath); assert.equal(result.profile.display_name, '本人');
  assert.deepEqual([...state.files], [newPath]); assert.deepEqual(result.cleanupPaths, []);
});
test('preset/default persist and remove previous photo; unchanged choice does not write', async () => {
  const { state, client } = fixture(); await changeAvatar(client, me, { preset: 'cat' });
  assert.equal(state.profile.avatar_preset, 'cat'); assert.equal(state.profile.avatar_path, null); assert.equal(state.files.size, 0);
  await changeAvatar(client, me, { preset: 'cat' }); assert.equal(state.writes, 1);
  await changeAvatar(client, me, { preset: null }); assert.equal(state.profile.avatar_preset, null);
});
test('cross-account and invalid preset fail before mutation or upload', async () => {
  const { state, client } = fixture(); state.authId = 'other'; await assert.rejects(changeAvatar(client, me, { preset: 'cat' }));
  state.authId = me; await assert.rejects(changeAvatar(client, me, { preset: 'invalid' })); assert.equal(state.writes, 0); assert.equal(state.files.size, 1);
});
test('unconfirmed metadata failure retains new upload for deferred cleanup and keeps previous photo', async () => {
  const { state, client } = fixture(); state.failWrite = true;
  await assert.rejects(changeAvatar(client, me, { photo: new Blob(['jpeg'], { type: 'image/jpeg' }) }, () => newPath.split('/')[1].slice(0, -4)));
  assert.equal(state.profile.avatar_path, oldPath); assert.deepEqual([...state.files], [oldPath, newPath]);
});
test('ambiguous committed response never deletes possibly active new photo', async () => {
  const { state, client } = fixture(); state.ambiguous = true;
  await assert.rejects(changeAvatar(client, me, { photo: new Blob(['jpeg'], { type: 'image/jpeg' }) }, () => newPath.split('/')[1].slice(0, -4)));
  assert.equal(state.profile.avatar_path, newPath); assert.ok(state.files.has(newPath));
});
test('lost metadata response followed by a late commit preserves the newly uploaded photo', async () => {
  const { state, client } = fixture(); state.failWrite = true;
  await assert.rejects(changeAvatar(client, me, { photo: new Blob(['jpeg'], { type: 'image/jpeg' }) }, () => newPath.split('/')[1].slice(0, -4)));
  assert.equal(state.profile.avatar_path, oldPath);
  // The connection failed before the still-running database request committed.
  state.profile.avatar_path = newPath;
  assert.ok(state.files.has(newPath), 'late committed avatar must still have its photo');
});
test('stale metadata update rejects and keeps other device choice', async () => {
  const { state, client } = fixture(); state.race = true; await assert.rejects(changeAvatar(client, me, { preset: 'cat' }), /其他设备/);
  assert.equal(state.profile.avatar_preset, 'moon'); assert.ok(state.files.has(oldPath));
});
test('failed cleanup is retryable without repeating mutation; active or foreign paths never removed', async () => {
  const { state, client } = fixture(); state.failRemove = true; const result = await changeAvatar(client, me, { preset: 'leaf' });
  assert.deepEqual(result.cleanupPaths, [oldPath]); assert.equal(state.profile.avatar_preset, 'leaf');
  state.failRemove = false; assert.deepEqual(await cleanupAvatarFiles(client, me, result.cleanupPaths), []); assert.equal(state.writes, 1); assert.equal(state.files.size, 0);
  state.profile.avatar_path = newPath; state.files.add(newPath); await cleanupAvatarFiles(client, me, [newPath, 'other/secret.jpg']); assert.ok(state.files.has(newPath));
});
test('reopening can discover abandoned photos but skips recent, active and malformed objects', async () => {
  const { client } = fixture(); const now = Date.UTC(2026, 9, 14);
  const original = client.storage.from();
  client.storage.from = () => ({ ...original, list: async () => ({ data: [
    { name: oldPath.split('/')[1], created_at: '2026-10-01T00:00:00Z' },
    { name: newPath.split('/')[1], created_at: '2026-10-01T00:00:00Z' },
    { name: 'bb000000-0000-4000-8000-000000000003.jpg', created_at: '2026-10-13T23:59:59Z' },
    { name: '../bad.jpg', created_at: '2026-10-01T00:00:00Z' },
  ], error: null }) });
  assert.deepEqual(await findUnusedAvatarPhotos(client, me, now), [newPath]);
});
