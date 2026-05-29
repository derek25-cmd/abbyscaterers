
'use client';

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getInvoices } from "@/services/invoiceService";
import { Invoice } from "@/types";
import { useClientStorage } from "@/hooks/use-client-storage";
import { format } from "date-fns";
import { Search, BookUser, TrendingUp } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";

function calcInvoiceGrossTotal(inv: Invoice): number {
  const subtotal = inv.items.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
  const totalBeforeVAT = totalForDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);
  if (inv.vatType === 'exclusive') {
    return totalBeforeVAT + totalBeforeVAT * 0.18;
  }
  return totalBeforeVAT;
}

export default function ReceivablesPage() {
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

  const outstandingInvoices = useMemo(() => {
    return invoices.filter(i => i.status === 'outstanding' || i.status === 'partially paid');
  }, [invoices]);

  const filteredReceivables = useMemo(() => {
    if (!searchQuery) return outstandingInvoices;
    const q = searchQuery.toLowerCase();
    return outstandingInvoices.filter(inv =>
      getClientName(inv.clientId).toLowerCase().includes(q) ||
      inv.id.toLowerCase().includes(q)
    );
  }, [outstandingInvoices, searchQuery, clients]);

  const totalReceivables = useMemo(() => {
    return filteredReceivables.reduce((sum, inv) => {
      const grandTotal = calcInvoiceGrossTotal(inv);
      const amountPaid = inv.amountPaid || 0;
      return sum + (grandTotal - amountPaid);
    }, 0);
  }, [filteredReceivables]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount);

  return (
    <div className="space-y-6">
      <StatsCard
        title="Total Accounts Receivable"
        value={formatCurrency(totalReceivables)}
        change={`${filteredReceivables.length} outstanding invoices`}
        changeType="warning"
        icon={TrendingUp}
        description="Total amount owed by customers from outstanding and partially paid invoices."
      />
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookUser />
                Accounts Receivable Ledger
              </CardTitle>
              <CardDescription>
                All amounts owed by customers from outstanding and partially paid invoices. Sourced live from the Invoicing module.
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer or invoice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-background pl-8 md:w-[320px]"
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
                <TableHead>Invoice #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Invoice Total</TableHead>
                <TableHead className="text-right">Paid to Date</TableHead>
                <TableHead className="text-right">Balance Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading receivables...</TableCell></TableRow>
              ) : filteredReceivables.length > 0 ? (
                filteredReceivables.map((inv) => {
                  const grandTotal = calcInvoiceGrossTotal(inv);
                  const amountPaid = inv.amountPaid || 0;
                  const balanceDue = grandTotal - amountPaid;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(inv.invoiceDate), "PPP")}</TableCell>
                      <TableCell className="font-medium">{getClientName(inv.clientId)}</TableCell>
                      <TableCell className="font-mono text-sm">{inv.id}</TableCell>
                      <TableCell>
                        <Badge
                          variant={inv.status === 'partially paid' ? 'default' : 'outline'}
                          className={inv.status === 'partially paid' ? 'bg-blue-600' : ''}
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(grandTotal)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(amountPaid)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(balanceDue)}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No outstanding customer balances found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6} className="text-right text-lg font-bold">Total Receivables</TableCell>
                <TableCell className="text-right text-lg font-bold">{formatCurrency(totalReceivables)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
