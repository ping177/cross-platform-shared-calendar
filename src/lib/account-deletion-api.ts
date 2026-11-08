import { supabase } from './supabase';
import { isDeletionStatus, deletionRecoveryEnabled, type DeletionIntent, type DeletionProof, type DeletionStatus } from './account-deletion';
const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const mode = import.meta.env.VITE_ACCOUNT_DELETION_RUNTIME_MODE;
const enabled = import.meta.env.VITE_ACCOUNT_DELETION_ENABLED;
const pilotUserId = import.meta.env.VITE_ACCOUNT_DELETION_PILOT_USER_ID;
export const accountDeletionRecoveryEnabled = deletionRecoveryEnabled(mode, enabled, import.meta.env.DEV, url, typeof location === 'undefined' ? '' : location.hostname);
// This is a UI gate. Edge and database admission independently authorize the user.
export function canStartAccountDeletion(userId?: string): boolean {
  if (!accountDeletionRecoveryEnabled || !userId) return false;
  return enabled === 'true' || (mode === 'production' && enabled === 'false' &&
    userId === pilotUserId && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(userId));
}
export async function deletionRequest(body: Record<string, unknown>, userId?: string): Promise<Record<string, unknown>> {
  if (!accountDeletionRecoveryEnabled || (['begin','verify','confirm'].includes(body.action as string) && !canStartAccountDeletion(userId))) throw new Error('账号注销暂未开放。');
  let authorization = anon;
  if (userId) {
    const { data, error } = await supabase.auth.getUser();
    const session = await supabase.auth.getSession();
    if (error || data.user?.id !== userId || session.data.session?.user.id !== userId) throw new Error('登录身份已变化，请返回后重新验证。');
    authorization = session.data.session.access_token;
  }
  let response: Response;
  try { response = await fetch(url + '/functions/v1/account-deletion', { method: 'POST', headers: {
    apikey: anon, Authorization: 'Bearer ' + authorization, 'Content-Type': 'application/json',
  }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) }); }
  catch { throw new Error('网络连接中断，暂时无法确认结果，请重试查询。'); }
  if (!response.ok) {
    if (response.status === 403 && body.action === 'verify') throw new Error('验证码不正确、已过期或已使用，请检查或重新发送。');
    if (response.status === 409) throw new Error('验证或空间状态已变化，请重新检查空间并重新验证。');
    if (response.status === 401) throw new Error('登录身份已变化，请返回后重新验证。');
    if (response.status === 404 && body.action === 'receipt') throw new Error('状态回执已失效，暂时无法查询。请勿将此提示视为注销成功。');
    throw new Error('暂时无法确认操作结果，请稍后重试。');
  }
  let data: unknown;
  try { data = await response.json(); } catch { throw new Error('未能确认服务端结果，请重试查询。'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('未能确认服务端结果，请重试查询。');
  return data as Record<string, unknown>;
}
export async function beginDeletion(userId: string): Promise<DeletionIntent> {
  const data = await deletionRequest({ action: 'begin' }, userId);
  if (typeof data.request_id !== 'string' || typeof data.challenge_id !== 'string') throw new Error('无法确认验证请求，请重试。');
  return data as DeletionIntent;
}
export async function verifyDeletion(userId: string, intent: DeletionIntent, otp: string): Promise<DeletionProof> {
  const data = await deletionRequest({ action: 'verify', ...intent, otp }, userId);
  if (data.request_id !== intent.request_id || typeof data.confirmation_token !== 'string' || typeof data.receipt_token !== 'string') throw new Error('无法确认验证结果，请重新验证。');
  return data as DeletionProof;
}
export async function receiptStatus(token: string): Promise<DeletionStatus> {
  const data = await deletionRequest({ action: 'receipt', receipt_token: token });
  if (!isDeletionStatus(data.status)) throw new Error('无法确认注销状态，请稍后查询。');
  return data.status;
}
