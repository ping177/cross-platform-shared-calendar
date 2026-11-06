// Receipt is a read-only status capability, never an acceptance credential.
export type DeletionStatus = 'preparing' | 'accepted' | 'processing' | 'needs_attention' | 'completed';
export type DeletionReceipt = { token: string; expires: number; binding: string };
export type DeletionIntent = { request_id: string; challenge_id: string };
export type DeletionProof = { request_id: string; confirmation_token: string; receipt_token: string };
const hex = /^[0-9a-f]{64}$/;
export const deletionReceiptKey = 'calendar.deletion-receipt.v1';
export const deletionReceiptEvent = 'calendar:deletion-receipt';
export function localDeletionEnabled(enabled: unknown, development: boolean, backend: string, host: string) {
  try { const url = new URL(backend); return development && enabled === 'true' && ['127.0.0.1','localhost'].includes(host)
    && url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname); } catch { return false; }
}
export function deletionRecoveryEnabled(mode: unknown, enabled: unknown, development: boolean, backend: string, host: string) {
  if (mode === 'production') return backend === 'https://ximazjhxvmktpcdbypka.supabase.co'
    && host === 'cross-platform-shared-calendar.vercel.app';
  return localDeletionEnabled(enabled, development, backend, host);
}
export function readDeletionReceipt(storage: Pick<Storage,'getItem'>, now = Date.now()): DeletionReceipt | null {
  try { const value = JSON.parse(storage.getItem(deletionReceiptKey) ?? 'null');
    return value && hex.test(value.token) && hex.test(value.binding) && Number.isFinite(value.expires) && value.expires > now ? { token: value.token, expires: value.expires, binding: value.binding } : null;
  } catch { return null; }
}
export function writeDeletionReceipt(storage: Pick<Storage,'setItem'|'getItem'>, token: string, binding: string) {
  if (!hex.test(token) || !hex.test(binding)) throw new Error('状态回执无效，请重新验证。');
  const receipt = { token, expires: Date.now() + 7 * 86400_000, binding };
  try { storage.setItem(deletionReceiptKey, JSON.stringify(receipt)); } catch { throw new Error('此设备无法保存注销进度，请先恢复浏览器存储后重试。'); }
  if (readDeletionReceipt(storage)?.token !== token) throw new Error('此设备无法保存注销进度，请先恢复浏览器存储后重试。');
  return receipt;
}
export function isDeletionStatus(value: unknown): value is DeletionStatus {
  return ['preparing','accepted','processing','needs_attention','completed'].includes(value as string);
}
export function deletionStatusCopy(status: DeletionStatus | 'unknown') {
  return {
    unknown: ['正在核对注销状态', '暂时无法确认处理结果，请恢复网络后重新查询。请勿重复发起注销。'],
    preparing: ['正在核对受理结果', '尚未确认注销已受理。请重新查询，或先由服务端核实未受理再返回。'],
    accepted: ['注销处理中', '请求已受理，无法取消。你可以关闭 App，后台会继续处理。'],
    processing: ['注销处理中', '请求已受理，无法取消。你可以关闭 App，后台会继续处理。'],
    needs_attention: ['注销尚未完成', '处理遇到异常，账号已暂停使用。请稍后查询进度。'],
    completed: ['账号已注销', '原账号、个人空间和私人数据已删除，无法恢复。'],
  }[status];
}

export async function receiptAccountBinding(userId: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId)));
  return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function clearDeletionPreferences(storage: Pick<Storage,'length'|'key'|'removeItem'>, binding: string) {
  const keys = Array.from({length:storage.length},(_,index)=>storage.key(index)).filter((key):key is string=>Boolean(key));
  for (const key of keys) {
    const prefix = key.startsWith('selectedSpaceId:') ? 'selectedSpaceId:' : key.startsWith('navigation:') ? 'navigation:' : null;
    if (prefix && await receiptAccountBinding(key.slice(prefix.length)) === binding) storage.removeItem(key);
  }
}
