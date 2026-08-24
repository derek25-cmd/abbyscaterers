"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase-client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Receipt, BarChart3, Loader2, MessageSquareReply, MoreHorizontal, Eye, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ViewRfqDialog } from "@/components/requests/view-rfq-dialog";
import { LinkExistingProformaDialog } from "@/components/requests/link-existing-proforma-dialog";

interface RfqRequestRow {
  id: string;
  title: string;
  status: string;
  client_name_freetext: string | null;
  client_id: string | null;
  clients: { companyName: string } | null;
  service_start_date: string | null;
  service_end_date: string | null;
  target_event_date: string | null;
  branch: string | null;
  created_at: string;
  rfq_proforma_links: { proforma_id: string }[];
}

const ANSWERABLE_STATUSES = new Set(["submitted", "in_review"]);

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  submitted: "secondary",
  in_review: "secondary",
  proforma_created: "default",
  approved: "default",
  closed: "outline",
  cancelled: "destructive",
};

function ProformaRequestsTab() {
  const queryClient = useQueryClient();
  const [viewingRfqId, setViewingRfqId] = useState<string | null>(null);
  const [linkingRfqId, setLinkingRfqId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["rfq-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfqs")
        .select(
          "id, title, status, client_name_freetext, client_id, clients(companyName), service_start_date, service_end_date, target_event_date, branch, created_at, rfq_proforma_links(proforma_id)"
        )
        // Drafts aren't "sent" to the catering system yet — an admin can
        // still be mid-edit, so they shouldn't show up in the ops queue.
        .neq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // clients(...) is a many-to-one embed but supabase-js's untyped
      // client infers every embed as an array regardless of cardinality.
      return data as unknown as RfqRequestRow[];
    },
  });

  // Live updates for new/changed requests — this tab's own copy below
  // claims "no manual sync needed", so make that actually true instead of
  // requiring a manual reload to see a newly submitted RFQ.
  useEffect(() => {
    const channel = supabase
      .channel("requests-rfq-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "rfqs" }, () => {
        queryClient.invalidateQueries({ queryKey: ["rfq-requests"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rfq_proforma_links" }, () => {
        queryClient.invalidateQueries({ queryKey: ["rfq-requests"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-destructive py-8">Failed to load requests: {(error as Error).message}</p>;
  }
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8">No proforma requests from the admin portal yet.</p>;
  }

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Request</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Service period</TableHead>
          <TableHead>Linked proforma</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((rfq) => (
          <TableRow key={rfq.id}>
            <TableCell>
              <div className="font-medium">{rfq.title}</div>
              <div className="text-xs text-muted-foreground font-mono">{rfq.id}</div>
            </TableCell>
            <TableCell>{rfq.clients?.companyName ?? rfq.client_name_freetext ?? rfq.client_id ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[rfq.status] ?? "outline"}>{rfq.status}</Badge>
            </TableCell>
            <TableCell>
              {rfq.service_start_date && rfq.service_end_date
                ? `${rfq.service_start_date} – ${rfq.service_end_date}`
                : rfq.target_event_date ?? "—"}
            </TableCell>
            <TableCell>
              {rfq.rfq_proforma_links.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {rfq.rfq_proforma_links.map((link) => (
                    <Link
                      key={link.proforma_id}
                      href={`/proforma-invoices/${link.proforma_id}`}
                      className="text-primary hover:underline text-xs font-mono"
                    >
                      {link.proforma_id}
                    </Link>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Not yet created</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              {(() => {
                const answerable = rfq.rfq_proforma_links.length === 0 && ANSWERABLE_STATUSES.has(rfq.status);
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setViewingRfqId(rfq.id)} className="cursor-pointer">
                        <Eye className="mr-2 h-4 w-4" /> View RFQ Details
                      </DropdownMenuItem>
                      {answerable && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/proforma-invoices/new?fromRfq=${rfq.id}`} className="flex items-center cursor-pointer">
                              <MessageSquareReply className="mr-2 h-4 w-4" /> Create New Proforma
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLinkingRfqId(rfq.id)} className="cursor-pointer">
                            <Link2 className="mr-2 h-4 w-4" /> Link Existing Proforma
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    <ViewRfqDialog rfqId={viewingRfqId} isOpen={viewingRfqId !== null} setIsOpen={(open) => !open && setViewingRfqId(null)} />
    {linkingRfqId && (
      <LinkExistingProformaDialog
        rfqId={linkingRfqId}
        isOpen={linkingRfqId !== null}
        setIsOpen={(open) => !open && setLinkingRfqId(null)}
      />
    )}
    </>
  );
}

interface InvoiceRequestRow {
  id: string;
  requested_at: string;
  proforma_id: string;
  invoice_id: string | null;
  status: "pending" | "fulfilled" | "rejected";
  rejection_reason: string | null;
}

const INVOICE_REQUEST_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  fulfilled: "default",
  rejected: "destructive",
};

/**
 * Generates the actual final invoice for a pending request. Field mapping
 * mirrors src/components/invoices/invoice-form.tsx's proforma→invoice
 * prefill (its useEffect around "else if (proformaId)") as closely as
 * possible, so an invoice generated here is indistinguishable from one
 * created through that form — same field copy, same signedAtLocation
 * default, same item shape. That existing form/flow is untouched; this is
 * a second, independent path to the same create_invoice_from_proforma()
 * RPC, for staff fulfilling a portal-originated request rather than
 * working from the UI directly.
 */
async function fulfillInvoiceRequest(request: InvoiceRequestRow): Promise<string> {
  const { data: proforma, error: proformaError } = await supabase
    .from("proforma_invoices")
    .select("*")
    .eq("id", request.proforma_id)
    .single();
  if (proformaError) throw proformaError;

  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq('"proformaId"', request.proforma_id)
    .maybeSingle();
  if (existing) {
    // Someone already invoiced this proforma through the normal UI since
    // the request was made — treat the request as fulfilled by that
    // invoice rather than erroring or creating a duplicate.
    return existing.id;
  }

  const { data: nextId, error: idError } = await supabase.rpc("claim_ids", {
    counter_name: "invoice_id",
    count: 1,
  });
  if (idError) throw idError;

  const today = format(new Date(), "yyyy-MM-dd");
  const now = new Date().toISOString();

  const invoicePayload = {
    ...proforma,
    id: String(nextId).padStart(7, "0"),
    proformaId: proforma.id,
    status: "outstanding",
    invoiceDate: today,
    items: (proforma.items ?? []).map((pi: Record<string, unknown>) => ({
      id: pi.id,
      orderId: pi.orderId,
      particularType: pi.particularType,
      eventType: pi.eventType,
      customEventType: pi.customEventType,
      mealType: pi.mealType,
      pax: pi.pax,
      unitPrice: pi.unitPrice,
      total: pi.total,
      date: pi.date,
      particularDescription: pi.particularDescription,
      vatType: pi.vatType,
    })),
    signedAtDate: today,
    signedAtLocation: "Dar es Salaam",
    appendProformaId: true,
    createdAt: now,
    updatedAt: now,
  };

  const { data: invoice, error: rpcError } = await supabase
    .rpc("create_invoice_from_proforma", { p_invoice: invoicePayload })
    .single();
  if (rpcError) throw rpcError;

  return (invoice as { id: string }).id;
}

function InvoiceRequestsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["invoice-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_invoice_requests")
        .select("id, requested_at, proforma_id, invoice_id, status, rejection_reason")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data as InvoiceRequestRow[];
    },
  });

  const handleFulfill = async (request: InvoiceRequestRow) => {
    setActingOnId(request.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const invoiceId = await fulfillInvoiceRequest(request);

      const { error: updateError } = await supabase
        .from("portal_invoice_requests")
        .update({
          status: "fulfilled",
          invoice_id: invoiceId,
          fulfilled_by_id: user?.id ?? null,
          fulfilled_at: new Date().toISOString(),
        })
        .eq("id", request.id);
      if (updateError) throw updateError;

      toast({ title: "Invoice generated", description: `Invoice ${invoiceId} created from proforma ${request.proforma_id}.` });
      queryClient.invalidateQueries({ queryKey: ["invoice-requests"] });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to generate invoice",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setActingOnId(null);
    }
  };

  const handleReject = async (request: InvoiceRequestRow) => {
    const reason = window.prompt("Reason for rejecting this invoice request (shown to the admin):");
    if (reason === null) return;
    setActingOnId(request.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from("portal_invoice_requests")
        .update({
          status: "rejected",
          rejection_reason: reason || null,
          fulfilled_by_id: user?.id ?? null,
          fulfilled_at: new Date().toISOString(),
        })
        .eq("id", request.id);
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ["invoice-requests"] });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to reject request",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setActingOnId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-destructive py-8">Failed to load requests: {(error as Error).message}</p>;
  }
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8">No invoice requests from the admin portal yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>From proforma</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Invoice</TableHead>
          <TableHead>Requested</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <Link href={`/proforma-invoices/${r.proforma_id}`} className="text-primary hover:underline font-mono text-xs">
                {r.proforma_id}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={INVOICE_REQUEST_STATUS_VARIANT[r.status]}>{r.status}</Badge>
              {r.status === "rejected" && r.rejection_reason && (
                <p className="text-xs text-muted-foreground mt-1">{r.rejection_reason}</p>
              )}
            </TableCell>
            <TableCell>
              {r.invoice_id ? (
                <Link href={`/invoices/${r.invoice_id}`} className="text-primary hover:underline font-mono text-xs">
                  {r.invoice_id}
                </Link>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(r.requested_at).toLocaleString()}
            </TableCell>
            <TableCell className="text-right">
              {r.status === "pending" && (
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" disabled={actingOnId === r.id} onClick={() => handleReject(r)}>
                    Reject
                  </Button>
                  <Button size="sm" disabled={actingOnId === r.id} onClick={() => handleFulfill(r)}>
                    {actingOnId === r.id ? "Generating…" : "Generate invoice"}
                  </Button>
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <p className="text-sm text-muted-foreground py-8">
      {label} from the admin portal aren&apos;t available yet — this tab will populate once that
      request flow is built there.
    </p>
  );
}

export default function RequestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Requests</h1>
        <p className="text-muted-foreground">
          Requests submitted by admins through the Admin Portal, organized by type.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Portal Requests</CardTitle>
          <CardDescription>
            Live from the same database the Admin Portal writes to — no manual sync needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="proforma">
            <TabsList>
              <TabsTrigger value="proforma" className="gap-1.5">
                <FileText className="h-4 w-4" /> Proforma Requests
              </TabsTrigger>
              <TabsTrigger value="invoice" className="gap-1.5">
                <Receipt className="h-4 w-4" /> Invoice Requests
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-1.5">
                <BarChart3 className="h-4 w-4" /> Report Requests
              </TabsTrigger>
            </TabsList>
            <TabsContent value="proforma">
              <ProformaRequestsTab />
            </TabsContent>
            <TabsContent value="invoice">
              <InvoiceRequestsTab />
            </TabsContent>
            <TabsContent value="reports">
              <PlaceholderTab label="Report requests" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
