import type { SupabaseClient } from '@supabase/supabase-js';

type Job = { request_id: string; user_id: string; generation: number; lease_token: string; phase: string };
class ExecutionFailure extends Error {
  readonly attention: boolean;
  constructor(attention: boolean) { super('Execution deferred.'); this.attention = attention; }
}
async function rpc(client: SupabaseClient, name: string, args?: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new ExecutionFailure(['P0001','23503','23514','42501'].includes(error.code));
  return data;
}
function lease(job: Job) {
  return { p_request_id: job.request_id, p_generation: job.generation, p_lease_token: job.lease_token };
}
async function storagePage(client: SupabaseClient, job: Job, remove: boolean): Promise<boolean> {
  const bucket = client.storage.from('profile-avatars');
  const { data, error } = await bucket.list(job.user_id, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } });
  if (error || !Array.isArray(data)) throw new ExecutionFailure(false);
  if (!data.length) return true;
  if (!remove || data.some(file => !file.id || !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(file.name))) throw new ExecutionFailure(true);
  const { error: deletionError } = await bucket.remove(data.map(file => job.user_id + '/' + file.name));
  if (deletionError) throw new ExecutionFailure(false);
  // Always re-read page zero: offsets would skip objects while deleting.
  const next = await bucket.list(job.user_id, { limit: 1, offset: 0 });
  if (next.error || !Array.isArray(next.data)) throw new ExecutionFailure(false);
  return next.data.length === 0;
}
async function authAbsent(client: SupabaseClient, userId: string) {
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error) {
    if (error.status === 404 && error.code === 'user_not_found') return true;
    throw new ExecutionFailure(false);
  }
  if (!data.user || data.user.id !== userId) throw new ExecutionFailure(true);
  return false;
}

// No caller-selected target, path, stage or request. A wake claims one due job.
// Fencing protects DB progress; repeated external calls remain fixed-target and
// idempotent even if an already-started request outlives a client timeout/lease.
export async function executeOneDeletion(client: SupabaseClient) {
  const job = await rpc(client, 'claim_account_deletion') as Job | null;
  if (!job) return { status: 'idle' };
  try {
    const checked = await rpc(client, 'check_deletion_execution', lease(job));
    if (checked.user_id !== job.user_id || checked.phase !== job.phase) throw new ExecutionFailure(true);
    let stage = job.phase;
    if (stage === 'storage') {
      if (!await storagePage(client, job, true)) {
        await rpc(client, 'release_deletion_execution', { ...lease(job), p_attention: false });
        return { status: 'pending' };
      }
    } else if (stage === 'business') {
      // The leased DB wrapper reuses the existing atomic restricted cleanup.
    } else if (stage === 'auth') {
      if (!await authAbsent(client, job.user_id)) {
        await rpc(client, 'check_deletion_execution', lease(job));
        const { error } = await client.auth.admin.deleteUser(job.user_id, false);
        if (error && !(error.status === 404 && error.code === 'user_not_found')) throw new ExecutionFailure(false);
      }
      if (!await authAbsent(client, job.user_id)) throw new ExecutionFailure(false);
    } else if (stage === 'verify') {
      if (!await storagePage(client, job, false) || !await authAbsent(client, job.user_id)) throw new ExecutionFailure(true);
      stage = 'complete';
    } else throw new ExecutionFailure(true);
    await rpc(client, 'advance_deletion_execution', { ...lease(job), p_stage: stage });
    return { status: 'processed' };
  } catch (error) {
    try {
      await rpc(client, 'release_deletion_execution', { ...lease(job), p_attention: error instanceof ExecutionFailure && error.attention });
    } catch { /* Expired/stale lease or DB outage: next independent wake reclaims. */ }
    return { status: 'deferred' }; // no raw provider/body/UUID/token disclosure
  }
}

export function wakeAuthorized(authorization: string | null, expected: string | undefined): boolean {
  if (!expected || !/^[0-9a-f]{64}$/.test(expected) || !authorization?.startsWith('Bearer ')) return false;
  const supplied = authorization.slice(7);
  if (supplied.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= supplied.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}
