'use client';

import type { ReactNode } from 'react';
import { Loader2, PackageX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { isHrModuleOn, useHrModules, type HrModule } from '@/lib/hr-modules';

/** A whole page: shown when the module is on, "Not available yet" when it is off. */
export function HrModuleGate({ module, children }: { module: HrModule; children: ReactNode }) {
  const modules = useHrModules();
  if (!modules) {
    return <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>;
  }
  if (!isHrModuleOn(modules, module)) {
    return (
      <main className="p-4 md:p-8">
        <Card className="mx-auto max-w-lg">
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <PackageX className="h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">Not available yet</p>
            <p className="text-sm text-muted-foreground">This part of the HR system is switched off for now.</p>
          </CardContent>
        </Card>
      </main>
    );
  }
  return <>{children}</>;
}

/** A button, tab, card or menu item: rendered only when the module is on. */
export function HrModuleOnly({ module, children }: { module: HrModule; children: ReactNode }) {
  const modules = useHrModules();
  return modules && isHrModuleOn(modules, module) ? <>{children}</> : null;
}
