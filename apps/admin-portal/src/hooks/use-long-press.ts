'use client';

import { useRef } from 'react';
import type { MouseEvent, TouchEvent } from 'react';

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
  const fired = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  const onTouchStart = (e: TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
      start.current = null;
      // Safety reset in case the browser never delivers the trailing click.
      setTimeout(() => {
        fired.current = false;
      }, 800);
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!start.current) return;
    const dx = Math.abs(e.touches[0].clientX - start.current.x);
    const dy = Math.abs(e.touches[0].clientY - start.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clear();
  };

  // Releasing after a long press still dispatches a click — on the element that
  // replaced the card when select mode kicked in, which would immediately
  // toggle the selection back off (or navigate). Swallow that one click.
  const onClickCapture = (e: MouseEvent) => {
    if (fired.current) {
      e.preventDefault();
      e.stopPropagation();
      fired.current = false;
    }
  };

  // Stops the native long-press context menu / link callout from competing
  // with the select-mode gesture on touch devices.
  const onContextMenu = (e: MouseEvent) => e.preventDefault();

  return { onTouchStart, onTouchMove, onTouchEnd: clear, onTouchCancel: clear, onClickCapture, onContextMenu };
}
