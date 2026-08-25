'use client';

import { useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const FOCUSABLE_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

/**
 * Mounted once in (portal)/layout.tsx rather than wired per-field — a
 * single focusin listener covers every current and future form, so the
 * on-screen keyboard never covers the field being typed into.
 */
export function useKeyboardAwareScroll() {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !FOCUSABLE_TAGS.has(target.tagName)) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [isMobile]);
}
