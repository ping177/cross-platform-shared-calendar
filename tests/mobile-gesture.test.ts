import assert from 'node:assert/strict';
import test from 'node:test';
import { createSwipeRecognizer, createSwipeClickGuard, isSwipeTargetExcluded, isSwipeSurfaceBlocked } from '../src/lib/mobile-swipe.ts';
import { navigateCalendarPeriod } from '../src/lib/date.ts';

const content = { closest: () => null } as unknown as Element;
function pointer(x = 0, y = 0, timeStamp = 0, pointerId = 1, target = content) {
  return { clientX: x, clientY: y, timeStamp, pointerId, pointerType: 'touch', isPrimary: pointerId === 1, target };
}
function fixture(direction: 'right' | 'both' = 'both') {
  const calls: string[] = [];
  const guard = createSwipeClickGuard();
  const options = { enabled: true, scope: 'calendar', direction, onSwipe: (d: string) => calls.push(d), clickGuard: guard };
  const gesture = createSwipeRecognizer(() => options);
  return { options, calls, guard, gesture };
}
function swipe(f: ReturnType<typeof fixture>, x = 80) {
  f.gesture.onPointerDown(pointer()); f.gesture.onPointerMove(pointer(x, 2, 150)); f.gesture.onPointerUp(pointer(x, 2, 200));
}
function click(guard: ReturnType<typeof createSwipeClickGuard>, props: Record<string, unknown> = {}) {
  let stopped = false;
  guard.onClickCapture({ detail: 1, timeStamp: 210, clientX: 80, clientY: 2,
    nativeEvent: { pointerId: 1, pointerType: 'touch', isTrusted: true },
    preventDefault() { stopped = true; }, stopPropagation() {}, ...props });
  return stopped;
}

for (const mode of ['today', 'week', 'month'] as const) test(`${mode}: button-equivalent previous and next periods`, () => {
  const day = new Date(2026, 9, 15, 12);
  assert.equal(navigateCalendarPeriod(day, mode, -1).getDate(), mode === 'today' ? 14 : mode === 'week' ? 8 : 15);
  assert.equal(navigateCalendarPeriod(day, mode, 1).getDate(), mode === 'today' ? 16 : mode === 'week' ? 22 : 15);
  if (mode === 'month') {
    assert.equal(navigateCalendarPeriod(day, mode, -1).getMonth(), 8);
    assert.equal(navigateCalendarPeriod(day, mode, 1).getMonth(), 10);
  }
  assert.equal(day.getMonth(), 9); assert.equal(day.getDate(), 15);
});
test('calendar directions and list right-only navigation', () => {
  const calendar = fixture(); swipe(calendar); swipe(calendar, -80);
  assert.deepEqual(calendar.calls, ['right', 'left']);
  const list = fixture('right'); swipe(list, -80); swipe(list);
  assert.deepEqual(list.calls, ['right']);
});
test('tap, mouse, vertical-first, excessive drift and cancellation never navigate', () => {
  const f = fixture();
  f.gesture.onPointerDown(pointer()); f.gesture.onPointerUp(pointer(2, 2, 100)); assert.equal(click(f.guard), false);
  f.gesture.onPointerDown({ ...pointer(), pointerType: 'mouse' }); f.gesture.onPointerUp(pointer(80, 0, 200));
  f.gesture.onPointerDown(pointer()); f.gesture.onPointerMove(pointer(5, 20, 50)); f.gesture.onPointerUp(pointer(100, 0, 200));
  f.gesture.onPointerDown(pointer()); f.gesture.onPointerMove(pointer(80, 35, 50)); f.gesture.onPointerUp(pointer(100, 0, 200));
  f.gesture.onPointerDown(pointer()); f.gesture.onPointerCancel(pointer()); f.gesture.onPointerUp(pointer(80, 0, 200));
  assert.deepEqual(f.calls, []); assert.equal(click(f.guard), false);
});
test('multi-touch and non-primary starts cancel; next ordinary swipe recovers', () => {
  const f = fixture();
  f.gesture.onPointerDown(pointer()); f.gesture.onPointerDown(pointer(10, 0, 10, 2));
  f.gesture.onPointerUp(pointer(80, 0, 200)); f.gesture.onPointerUp(pointer(90, 0, 200, 2));
  f.gesture.onPointerDown(pointer(0, 0, 0, 2)); f.gesture.onPointerUp(pointer(80, 0, 200, 2));
  assert.deepEqual(f.calls, []); swipe(f); assert.deepEqual(f.calls, ['right']);
});
test('busy or scope changes invalidate an in-flight gesture', () => {
  const f = fixture(); f.gesture.onPointerDown(pointer()); f.options.enabled = false;
  f.gesture.onPointerUp(pointer(80, 0, 200)); assert.deepEqual(f.calls, []); assert.equal(click(f.guard), false);
  f.options.enabled = true; f.gesture.onPointerDown(pointer()); f.options.scope = 'other';
  f.gesture.onPointerUp(pointer(80, 0, 200)); assert.deepEqual(f.calls, []);
});
test('successful swipe suppresses one matching trailing click, survives recognizer reset, preserves next tap and keyboard', () => {
  const f = fixture(); swipe(f); f.gesture.reset();
  assert.equal(click(f.guard, { detail: 0 }), false); assert.equal(click(f.guard), true); assert.equal(click(f.guard), false);
  swipe(f); f.guard.onPointerDownCapture(); assert.equal(click(f.guard), false);
});
test('obvious horizontal intent suppresses click even when short, reversed or slow; vertical invalidation does not', () => {
  for (const [end, time] of [[40, 200], [0, 200], [80, 900]]) {
    const f = fixture(); f.gesture.onPointerDown(pointer()); f.gesture.onPointerMove(pointer(40, 0, 100));
    f.gesture.onPointerUp(pointer(end, 0, time));
    assert.equal(click(f.guard, { clientX: end, clientY: 0, timeStamp: time + 10 }), true); assert.deepEqual(f.calls, []);
  }
  const f = fixture(); f.gesture.onPointerDown(pointer()); f.gesture.onPointerMove(pointer(40, 0, 100));
  f.gesture.onPointerMove(pointer(40, 40, 150)); f.gesture.onPointerUp(pointer(80, 0, 200)); assert.equal(click(f.guard), false);
});
test('older MouseEvent click fallback, unrelated and stale clicks', () => {
  const f = fixture(); swipe(f);
  assert.equal(click(f.guard, { nativeEvent: { pointerType: 'mouse', isTrusted: true } }), false);
  assert.equal(click(f.guard, { nativeEvent: { isTrusted: true }, clientX: 200 }), false);
  assert.equal(click(f.guard, { nativeEvent: { isTrusted: true } }), true);
  swipe(f); assert.equal(click(f.guard, { timeStamp: 1300 }), false);
});
test('display card opt-in never overrides input, dialog, disabled, drag or no-swipe exclusions', () => {
  const optIn = { closest: () => ({}) };
  const target = (hard: boolean, approved: boolean) => ({ closest(selector: string) {
    if (selector.includes('textarea')) return hard ? {} : null;
    return approved ? optIn : { closest: () => null };
  } }) as unknown as Element;
  assert.equal(isSwipeTargetExcluded(target(false, true)), false);
  assert.equal(isSwipeTargetExcluded(target(false, false)), true);
  assert.equal(isSwipeTargetExcluded(target(true, true)), true);
});

for (const selector of ['input', 'textarea', 'select', '[data-no-swipe]', ':disabled', '[role="dialog"]', '[aria-modal="true"]', '[draggable="true"]', '[data-rfd-drag-handle-draggable-id]', '[role="checkbox"]', '[contenteditable]:not([contenteditable="false"])']) {
  test(`hard exclusion ${selector} survives display-card opt-in`, () => {
    const target = { closest(list: string) { return list.split(',').includes(selector) ? {} : { closest: () => ({}) }; } } as unknown as Element;
    assert.equal(isSwipeTargetExcluded(target), true);
    const f = fixture(); f.gesture.onPointerDown(pointer(0, 0, 0, 1, target)); f.gesture.onPointerUp(pointer(80, 0, 200, 1, target));
    assert.deepEqual(f.calls, []); assert.equal(click(f.guard), false);
  });
}
test('Portal outside the DOM surface and a modal elsewhere block background pointer events', () => {
  let contains = true, modal = false;
  const surface = { contains: () => contains, ownerDocument: { querySelector: () => modal ? {} : null } } as unknown as HTMLElement;
  assert.equal(isSwipeSurfaceBlocked(surface, content), false);
  contains = false; assert.equal(isSwipeSurfaceBlocked(surface, content), true);
  contains = true; modal = true; assert.equal(isSwipeSurfaceBlocked(surface, content), true);
});
test('month end and year boundary keep existing clamping semantics', () => {
  const next = navigateCalendarPeriod(new Date(2027, 0, 31), 'month', 1);
  assert.equal(next.getMonth(), 1); assert.equal(next.getDate(), 28);
  const year = navigateCalendarPeriod(new Date(2026, 11, 31), 'today', 1);
  assert.equal(year.getFullYear(), 2027); assert.equal(year.getMonth(), 0); assert.equal(year.getDate(), 1);
});
