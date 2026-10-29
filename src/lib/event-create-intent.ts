// One mounted EventSheet's create attempt, never a persistent cache or edit authority.
export type EventCreatePayload = Record<string, unknown> & { space_id: string; created_by: string };
type Result = { error: unknown };
type Operations = {
  verify: (original: EventCreatePayload) => Promise<boolean>;
  insert: (payload: EventCreatePayload & { id: string }) => Promise<Result>;
  read: (id: string, spaceId: string) => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
};
export const uncertainCreateMessage = '创建结果尚未确认。请保留此表单，重试将核对原始提交，不会另建日程；暂不能修改内容或空间。';
export const abandonCreateMessage = '创建结果尚未确认，日程可能已保存。关闭后不会恢复本次创建意图，重新新建可能重复。确定关闭吗？';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
function matches(row: Record<string, unknown>, expected: EventCreatePayload & { id: string }) {
  if (row.recurrence_until != null || row.parent_event_id != null || (row.series_id != null && row.series_id !== expected.id)) return false;
  return Object.entries(expected).every(([key, value]) => {
    if ((key === 'starts_at' || key === 'ends_at') && typeof value === 'string') {
      return typeof row[key] === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(row[key] as string) === Date.parse(value);
    }
    return canonical(row[key]) === canonical(value);
  });
}
export function createEventIntent(uuid = () => crypto.randomUUID()) {
  let attempt: (EventCreatePayload & { id: string }) | null = null;
  let running = false;
  let complete = false;
  return {
    get pending() { return Boolean(attempt && !complete); },
    async save(payload: EventCreatePayload, operations: Operations) {
      if (running) throw new Error('正在确认创建结果，请稍候。');
      if (attempt && (payload.space_id !== attempt.space_id || payload.created_by !== attempt.created_by)) throw new Error(uncertainCreateMessage);
      if (complete) return;
      running = true;
      try {
        if (!await operations.verify(attempt ?? payload)) throw new Error('登录状态、空间或成员权限已变化，请重新确认。');
        const original = attempt ?? { ...JSON.parse(JSON.stringify(payload)) as EventCreatePayload, id: uuid() };
        attempt = original;
        let saved = false;
        try { saved = !(await operations.insert({ ...original })).error; } catch { /* Reconcile an ambiguous transport result below. */ }
        if (!saved) {
          const result = await operations.read(original.id, original.space_id);
          saved = !result.error && Boolean(result.data && matches(result.data, original));
        }
        if (!saved || !await operations.verify(original)) throw new Error(uncertainCreateMessage);
        complete = true;
      } catch (error) {
        if (attempt) throw new Error(uncertainCreateMessage);
        throw error;
      } finally { running = false; }
    },
  };
}
