"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Ban, History, Lock, MoreHorizontal, Search, Trash2, Unlock, UserCheck, Flame,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLiftRestriction, useMarketerOverview } from "../../hooks/useMarketingQuery";
import { ACCOUNT_STATUS_CONFIG } from "../../types";
import type { AccountActionKey, ApprovalStatus, MarketerAccountOverview } from "../../types";
import { formatDate, initials } from "../../utils/format";
import { CautionDialog } from "../dialogs/CautionDialog";
import { RestrictDialog } from "../dialogs/RestrictDialog";
import { DisableDialog } from "../dialogs/DisableDialog";
import { SuspendDialog } from "../dialogs/SuspendDialog";
import { ReinstateDialog } from "../dialogs/ReinstateDialog";
import { DeleteDialog } from "../dialogs/DeleteDialog";
import { PurgeDialog } from "../dialogs/PurgeDialog";
import { useToast } from "@/hooks/use-toast";

const STATUS_FILTERS: { value: ApprovalStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "INCOMPLETE", label: "Incomplete" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Active" },
  { value: "CAUTIONED", label: "Cautioned" },
  { value: "RESTRICTED", label: "Restricted" },
  { value: "DISABLED", label: "Disabled" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DELETED", label: "Deleted" },
];

const ACTION_LABELS: Record<AccountActionKey, { label: string; icon: typeof Lock; destructive?: boolean }> = {
  caution: { label: "Issue Caution", icon: AlertTriangle },
  restrict: { label: "Restrict Access", icon: Lock },
  lift_restriction: { label: "Lift Restriction", icon: Unlock },
  suspend: { label: "Suspend Account", icon: Ban, destructive: true },
  disable: { label: "Disable Account", icon: Ban, destructive: true },
  reinstate: { label: "Reinstate Account", icon: UserCheck },
  delete: { label: "Delete Account", icon: Trash2, destructive: true },
  purge: { label: "Permanently Delete", icon: Flame, destructive: true },
};

export function MarketerAccountTable() {
  const { toast } = useToast();
  const { data: rows, isLoading } = useMarketerOverview();
  const liftRestriction = useLiftRestriction();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "ALL">("ALL");
  const [activeDialog, setActiveDialog] = useState<{ action: AccountActionKey; marketer: MarketerAccountOverview } | null>(null);

  const filtered = useMemo(() => {
    return (rows ?? []).filter((row) => {
      if (statusFilter !== "ALL" && row.approval_status !== statusFilter) return false;
      if (search) {
        const term = search.toLowerCase();
        if (!row.full_name.toLowerCase().includes(term) && !row.email.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  const handleAction = (action: AccountActionKey, marketer: MarketerAccountOverview) => {
    if (action === "lift_restriction") {
      liftRestriction.mutate(
        { id: marketer.id },
        {
          onSuccess: () => toast({ title: "Restriction lifted" }),
          onError: (e) => toast({ variant: "destructive", title: "Could not lift restriction", description: e instanceof Error ? e.message : undefined }),
        }
      );
      return;
    }
    setActiveDialog({ action, marketer });
  };

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ApprovalStatus | "ALL")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No marketers match your filters.</p>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marketer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="text-right">This Month</TableHead>
                <TableHead className="text-right">Cautions</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                // Defensive fallback — never let an unexpected status value crash the table.
                const statusMeta = ACCOUNT_STATUS_CONFIG[row.approval_status] ?? ACCOUNT_STATUS_CONFIG.INCOMPLETE;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{initials(row.full_name)}</AvatarFallback></Avatar>
                        <div>
                          <Link href={`/marketing/marketers/${row.id}`} className="font-medium hover:underline">{row.full_name}</Link>
                          <p className="text-xs text-muted-foreground">{row.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusMeta.badgeClass}>{statusMeta.label}</Badge>
                      {row.approval_status === "SUSPENDED" && row.suspended_until && (
                        <p className="mt-1 text-xs text-muted-foreground">until {formatDate(row.suspended_until, "long")}</p>
                      )}
                      {row.approval_status === "PENDING" && (
                        <Link href={`/marketing/applications/${row.id}`} className="mt-1 block text-xs text-primary hover:underline">
                          Review application →
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{row.region_name ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">
                      {row.visits_this_month ?? 0} visits · {row.deals_this_month ?? 0} deals
                    </TableCell>
                    <TableCell className="text-right">{row.caution_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.last_seen_at ? formatDate(row.last_seen_at, "relative") : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {statusMeta.canPerform
                            .filter((action) => action !== "purge" || row.role === "MARKETER")
                            .map((action) => {
                            const meta = ACTION_LABELS[action];
                            return (
                              <DropdownMenuItem
                                key={action}
                                className={meta.destructive ? "text-destructive" : ""}
                                onClick={() => handleAction(action, row)}
                              >
                                <meta.icon className="mr-2 h-4 w-4" /> {meta.label}
                              </DropdownMenuItem>
                            );
                          })}
                          <DropdownMenuItem asChild>
                            <Link href={`/marketing/marketers/${row.id}`}>
                              <History className="mr-2 h-4 w-4" /> View Action History
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {activeDialog?.action === "caution" && (
        <CautionDialog
          open
          onOpenChange={() => setActiveDialog(null)}
          marketer={{ id: activeDialog.marketer.id, fullName: activeDialog.marketer.full_name }}
          cautionCount={activeDialog.marketer.caution_count}
        />
      )}
      {activeDialog?.action === "restrict" && (
        <RestrictDialog open onOpenChange={() => setActiveDialog(null)} marketer={{ id: activeDialog.marketer.id, fullName: activeDialog.marketer.full_name }} />
      )}
      {activeDialog?.action === "disable" && (
        <DisableDialog open onOpenChange={() => setActiveDialog(null)} marketer={{ id: activeDialog.marketer.id, fullName: activeDialog.marketer.full_name }} />
      )}
      {activeDialog?.action === "suspend" && (
        <SuspendDialog open onOpenChange={() => setActiveDialog(null)} marketer={{ id: activeDialog.marketer.id, fullName: activeDialog.marketer.full_name }} />
      )}
      {activeDialog?.action === "reinstate" && (
        <ReinstateDialog
          open
          onOpenChange={() => setActiveDialog(null)}
          marketer={{ id: activeDialog.marketer.id, fullName: activeDialog.marketer.full_name }}
          disabledReason={activeDialog.marketer.disabled_reason}
          disabledAt={activeDialog.marketer.disabled_at}
          suspensionReason={activeDialog.marketer.suspension_reason}
          suspendedUntil={activeDialog.marketer.suspended_until}
        />
      )}
      {activeDialog?.action === "delete" && (
        <DeleteDialog open onOpenChange={() => setActiveDialog(null)} marketer={{ id: activeDialog.marketer.id, fullName: activeDialog.marketer.full_name }} />
      )}
      {activeDialog?.action === "purge" && (
        <PurgeDialog open onOpenChange={() => setActiveDialog(null)} marketer={{ id: activeDialog.marketer.id, fullName: activeDialog.marketer.full_name }} />
      )}
    </div>
  );
}
