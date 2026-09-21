import { calculateReminderDue } from '../supabase/functions/_shared/reminder-due.ts';

const iterations = 1_000;
const input = {
  startsAt: '2026-03-09T06:30:00.000Z',
  allDay: false,
  reminderKind: 'timed_previous_day_same_time' as const,
  timeZone: 'America/New_York',
};

calculateReminderDue(input);

const startedAt = performance.now();
for (let index = 0; index < iterations; index += 1) {
  calculateReminderDue(input);
}
const elapsedMs = performance.now() - startedAt;

console.log(JSON.stringify({
  runtime: typeof Deno === 'undefined' ? 'node' : 'deno',
  scenario: 'dst-gap-previous-day',
  iterations,
  elapsed_ms: Math.round(elapsedMs * 100) / 100,
}));
