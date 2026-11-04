import { syntheticExport, syntheticActor } from './data-export-synthetic.ts';

export function personalExportClient(total = 1, cap = 500) {
  const source = syntheticExport().spaces[1].tables;
  const spaceId = '10000000-0000-4000-8000-000000000001';
  const rows = { spaces: [{ ...source.space[0], id: spaceId, kind: 'personal' }], space_members: [{ ...source.members[0], space_id: spaceId }],
    events: Array.from({ length: total }, (_, i) => ({ ...source.events[1], id: `40000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, space_id: spaceId, series_id: null, recurrence_until: null })), event_occurrence_exceptions: [],
    space_modules: [], tasks: [], lists: [], list_sections: [], list_items: [], important_dates: [] };
  const state = { user: syntheticActor, cap, calls: [], fail: '', drift: false, nullData: false, duplicate: false, blocked: false, release: null };
  const authListeners = new Set<any>(), permissionListeners = new Set<any>();
  const emitAuth = () => authListeners.forEach(callback => callback(state.user ? 'SIGNED_IN' : 'SIGNED_OUT', state.user ? { user: { id: state.user } } : null));
  const emitPermission = () => permissionListeners.forEach(callback => callback());
  const client = { auth: { onAuthStateChange(callback) { authListeners.add(callback); return { data: { subscription: { unsubscribe() { authListeners.delete(callback); } } } }; }, async getUser() { return { data: { user: state.user ? { id: state.user } : null }, error: null }; } },
    channel() { const callbacks = []; return { on(_event, _filter, callback) { callbacks.push(callback); permissionListeners.add(callback); return this; }, subscribe() { return this; }, callbacks }; },
    removeChannel(channel) { channel.callbacks.forEach(callback => permissionListeners.delete(callback)); }, from(table) {
    const filters = []; let head = false, columns = '';
    const query = { select(value, options) { columns = value; head = options?.head === true; return query; }, eq(key, value) { filters.push([key, [value]]); return query; }, in(key, values) { filters.push([key, values]); return query; }, order() { return query; }, abortSignal() { return query; },
      async range(start, end) {
        state.calls.push({ table, start, end, columns, head });
        if (state.blocked && table === 'events') await new Promise(resolve => { state.release = resolve; });
        let selected = rows[table].filter(row => filters.every(([key, values]) => values.includes(row[key])));
        if (state.fail === table) return { data: null, count: null, error: Error('read failed') };
        const count = selected.length + (state.drift && table === 'events' && start ? 1 : 0);
        let data = selected.slice(start, Math.min(end + 1, start + state.cap));
        if (state.duplicate && table === 'events' && start) data = selected.slice(0, data.length);
        return { data: state.nullData ? null : head ? null : data, count, error: null };
      }, then(resolve, reject) { return query.range(0, 499).then(resolve, reject); } };
    return query;
  } };
  return { client, state, rows, spaceId, emitAuth, emitPermission };
}
