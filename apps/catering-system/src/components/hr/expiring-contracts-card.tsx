'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, FilePlus2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NewDocumentWizard } from '@/components/hr/new-document-wizard';
import { CONTRACT_TYPE_LABEL, formatShortDate } from '@/lib/hr-docs/types/shared';
import { listExpiringContracts, type ExpiringContract } from '@/services/hrRecordsService';

function daysLeftLabel(days: number) {
  if (days < 0) return { text: `${-days} day${days === -1 ? '' : 's'} overdue`, variant: 'destructive' as const };
  if (days === 0) return { text: 'Ends today', variant: 'destructive' as const };
  return { text: `${days} day${days === 1 ? '' : 's'} left`, variant: days <= 7 ? 'destructive' as const : days <= 30 ? 'default' as const : 'secondary' as const };
}

/**
 * Dashboard card for HR: active contracts ending within the next 60 days
 * (and any already past their end date), soonest first. "Extend" opens an
 * extension letter for that employee. Wrap it in RequirePermission hr.manage;
 * the table is HR-only in the database as well.
 */
export function ExpiringContractsCard() {
  const [rows, setRows] = useState<ExpiringContract[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extendFor, setExtendFor] = useState<string | null>(null);

  useEffect(() => {
    listExpiringContracts(60)
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the expiring contracts.'));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" />Expiring contracts</CardTitle>
        <CardDescription>Contracts ending in the next 60 days, soonest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : rows === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contracts end in the next 60 days.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((c) => {
              const left = daysLeftLabel(c.days_left);
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/hr/employees?open=${c.employee_id}`} className="font-medium hover:underline">{c.employee_name}</Link>
                    <p className="text-xs text-muted-foreground">
                      {CONTRACT_TYPE_LABEL[c.contract_type]}{c.position ? ` · ${c.position}` : ''} · ends {formatShortDate(c.end_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={left.variant}>{left.text}</Badge>
                    <Button size="sm" variant="outline" onClick={() => setExtendFor(c.employee_id)}>
                      <FilePlus2 className="mr-1 h-4 w-4" />Extend
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <NewDocumentWizard
        isOpen={!!extendFor}
        setIsOpen={(o) => !o && setExtendFor(null)}
        defaultEmployeeId={extendFor ?? undefined}
        defaultDocType="extension"
      />
    </Card>
  );
}
