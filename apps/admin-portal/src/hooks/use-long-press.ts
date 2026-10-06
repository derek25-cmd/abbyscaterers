'use client';

import { useRef } from 'react';
import type { TouchEvent } from 'react';

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

/**
 * Fires onLongPress if the touch holds still for LONG_PRESS_MS; any
 * movement past MOVE_CANCEL_PX (scrolling) cancels it so it doesn't fire
 * mid-scroll.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  const onTouchStart = (e: TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    timer.current = setTimeout(() => {
      onLongPress();
      start.current = null;
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!start.current) return;
    const dx = Math.abs(e.touches[0].clientX - start.current.x);
    const dy = Math.abs(e.touches[0].clientY - start.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clear();
  };

  return { onTouchStart, onTouchMove, onTouchEnd: clear, onTouchCancel: clear };
}
