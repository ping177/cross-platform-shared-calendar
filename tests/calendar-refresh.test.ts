import assert from 'node:assert/strict';
import test from 'node:test';
import { createCalendarReadLoop } from '../src/lib/calendar-refresh.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test('dirty read cannot commit and is followed by one authoritative reread', async () => {
  const first = deferred();
  const commits: number[] = [];
  let reads = 0;
  const loop = createCalendarReadLoop(async (isCurrent) => {
    reads += 1;
    if (reads === 1) await first.promise;
    if (isCurrent()) commits.push(reads);
  }, () => undefined, 1);
  loop.start();
  await new Promise((resolve) => setTimeout(resolve, 5));
  loop.change(); loop.change(); loop.change();
  first.resolve();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.deepEqual(commits, [2]);
  assert.equal(reads, 2);
  loop.stop();
});

test('pause and stop invalidate late reads and block scheduled refreshes', async () => {
  const pending = deferred();
  let committed = false;
  let reads = 0;
  const loop = createCalendarReadLoop(async (isCurrent) => {
    reads += 1;
    await pending.promise;
    if (isCurrent()) committed = true;
  }, () => undefined, 1);
  loop.start();
  await new Promise((resolve) => setTimeout(resolve, 5));
  loop.pause();
  pending.resolve();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(committed, false);
  loop.stop();
  loop.change();
  assert.equal(reads, 1);
});

test('a failed refresh reports error and an explicit retry can recover', async () => {
  let attempts = 0;
  const errors: unknown[] = [];
  let committed = false;
  const loop = createCalendarReadLoop(async (isCurrent) => {
    attempts += 1;
    if (attempts === 1) throw new Error('page failed');
    if (isCurrent()) committed = true;
  }, (error) => errors.push(error), 1);
  loop.start();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(errors.length, 1);
  loop.change();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(attempts, 2);
  assert.equal(committed, true);
  loop.stop();
});
