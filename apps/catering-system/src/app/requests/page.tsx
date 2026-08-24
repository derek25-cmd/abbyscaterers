"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { FileText, Receipt, BarChart3, Loader2 } from "lucide-react";

interface RfqRequestRow {
  id: string;
  title: string;
  status: string;
  client_name_freetext: string | null;
  client_id: string | null;
  target_event_date: string | null;
  branch: string | null;
  created_at: string;
  rfq_proforma_links: { proforma_id: string }[];
}

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
  const { data, isLoading, error } = useQuery({
    queryKey: ["rfq-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfqs")
        .select(
          "id, title, status, client_name_freetext, client_id, target_event_date, branch, created_at, rfq_proforma_links(proforma_id)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RfqRequestRow[];
    },
  });

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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Request</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Target date</TableHead>
          <TableHead>Linked proforma</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((rfq) => (
          <TableRow key={rfq.id}>
            <TableCell>
              <div className="font-medium">{rfq.title}</div>
              <div className="text-xs text-muted-foreground font-mono">{rfq.id}</div>
            </TableCell>
            <TableCell>{rfq.client_name_freetext ?? rfq.client_id ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[rfq.status] ?? "outline"}>{rfq.status}</Badge>
            </TableCell>
            <TableCell>{rfq.branch ?? "—"}</TableCell>
            <TableCell>{rfq.target_event_date ?? "—"}</TableCell>
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
              <PlaceholderTab label="Invoice requests" />
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
