import assert from 'node:assert/strict';
import test from 'node:test';
import { scanReminderCandidates } from '../supabase/functions/send-reminders/logic.ts';
import { fetchImportantDateReminderCandidatePage } from '../supabase/functions/send-reminders/important-date-claim.ts';

// Important Date RPC caller uses the existing scanner unchanged.
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

test('candidate RPC forwards bounded keyset arguments/raw marker and rejects incomplete transport results', async () => {
  const row = { ...candidates(1)[0], space_id: 'space', name: 'Date', repeat_kind: 'annual', month: 10, day: 2,
    year: null, reminder_kind: 'all_day_same_day_08', time_zone: 'UTC' };
  const page = await fetchImportantDateReminderCandidatePage(async (name, args) => {
    assert.equal(name, 'list_important_date_reminder_candidates');
    assert.deepEqual(args, { p_after_id: null, p_limit: 100 });
    return { data: [row], error: null };
  }, { afterId: null, limit: 100 });
  assert.deepEqual(page, [row]);
  for (const data of [null, undefined, {}, [null], [{ id: row.id }],
    [{ ...row, year: undefined }], [{ ...row, reminder_kind: undefined }],
    [{ ...row, reminder_kind: null }], [{ ...row, time_zone: undefined }]]) {
    await assert.rejects(fetchImportantDateReminderCandidatePage(async () => ({ data, error: null }),
      { afterId: row.id, limit: 1 }), /candidate scan failed/);
  }
  await assert.rejects(fetchImportantDateReminderCandidatePage(async () => ({ data: [row], error: {} }),
    { afterId: null, limit: 100 }), /candidate scan failed/);
  await assert.rejects(fetchImportantDateReminderCandidatePage(async () => { throw new Error('private transport'); },
    { afterId: null, limit: 100 }), error => error instanceof Error && error.message === 'Important Date candidate scan failed.');
});
