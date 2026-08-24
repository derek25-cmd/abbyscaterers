"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useCompanies, useUpdateStage } from "@/features/marketing/hooks/useMarketingQuery";
import { formatDate, formatTZS, initials } from "@/features/marketing/utils/format";

/** Queue of companies that have requested a quotation — the people
 * responsible (managers/finance) action these by issuing a Proforma
 * Invoice, then move the company on to Negotiating. */
export default function QuotationsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { data, isLoading } = useCompanies({ stage: ["QUOTATION_REQUESTED"], limit: 100 });
  const updateStage = useUpdateStage();

  const companies = data?.data ?? [];

  const issueQuotation = () => {
    // Proforma invoices key off the separate `clients` table, not `companies` —
    // there's no FK linking the two for a not-yet-won prospect, so this opens
    // the blank creation form rather than a fabricated prefill.
    router.push(`/proforma-invoices/new`);
  };

  const markIssued = async (companyId: string) => {
    try {
      await updateStage.mutateAsync({ id: companyId, stage: "NEGOTIATING" });
      toast({ title: "Marked as quoted — moved to Negotiating" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not update stage", description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Quotation Requests</h2>
        <p className="text-sm text-muted-foreground">
          {companies.length} compan{companies.length === 1 ? "y" : "ies"} waiting for a quotation to be issued.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : companies.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No pending quotation requests.</p>
      ) : (
        <div className="space-y-3">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9"><AvatarFallback>{initials(company.name)}</AvatarFallback></Avatar>
                  <div>
                    <Link href={`/marketing/companies/${company.id}`} className="font-medium hover:underline">{company.name}</Link>
                    <p className="text-xs text-muted-foreground">
                      {(company as any).marketer?.full_name ?? "Unassigned"} · {company.contact_name ?? "No contact"}
                      {company.contact_email ? ` · ${company.contact_email}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{formatTZS(company.estimated_value, { compact: true })}</Badge>
                  <span className="text-xs text-muted-foreground">Requested {formatDate(company.updated_at, "relative")}</span>
                  <Button size="sm" variant="outline" onClick={() => markIssued(company.id)} disabled={updateStage.isPending}>
                    Mark Quoted
                  </Button>
                  <Button size="sm" onClick={issueQuotation}>
                    <FileText className="mr-1.5 h-3.5 w-3.5" /> Issue Quotation
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
