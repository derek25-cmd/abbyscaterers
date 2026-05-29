
'use client';

import { useState, useMemo } from "react";
import { Search, ExternalLink, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getInvoices } from "@/services/invoiceService";
import { Invoice } from "@/types";
import { useClientStorage } from "@/hooks/use-client-storage";
import Link from "next/link";

function calcInvoiceTotals(inv: Invoice) {
  const subtotal = inv.items.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
  const totalBeforeVAT = totalForDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);

  if (inv.vatType === 'exclusive') {
    const vatAmount = totalBeforeVAT * 0.18;
    return { netAmount: totalBeforeVAT, vatAmount, grandTotal: totalBeforeVAT + vatAmount };
  } else {
    const grandTotal = totalBeforeVAT;
    const netAmount = grandTotal / 1.18;
    return { netAmount, vatAmount: grandTotal - netAmount, grandTotal };
  }
}

export default function SalesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { clients } = useClientStorage();

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: getInvoices,
  });

  const getClientName = (clientId: string | null) => {
    if (!clientId) return 'Walk-in / Direct';
    const client = clients.find(c => c.id === clientId);
    return client?.companyName || 'Unknown Client';
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return invoices;
    const q = searchQuery.toLowerCase();
    return invoices.filter(inv =>
      inv.id.toLowerCase().includes(q) ||
      getClientName(inv.clientId).toLowerCase().includes(q) ||
      (inv.serviceDesc || '').toLowerCase().includes(q) ||
      (inv.selectedEventType || '').toLowerCase().includes(q) ||
      (inv.customEventType || '').toLowerCase().includes(q)
    );
  }, [invoices, searchQuery, clients]);

  const totals = useMemo(() => {
    const all = filtered.map(calcInvoiceTotals);
    return {
      net: all.reduce((s, t) => s + t.netAmount, 0),
      vat: all.reduce((s, t) => s + t.vatAmount, 0),
      gross: all.reduce((s, t) => s + t.grandTotal, 0),
    };
  }, [filtered]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount);

  const getStatusBadge = (status: Invoice['status']) => {
    if (status === 'paid') return <Badge className="bg-green-600">Paid</Badge>;
    if (status === 'partially paid') return <Badge className="bg-blue-600">Part Paid</Badge>;
    return <Badge variant="outline">Outstanding</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Sales Journal
            </CardTitle>
            <CardDescription>
              Revenue ledger auto-populated from issued invoices. To record a new sale, create an invoice in the Invoicing module.
            </CardDescription>
          </div>
          <Link href="/invoicing/invoices">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" /> Invoicing Module
            </Button>
          </Link>
        </div>
        <div className="pt-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer, invoice number, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg bg-background pl-8 md:w-[360px]"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead className="text-right">Net Amount</TableHead>
              <TableHead className="text-right">VAT (18%)</TableHead>
              <TableHead className="text-right">Gross Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center">Loading sales journal...</TableCell></TableRow>
            ) : filtered.length > 0 ? (
              filtered.map((inv) => {
                const { netAmount, vatAmount, grandTotal } = calcInvoiceTotals(inv);
                const description = inv.serviceDesc || inv.customEventType || inv.selectedEventType || 'Catering Services';
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(inv.invoiceDate), "PPP")}</TableCell>
                    <TableCell className="font-medium">{getClientName(inv.clientId)}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={description}>{description}</TableCell>
                    <TableCell className="font-mono text-sm">{inv.id}</TableCell>
                    <TableCell className="text-right">{formatCurrency(netAmount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(vatAmount)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(grandTotal)}</TableCell>
                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No invoices found. Use the Invoicing module to create and issue sales invoices.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="text-right font-bold text-base">Journal Totals</TableCell>
              <TableCell className="text-right font-bold text-base">{formatCurrency(totals.net)}</TableCell>
              <TableCell className="text-right font-bold text-base text-purple-600">{formatCurrency(totals.vat)}</TableCell>
              <TableCell className="text-right font-bold text-base text-primary">{formatCurrency(totals.gross)}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
