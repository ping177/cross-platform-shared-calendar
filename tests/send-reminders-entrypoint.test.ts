import assert from 'node:assert/strict';
import test from 'node:test';

// Synthetic service configuration and a fully intercepted fetch: no environment
// file, network, provider call or real backend is used by this entrypoint test.
const sourceId = '93000000-0000-4000-8000-000000000001';
const spaceId = '93000000-0000-4000-8000-000000000002';
const memberId = '93000000-0000-4000-8000-000000000003';
const subscriptionId = '93000000-0000-4000-8000-000000000004';
const deliveryId = '93000000-0000-4000-8000-000000000005';
const marker = '2000-01-01T00:00:00.123456+00:00';
let handler: (request: Request) => Promise<Response>;
const values: Record<string, string> = { REMINDER_CRON_SECRET: 'synthetic-cron', SUPABASE_URL: 'https://backend.example.invalid',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service', VAPID_SUBJECT: 'mailto:test@example.invalid',
  VAPID_PUBLIC_KEY: 'synthetic-public', VAPID_PRIVATE_KEY: 'synthetic-private' };
Object.assign(globalThis, { Deno: { env: { get: (name: string) => values[name] },
  serve: (callback: typeof handler) => { handler = callback; } } });
await import('../supabase/functions/send-reminders/index.ts');

test('entrypoint wires candidate/claim/check RPCs and failed finalize without provider dispatch', async () => {
  for (const mode of ['reject', 'check-error', 'scan-incomplete', 'event-incomplete', 'recurring-incomplete', 'exception-incomplete', 'exception-duplicate'] as const) {
    const calls: { path: string; body: unknown }[] = [];
    const originalFetch = globalThis.fetch;
    const FixedDate = class extends Date { constructor(value?: string | number) { super(value ?? '2026-10-02T08:05:00Z'); } };
    const OriginalDate = globalThis.Date;
    globalThis.Date = FixedDate as DateConstructor;
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.hostname, 'backend.example.invalid');
      const path = url.pathname;
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ path, body });
      let data: unknown;
      if (path.endsWith('/events')) {
        const repeating = url.searchParams.get('recurrence_rule') === 'not.is.null';
        data = (mode === 'event-incomplete' && !repeating) || (mode === 'recurring-incomplete' && repeating) ? null
          : repeating && mode.startsWith('exception-') ? [{ id: sourceId, space_id: spaceId }] : [];
      }
      else if (path.endsWith('/event_occurrence_exceptions')) data = mode === 'exception-incomplete' ? null : [{ id: sourceId }, { id: sourceId }];
      else if (path.endsWith('/list_important_date_reminder_candidates')) data = mode === 'scan-incomplete' ? null : [{
        id: sourceId, space_id: spaceId, name: 'Important date', repeat_kind: 'annual', month: 10, day: 2, year: null,
        reminder_kind: 'all_day_same_day_08', time_zone: 'UTC', reminder_schedule_changed_at: marker }];
      else if (path.endsWith('/space_members')) data = [{ space_id: spaceId, user_id: memberId }];
      else if (path.endsWith('/push_subscriptions')) data = [{ id: subscriptionId, user_id: memberId, installation_id: subscriptionId,
        endpoint: 'https://fcm.googleapis.com/fixture', p256dh: 'fake', auth: 'fake', expiration_time: null, disabled_at: null }];
      else if (path.endsWith('/claim_important_date_reminder_delivery')) data = deliveryId;
      else if (path.endsWith('/check_important_date_reminder_delivery')) {
        if (mode === 'check-error') return new Response(JSON.stringify({ code: 'XX000', message: 'synthetic error' }), { status: 500 });
        data = false;
      } else if (path.endsWith('/reminder_deliveries')) data = [{ id: deliveryId }];
      else assert.fail(`Unexpected route ${path}`);
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    try {
      const response = await handler(new Request('https://function.example.invalid', { method: 'POST',
        headers: { Authorization: 'Bearer synthetic-cron' } }));
      const result = await response.json();
      const incomplete = mode.endsWith('incomplete') || mode === 'exception-duplicate';
      assert.equal(response.status, incomplete ? 500 : 200);
      const call = (name: string) => calls.find(entry => entry.path.endsWith(`/${name}`));
      assert.deepEqual(call('list_important_date_reminder_candidates')?.body, { p_after_id: null, p_limit: 100 });
      if (incomplete) { assert.equal(call('claim_important_date_reminder_delivery'), undefined); continue; }
      assert.equal(result.failed, 1); assert.equal(result.sent, 0);
      assert.deepEqual(call('claim_important_date_reminder_delivery')?.body, { p_important_date_id: sourceId,
        p_occurrence_date: '2026-10-02', p_recipient_user_id: memberId, p_subscription_id: subscriptionId,
        p_due_at: '2026-10-02T08:00:00.000Z', p_expected_reminder_kind: 'all_day_same_day_08',
        p_expected_reminder_schedule_changed_at: marker });
      assert.deepEqual(call('check_important_date_reminder_delivery')?.body, { p_delivery_id: deliveryId,
        p_expected_reminder_kind: 'all_day_same_day_08', p_expected_reminder_schedule_changed_at: marker });
      assert.deepEqual(call('reminder_deliveries')?.body, { status: 'failed', result_code: 'unexpected_task_error', provider_status: null });
      assert.ok(!calls.some(entry => entry.path.endsWith('/important_dates')));
    } finally { globalThis.fetch = originalFetch; globalThis.Date = OriginalDate; }
  }
});
