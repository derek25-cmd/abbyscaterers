'use client';

import { useCallback, useEffect, useState } from 'react';
import { addDays, format } from 'date-fns';
import { CalendarCheck, CalendarClock, CalendarPlus, Inbox, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApplyLeaveDialog } from '@/components/hr/apply-leave-dialog';
import { ReviewLeaveDialog } from '@/components/hr/review-leave-dialog';
import { BalancesTable } from '@/components/leave/balances-table';
import { LeaveCalendar } from '@/components/leave/leave-calendar';
import { LeaveSettingsPanel } from '@/components/leave/leave-settings-panel';
import { PendingApprovals } from '@/components/leave/pending-approvals';
import { RequestsTable } from '@/components/leave/requests-table';
import { UnpaidLeaveReport } from '@/components/leave/unpaid-leave-report';
import { useLeaveReference } from '@/hooks/use-leave-reference';
import { useStaffRole } from '@/hooks/use-staff-role';
import { getRequests } from '@/services/leaveService';
import type { LeaveRequestView } from '@/types';

interface Summary { waiting: number; awayToday: number; startingSoon: number }

export default function LeavePage() {
  const { canManageHr, isLoading: roleLoading } = useStaffRole();
  const reference = useLeaveReference();

  const [tab, setTab] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [applyOpen, setApplyOpen] = useState(false);
  const [selected, setSelected] = useState<LeaveRequestView | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // HR lands on the approvals inbox; everyone else on the request list.
  useEffect(() => { if (!roleLoading && tab === null) setTab(canManageHr ? 'pending' : 'requests'); }, [roleLoading, canManageHr, tab]);

  useEffect(() => {
    let active = true;
    const today = format(new Date(), 'yyyy-MM-dd');
    const soon = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    Promise.all([getRequests({ status: 'pending' }), getRequests({ status: 'approved', from: today, to: soon })])
      .then(([pending, approved]) => {
        if (!active) return;
        setSummary({
          waiting: pending.length,
          awayToday: approved.filter((r) => r.start_date <= today && r.end_date >= today).length,
          startingSoon: approved.filter((r) => r.start_date > today).length,
        });
      })
      .catch(() => { if (active) setSummary(null); });
    return () => { active = false; };
  }, [refreshKey]);

  if (roleLoading || tab === null) return <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const openRequest = (r: LeaveRequestView) => setSelected(r);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Leave</h1>
          <p className="text-sm text-muted-foreground">
            {canManageHr
              ? 'Review leave requests, keep track of balances, and see who is away.'
              : 'Apply for leave, follow your requests, and see your balance.'}
          </p>
        </div>
        <Button onClick={() => setApplyOpen(true)}><CalendarPlus className="mr-2 h-4 w-4" />Apply for leave</Button>
      </div>

      {reference.error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{reference.error}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={Inbox} label="Waiting for approval" value={summary?.waiting} tone="amber" onClick={canManageHr ? () => setTab('pending') : () => setTab('requests')} />
        <SummaryCard icon={CalendarCheck} label="Away today" value={summary?.awayToday} tone="green" onClick={() => setTab('calendar')} />
        <SummaryCard icon={CalendarClock} label="Starting in the next 7 days" value={summary?.startingSoon} tone="blue" onClick={() => setTab('calendar')} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList>
            {canManageHr && (
              <TabsTrigger value="pending" className="gap-2">
                Waiting for approval
                {!!summary?.waiting && <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5">{summary.waiting}</Badge>}
              </TabsTrigger>
            )}
            <TabsTrigger value="requests">{canManageHr ? 'All requests' : 'Requests'}</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            {canManageHr && <TabsTrigger value="unpaid">Unpaid leave report</TabsTrigger>}
            {canManageHr && <TabsTrigger value="settings">Leave types &amp; holidays</TabsTrigger>}
          </TabsList>
        </div>

        {canManageHr && (
          <TabsContent value="pending"><PendingApprovals refreshKey={refreshKey} onOpen={openRequest} /></TabsContent>
        )}
        <TabsContent value="requests"><RequestsTable refreshKey={refreshKey} types={reference.types} onOpen={openRequest} /></TabsContent>
        <TabsContent value="balances"><BalancesTable refreshKey={refreshKey} types={reference.types} onChanged={refresh} /></TabsContent>
        <TabsContent value="calendar"><LeaveCalendar refreshKey={refreshKey} holidays={reference.holidays} onOpen={openRequest} /></TabsContent>
        {canManageHr && <TabsContent value="unpaid"><UnpaidLeaveReport refreshKey={refreshKey} /></TabsContent>}
        {canManageHr && (
          <TabsContent value="settings">
            <LeaveSettingsPanel types={reference.types} holidays={reference.holidays} workingWeek={reference.workingWeek} onChanged={() => { void reference.reload(); refresh(); }} />
          </TabsContent>
        )}
      </Tabs>

      <ApplyLeaveDialog isOpen={applyOpen} setIsOpen={setApplyOpen} onSubmitted={refresh} />
      <ReviewLeaveDialog request={selected} isOpen={!!selected} setIsOpen={(o) => !o && setSelected(null)} onChanged={refresh} />
    </div>
  );
}

const TONES = { amber: 'text-amber-700 bg-amber-50', green: 'text-green-700 bg-green-50', blue: 'text-blue-700 bg-blue-50' } as const;

function SummaryCard({ icon: Icon, label, value, tone, onClick }: {
  icon: typeof Inbox; label: string; value?: number; tone: keyof typeof TONES; onClick: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <button type="button" onClick={onClick} className="flex w-full items-center gap-4 rounded-lg p-4 text-left transition-colors hover:bg-muted/50">
          <span className={`flex h-11 w-11 items-center justify-center rounded-full ${TONES[tone]}`}><Icon className="h-5 w-5" aria-hidden /></span>
          <span>
            <span className="block text-2xl font-bold leading-none">{value ?? '–'}</span>
            <span className="text-sm text-muted-foreground">{label}</span>
          </span>
        </button>
      </CardContent>
    </Card>
  );
}
