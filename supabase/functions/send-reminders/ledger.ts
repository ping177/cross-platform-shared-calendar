import type { DeliveryTask } from './logic.ts';

export const LEDGER_BATCH_SIZE = 20;
export type DeliveryIdentity = {
  event_id: string | null;
  important_date_id: string | null;
  task_id: string | null;
  occurrence_date: string | null;
  subscription_id: string;
  due_at: string;
};
export type LedgerIdentity = DeliveryIdentity & { status: string };
export function deliveryIdentity(task: DeliveryTask): DeliveryIdentity {
  return {
    event_id: 'eventId' in task ? task.recurrence?.logicalSeriesId ?? task.eventId : null,
    important_date_id: 'importantDate' in task ? task.importantDate.id : null,
    task_id: 'task' in task ? task.task.id : null,
    occurrence_date: 'task' in task ? task.task.occurrenceDate : 'importantDate' in task ? task.importantDate.occurrenceDate : task.recurrence?.occurrenceDate ?? null,
    subscription_id: task.subscription.id,
    due_at: task.dueAt.toISOString(),
  };
}
export function identityKey(identity: DeliveryIdentity) {
  // Sender due instants are millisecond-precise; never round a different SQL instant into a match.
  const fraction = identity.due_at.match(/\.(\d+)(?:Z|[+-]\d\d(?::?\d\d)?)$/)?.[1];
  if (fraction && /[1-9]/.test(fraction.slice(3))) throw new Error('Unexpected ledger due precision.');
  return JSON.stringify([identity.event_id, identity.important_date_id, identity.task_id,
    identity.occurrence_date, identity.subscription_id, new Date(identity.due_at).toISOString()]);
}
// All three states block a new claim under the existing UNIQUE identity + DO NOTHING contract.
// This is not a statement that claimed/failed notifications were delivered.
export function processedKeys(rows: LedgerIdentity[], requested: DeliveryIdentity[]) {
  const allowed = new Set(requested.map(identityKey));
  const result = new Set<string>();
  for (const row of rows) {
    if (!['claimed', 'sent', 'failed'].includes(row.status)) throw new Error('Unknown ledger state.');
    for (const field of Object.keys(requested[0] ?? {})) {
      const value = row[field as keyof DeliveryIdentity];
      if (value !== null && typeof value !== 'string') throw new Error('Incomplete ledger identity.');
    }
    const key = identityKey(row);
    if (!allowed.has(key) || result.has(key)) throw new Error('Unexpected ledger identity.');
    result.add(key);
  }
  return result;
}
export function ledgerFilter(identities: DeliveryIdentity[]) {
  if (!identities.length || identities.length > LEDGER_BATCH_SIZE) throw new Error('Invalid ledger batch.');
  const filter = identities.map(identity => 'and(' + Object.entries(identity).map(([column, value]) => {
    if (value === null) return column + '.is.null';
    const valid = column === 'due_at' ? /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
      : column === 'occurrence_date' ? /^\d{4}-\d\d-\d\d$/.test(value)
      : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    if (!valid) throw new Error('Invalid ledger query identity.');
    return column + '.eq.' + value;
  }).join(',') + ')').join(',');
  if (encodeURIComponent(filter).length > 6500) throw new Error('Ledger query too long.');
  return filter;
}
