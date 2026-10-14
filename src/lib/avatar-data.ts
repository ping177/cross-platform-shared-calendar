import type { SupabaseClient } from '@supabase/supabase-js';
import { avatarBucket, avatarPreset, avatarUploadMaxBytes, isAvatarPath } from './avatar.ts';
import { profileColumns, readProfile, requireProfileOwner, type Profile } from './profile.ts';

export type AvatarChoice = { preset: string | null } | { photo: Blob };
export class AvatarSaveError extends Error {
  cleanupPaths: string[];
  constructor(message: string, cleanupPaths: string[] = []) { super(message); this.cleanupPaths = cleanupPaths; }
}

// Recover abandoned uploads after a failed/offline cleanup without persistent browser data.
// Recent objects may belong to an in-flight upload on another device; leave those alone.
export async function findUnusedAvatarPhotos(client: SupabaseClient, userId: string, now = Date.now()): Promise<string[]> {
  await requireProfileOwner(client, userId);
  const current = await readProfile(client, userId);
  const { data, error } = await client.storage.from(avatarBucket).list(userId, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });
  if (error) throw new Error('暂时无法检查旧照片，请稍后重试。');
  return (data ?? []).filter((file) => file.created_at && Date.parse(file.created_at) < now - 86_400_000)
    .map((file) => `${userId}/${file.name}`).filter((path) => isAvatarPath(path, userId) && path !== current.avatar_path);
}

// Re-read first: uncertain writes or a concurrent device must never cause an active photo to be deleted.
export async function cleanupAvatarFiles(client: SupabaseClient, userId: string, paths: string[]): Promise<string[]> {
  const remaining: string[] = [];
  for (const path of new Set(paths)) {
    if (!isAvatarPath(path, userId)) continue;
    try {
      await requireProfileOwner(client, userId);
      const current = await readProfile(client, userId);
      if (current.avatar_path === path) continue;
      const { error } = await client.storage.from(avatarBucket).remove([path]);
      if (error) remaining.push(path);
    } catch { remaining.push(path); }
  }
  return remaining;
}

export async function changeAvatar(client: SupabaseClient, userId: string, choice: AvatarChoice, createId = () => crypto.randomUUID()): Promise<{ profile: Profile; cleanupPaths: string[] }> {
  await requireProfileOwner(client, userId);
  const previous = await readProfile(client, userId);
  let uploaded: string | null = null;
  let metadataUnconfirmed = false;
  const next = { avatar_preset: null as string | null, avatar_path: null as string | null };
  if ('preset' in choice) {
    if (choice.preset !== null && !avatarPreset(choice.preset)) throw new AvatarSaveError('请选择有效的预设头像。');
    next.avatar_preset = choice.preset;
  } else {
    if (choice.photo.type !== 'image/jpeg' || !choice.photo.size || choice.photo.size > avatarUploadMaxBytes) throw new AvatarSaveError('请重新选择并处理照片。');
    uploaded = `${userId}/${createId()}.jpg`;
    if (!isAvatarPath(uploaded, userId)) throw new AvatarSaveError('无法生成照片路径，请重新登录后再试。');
    next.avatar_path = uploaded;
  }
  if (next.avatar_preset === previous.avatar_preset && next.avatar_path === previous.avatar_path) return { profile: previous, cleanupPaths: [] };
  try {
    if (uploaded && 'photo' in choice) {
      const { error } = await client.storage.from(avatarBucket).upload(uploaded, choice.photo, { contentType: 'image/jpeg', cacheControl: '60', upsert: false });
      if (error) throw new AvatarSaveError('照片上传失败，请重试。');
    }
    let query = client.from('profiles').update(next).eq('id', userId);
    for (const column of ['avatar_path', 'avatar_preset'] as const) query = previous[column] === null ? query.is(column, null) : query.eq(column, previous[column]);
    metadataUnconfirmed = true;
    const { data, error } = await query.select(profileColumns).maybeSingle();
    if (error) throw new AvatarSaveError('头像保存未确认，请重试或重新读取资料。');
    metadataUnconfirmed = false;
    if (!data) throw new AvatarSaveError('头像已在其他设备更新，请关闭面板并重新读取资料后再试。');
    const cleanupPaths = previous.avatar_path && previous.avatar_path !== next.avatar_path ? await cleanupAvatarFiles(client, userId, [previous.avatar_path]) : [];
    return { profile: data as Profile, cleanupPaths };
  } catch (failure) {
    // A lost response may precede a late commit; even a fresh read can still see
    // the old profile. Let the existing >24h unused-file scan recover this upload.
    const cleanupPaths = uploaded && !metadataUnconfirmed ? await cleanupAvatarFiles(client, userId, [uploaded]) : [];
    throw new AvatarSaveError(failure instanceof Error ? failure.message : '头像保存失败，请重试。', cleanupPaths);
  }
}
