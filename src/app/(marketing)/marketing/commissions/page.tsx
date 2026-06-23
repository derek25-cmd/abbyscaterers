"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useApproveCommission, useCommissions, useRejectCommission } from "@/features/marketing/hooks/useMarketingQuery";
import { formatDate, formatTZS } from "@/features/marketing/utils/format";
import type { CommissionStatus } from "@/features/marketing/types";

const STATUS_BADGE: Record<CommissionStatus, string> = {
  PENDING_REVIEW: "bg-warning/15 text-warning",
  APPROVED: "bg-success/15 text-success",
  REJECTED: "bg-destructive/15 text-destructive",
};

export default function CommissionsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<CommissionStatus | "ALL">("PENDING_REVIEW");
  const { data: commissions, isLoading } = useCommissions(statusFilter === "ALL" ? undefined : statusFilter);
  const approve = useApproveCommission();
  const reject = useRejectCommission();

  const handleApprove = async (id: string) => {
    try {
      await approve.mutateAsync(id);
      toast({ title: "Commission approved" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not approve", description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await reject.mutateAsync({ id });
      toast({ title: "Commission rejected" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not reject", description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Commissions</h2>
          <p className="text-sm text-muted-foreground">1% commission on a landed client&apos;s first month of invoices, 0.5% after.</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CommissionStatus | "ALL")}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="ALL">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !commissions || commissions.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No commissions in this view.</p>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marketer</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="text-right">Invoice Total</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.marketer?.full_name ?? "—"}</TableCell>
                  <TableCell>
                    {c.company ? <Link href={`/marketing/companies/${c.company.id}`} className="hover:underline">{c.company.name}</Link> : "—"}
                  </TableCell>
                  <TableCell>
                    <Link href={`/invoices/${c.invoice_id}`} className="hover:underline">{c.invoice_id}</Link>
                  </TableCell>
                  <TableCell className="text-right">{formatTZS(c.invoice_total)}</TableCell>
                  <TableCell className="text-right">
                    {(c.commission_rate * 100).toFixed(2)}%
                    {c.split_count > 1 && <span className="ml-1 text-xs text-muted-foreground">÷{c.split_count}</span>}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatTZS(c.commission_amount)}</TableCell>
                  <TableCell><Badge className={STATUS_BADGE[c.status]}>{c.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(c.created_at, "relative")}</TableCell>
                  <TableCell className="text-right">
                    {c.status === "PENDING_REVIEW" && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleApprove(c.id)} disabled={approve.isPending || reject.isPending}>
                          <Check className="mr-1 h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleReject(c.id)} disabled={approve.isPending || reject.isPending}>
                          <X className="mr-1 h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
