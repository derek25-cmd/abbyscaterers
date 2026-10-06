'use client';

import { useState, type ReactNode } from 'react';
import { ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';

/**
 * Filters apply live as the caller's checkboxes are toggled (state lives in
 * the parent module, not here) — "Apply" just dismisses the sheet, "Clear"
 * resets the parent's filter state. Simpler than a generic draft/staged
 * state machine, and matches common mobile filter-panel behavior.
 */
export function FilterSheet({
  activeCount,
  onClear,
  children,
}: {
  activeCount: number;
  onClear: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ListFilter className="h-3.5 w-3.5" />
        Filters{activeCount > 0 ? ` (${activeCount})` : ''}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-2 space-y-1">{children}</div>
          <SheetFooter className="mt-4 flex-row gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClear} disabled={activeCount === 0}>
              Clear
            </Button>
            <Button type="button" className="flex-1" onClick={() => setOpen(false)}>
              Apply
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
