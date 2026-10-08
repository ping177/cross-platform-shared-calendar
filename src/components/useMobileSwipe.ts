import { useEffect, useRef, type PointerEvent } from 'react';
import { createSwipeClickGuard, createSwipeRecognizer, isSwipeSurfaceBlocked, type SwipeClickGuard, type SwipeOptions } from '../lib/mobile-swipe';

export function useMobileSwipe(options: Omit<SwipeOptions, 'clickGuard'> & { clickGuard?: SwipeClickGuard }) {
  const localGuard = useRef(createSwipeClickGuard());
  const current = useRef({ ...options, clickGuard: options.clickGuard ?? localGuard.current });
  current.current = { ...options, clickGuard: options.clickGuard ?? localGuard.current };
  const recognizer = useRef<ReturnType<typeof createSwipeRecognizer> | null>(null);
  if (!recognizer.current) recognizer.current = createSwipeRecognizer(() => current.current);
  const gesture = recognizer.current;
  useEffect(() => { gesture.reset(); return gesture.reset; }, [options.enabled, options.scope, gesture]);
  const route = (handler: (event: PointerEvent<HTMLElement>) => void) => (event: PointerEvent<HTMLElement>) => {
    if (isSwipeSurfaceBlocked(event.currentTarget, event.target)) { gesture.reset(); return; }
    handler(event);
  };
  return {
    onPointerDownCapture: current.current.clickGuard.onPointerDownCapture,
    onClickCapture: current.current.clickGuard.onClickCapture,
    onPointerDown: route(gesture.onPointerDown), onPointerMove: route(gesture.onPointerMove),
    onPointerUp: route(gesture.onPointerUp), onPointerCancel: gesture.onPointerCancel,
    style: options.enabled ? { touchAction: 'pan-y pinch-zoom' } : undefined,
  };
}
