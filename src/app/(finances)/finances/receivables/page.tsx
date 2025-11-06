
'use client';

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { getSales } from "@/services/saleService";
import { useClientStorage } from "@/hooks/use-client-storage";
import { Sale } from "@/types";
import { format } from "date-fns";
import { Search, BookUser, TrendingUp } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";

export default function ReceivablesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { clients } = useClientStorage();

  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ['sales'],
    queryFn: getSales,
  });

  const getClientName = (customerId: string) => {
    const client = clients.find(c => c.id === customerId);
    return client?.companyName || 'Unknown';
  };

  const outstandingSales = useMemo(() => {
    return sales.filter(s => s.paymentStatus === 'unpaid');
  }, [sales]);
  
  const filteredReceivables = useMemo(() => {
    if (!searchQuery) return outstandingSales;
    return outstandingSales.filter(s => 
      getClientName(s.customerId).toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [outstandingSales, searchQuery, clients]);

  const totalReceivables = useMemo(() => {
    return filteredReceivables.reduce((sum, s) => sum + s.totalAmount, 0);
  }, [filteredReceivables]);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount);
  }

  return (
     <div className="space-y-6">
        <StatsCard
            title="Total Accounts Receivable"
            value={formatCurrency(totalReceivables)}
            change={`${filteredReceivables.length} outstanding invoices`}
            changeType="warning"
            icon={TrendingUp}
            description="Total amount owed by customers."
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
                        This ledger shows all amounts owed by your customers from unpaid sales.
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
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead className="text-right">Amount Due</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading receivables...</TableCell></TableRow>
                    ) : filteredReceivables.length > 0 ? (
                        filteredReceivables.map((sale) => (
                        <TableRow key={sale.id}>
                            <TableCell>{format(new Date(sale.date), "PPP")}</TableCell>
                            <TableCell>{getClientName(sale.customerId)}</TableCell>
                            <TableCell>{sale.invoiceNumber}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(sale.totalAmount)}</TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                            No outstanding customer balances found.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={3} className="text-right text-lg font-bold">Total Receivables</TableCell>
                            <TableCell className="text-right text-lg font-bold">{formatCurrency(totalReceivables)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}

