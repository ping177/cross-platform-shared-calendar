import assert from 'node:assert/strict';
import test from 'node:test';
import { scanReminderCandidates } from '../supabase/functions/send-reminders/logic.ts';

// Future Important Date RPC caller uses the existing scanner unchanged.
const candidates = (count: number) => Array.from({ length: count }, (_, index) => ({
  id: `95000000-0000-4000-8001-${String(index + 1).padStart(12, '0')}`,
  reminder_schedule_changed_at: '2026-10-01T12:34:56.123456+00:00',
}));

for (const count of [0, 100, 1000, 1001]) {
  test(`Important Date candidate scan ${count}: complete result or explicit overflow`, async () => {
    const rows = candidates(count);
    const requests: { afterId: string | null; limit: number }[] = [];
    const result = await scanReminderCandidates(async request => {
      requests.push(request);
      return rows.filter(row => request.afterId === null || row.id > request.afterId).slice(0, request.limit);
    });
    assert.equal(result.candidatesScanned, count);
    assert.equal(result.candidateTruncated, count > 1000);
    assert.equal(result.candidates.length, Math.min(count, 1000));
    for (const row of result.candidates) {
      assert.equal(row.reminder_schedule_changed_at, '2026-10-01T12:34:56.123456+00:00');
    }
    if (count >= 1000) assert.equal(requests.at(-1)?.limit, 1);
  });
}

test('Important Date candidate page anomalies fail rather than silently skip', async () => {
  await assert.rejects(scanReminderCandidates(async () => candidates(101)), /exceeded the requested limit/);
  const rows = candidates(100);
  await assert.rejects(scanReminderCandidates(async () => rows.toReversed()), /strictly ordered/);
  await assert.rejects(scanReminderCandidates(async () => [rows[0], rows[0]]), /strictly ordered/);
  await assert.rejects(scanReminderCandidates(async () => rows), /strictly ordered/);
  await assert.rejects(scanReminderCandidates(async () => { throw new Error('RPC unavailable'); }), /RPC unavailable/);
});
