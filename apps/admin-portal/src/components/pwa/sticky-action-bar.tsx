import type { ReactNode } from 'react';

/**
 * Sits directly above the Phase 1 bottom tab bar (h-14 + its own
 * safe-area padding, see bottom-tab-bar.tsx) — bottom-14 clears it without
 * needing to duplicate the safe-area math here too. Desktop is untouched;
 * action buttons stay wherever they already are in the page header.
 */
export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-14 z-30 border-t border-border bg-background p-3 md:hidden">
      <div className="flex gap-2 [&>*]:flex-1">{children}</div>
    </div>
  );
}
