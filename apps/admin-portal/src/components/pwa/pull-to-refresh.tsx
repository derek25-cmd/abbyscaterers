'use client';

import { useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const THRESHOLD = 60;
const MAX_PULL = 90;

/**
 * Custom touch handler rather than a library — the one real candidate,
 * react-pull-to-refresh, has been unmaintained since ~2018. Only arms when
 * the app's single scroll container (the <main> in (portal)/layout.tsx) is
 * already at scrollTop 0 when the gesture starts, so it doesn't fight
 * normal downward scrolling.
 */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => void | Promise<void>; children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);

  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (refreshing) return;
    const scrollContainer = document.querySelector('main');
    armed.current = !scrollContainer || scrollContainer.scrollTop === 0;
    startY.current = armed.current ? e.touches[0].clientY : null;
  };

  const handleTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (!armed.current || startY.current == null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      setPull(Math.min(delta * 0.5, MAX_PULL));
    }
  };

  const handleTouchEnd = async () => {
    if (armed.current && pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPull(0);
    startY.current = null;
    armed.current = false;
  };

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden text-muted-foreground transition-[height]"
        style={{ height: refreshing ? THRESHOLD : pull }}
      >
        <RefreshCw className={cn('h-5 w-5', (refreshing || pull >= THRESHOLD) && 'animate-spin')} />
      </div>
      {children}
    </div>
  );
}
