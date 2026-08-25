'use client';

import { useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { cn } from '@/lib/utils';

const REVEAL_WIDTH = 88;
const DRAG_THRESHOLD = 24;

export interface SwipeAction {
  label: string;
  colorClass: string; // background for the revealed panel
  onConfirm: () => void;
}

/**
 * Swipe-right reveals a left-edge action panel, swipe-left reveals a
 * right-edge one — the action only fires when the user taps the revealed
 * button, never just from dragging past a distance (per the mobile-PWA
 * spec: "confirmed with a tap on the revealed button — never auto-
 * triggered by the swipe distance alone").
 */
export function SwipeableCard({
  leftAction,
  rightAction,
  disabled,
  children,
}: {
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);

  const reset = () => setOffset(0);

  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (disabled || (!leftAction && !rightAction)) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragging.current = false;
  };

  const handleTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (startX.current == null || startY.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!dragging.current && Math.abs(dx) < DRAG_THRESHOLD) {
      // Not committed to a horizontal drag yet — let vertical scroll win.
      if (Math.abs(dy) > Math.abs(dx)) return;
    }
    dragging.current = true;
    const clamped = Math.max(-REVEAL_WIDTH, Math.min(REVEAL_WIDTH, dx));
    if (clamped > 0 && !leftAction) return;
    if (clamped < 0 && !rightAction) return;
    setOffset(clamped);
  };

  const handleTouchEnd = () => {
    startX.current = null;
    startY.current = null;
    // Snap fully open or closed — never leaves it half-revealed, which
    // would make the "tap to confirm" affordance ambiguous.
    setOffset((o) => {
      if (o > REVEAL_WIDTH / 2) return REVEAL_WIDTH;
      if (o < -REVEAL_WIDTH / 2) return -REVEAL_WIDTH;
      return 0;
    });
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {leftAction && (
        <button
          type="button"
          onClick={() => {
            leftAction.onConfirm();
            reset();
          }}
          className={cn(
            'absolute inset-y-0 left-0 flex items-center justify-center text-sm font-medium text-white',
            leftAction.colorClass
          )}
          style={{ width: REVEAL_WIDTH }}
        >
          {leftAction.label}
        </button>
      )}
      {rightAction && (
        <button
          type="button"
          onClick={() => {
            rightAction.onConfirm();
            reset();
          }}
          className={cn(
            'absolute inset-y-0 right-0 flex items-center justify-center text-sm font-medium text-white',
            rightAction.colorClass
          )}
          style={{ width: REVEAL_WIDTH }}
        >
          {rightAction.label}
        </button>
      )}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative bg-background transition-transform"
        style={{ transform: `translateX(${offset}px)`, transitionDuration: dragging.current ? '0ms' : '200ms' }}
      >
        {children}
      </div>
    </div>
  );
}
