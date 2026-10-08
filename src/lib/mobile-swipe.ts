// Gesture recognition only. Navigation remains owned by each existing page.
const excludedTargets = [
  'input', 'textarea', 'select', 'summary', 'video', 'audio', 'canvas', 'iframe',
  '[contenteditable]:not([contenteditable="false"])', '[data-no-swipe]', ':disabled',
  '[role="dialog"]', '[aria-modal="true"]', '[draggable="true"]', '[data-rfd-drag-handle-draggable-id]',
  ...['textbox', 'combobox', 'listbox', 'option', 'checkbox', 'radio', 'switch', 'slider', 'spinbutton', 'scrollbar'].map((role) => `[role="${role}"]`),
].join(',');
const interactiveTargets = 'button, a, img, [role="button"], [role="link"], [role="tab"]';

export function isSwipeTargetExcluded(target: EventTarget | null) {
  const element = target as Element | null;
  if (!element?.closest || element.closest(excludedTargets)) return true;
  const interactive = element.closest(interactiveTargets);
  return Boolean(interactive && !interactive.closest('[data-swipe-start]'));
}

export type SwipePointer = {
  pointerId: number; pointerType: string; isPrimary: boolean;
  clientX: number; clientY: number; timeStamp: number; target: EventTarget | null;
};
type SwipeClick = {
  detail: number; timeStamp: number; clientX: number; clientY: number;
  nativeEvent: { pointerId?: number; pointerType?: string; isTrusted?: boolean };
  preventDefault: () => void; stopPropagation: () => void;
};

export function createSwipeClickGuard() {
  let pending: Pick<SwipePointer, 'pointerId' | 'clientX' | 'clientY' | 'timeStamp'> | null = null;
  return {
    markSwipe(event: SwipePointer) {
      pending = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, timeStamp: event.timeStamp };
    },
    onPointerDownCapture() { pending = null; },
    onClickCapture(event: SwipeClick) {
      if (!pending || event.detail === 0 || event.nativeEvent.isTrusted === false) return;
      const elapsed = event.timeStamp - pending.timeStamp;
      if (elapsed < 0 || elapsed > 1000) { pending = null; return; }
      const native = event.nativeEvent;
      if (native.pointerType && native.pointerType !== 'touch') return;
      const matches = native.pointerId && native.pointerId > 0 ? native.pointerId === pending.pointerId
        : Math.abs(event.clientX - pending.clientX) <= 2 && Math.abs(event.clientY - pending.clientY) <= 2;
      if (!matches) return;
      pending = null;
      event.preventDefault(); event.stopPropagation();
    },
  };
}
export type SwipeClickGuard = ReturnType<typeof createSwipeClickGuard>;
export type SwipeOptions = {
  enabled: boolean; scope: string; direction: 'right' | 'both';
  onSwipe: (direction: 'right' | 'left') => void; clickGuard: SwipeClickGuard;
};

export function createSwipeRecognizer(getOptions: () => SwipeOptions) {
  const pointers = new Set<number>();
  let start: { pointerId: number; x: number; y: number; time: number; maxY: number; scope: string; intent: boolean } | null = null;
  function reset() { start = null; pointers.clear(); }
  function update(event: SwipePointer) {
    if (!start || start.pointerId !== event.pointerId) return;
    const options = getOptions();
    const dx = Math.abs(event.clientX - start.x), dy = Math.abs(event.clientY - start.y);
    start.maxY = Math.max(start.maxY, dy);
    if (!options.enabled || options.scope !== start.scope || start.maxY > 30 || (dy >= 12 && dy > dx)) { start = null; return; }
    if (dx >= 30 && dx >= 2 * start.maxY) start.intent = true;
  }
  return {
    reset,
    onPointerDown(event: SwipePointer) {
      if (event.pointerType !== 'touch') return;
      pointers.add(event.pointerId);
      if (pointers.size !== 1) { start = null; return; }
      const options = getOptions();
      if (!options.enabled || !event.isPrimary || isSwipeTargetExcluded(event.target)) return;
      start = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, maxY: 0, scope: options.scope, intent: false };
    },
    onPointerMove: update,
    onPointerUp(event: SwipePointer) {
      if (event.pointerType !== 'touch') return;
      update(event);
      const gesture = start;
      pointers.delete(event.pointerId);
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      start = null;
      const options = getOptions(), dx = event.clientX - gesture.x, duration = event.timeStamp - gesture.time;
      const navigates = Math.abs(dx) >= 60 && Math.abs(dx) >= 2 * gesture.maxY && duration >= 0 && duration <= 800
        && (options.direction === 'both' || dx > 0);
      if (navigates || gesture.intent) options.clickGuard.markSwipe(event);
      if (navigates) options.onSwipe(dx > 0 ? 'right' : 'left');
    },
    onPointerCancel(event: SwipePointer) { start = null; pointers.delete(event.pointerId); },
  };
}

export function isSwipeSurfaceBlocked(surface: HTMLElement, target: EventTarget | null) {
  // React Portal events bubble through their owner tree, outside this DOM surface.
  return !target || !surface.contains(target as Node)
    || Boolean(surface.ownerDocument.querySelector('[aria-modal="true"]'));
}
