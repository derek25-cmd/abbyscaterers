
'use client';

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { getPurchases } from "@/services/purchaseService";
import { Purchase } from "@/types";
import { format } from "date-fns";
import { Search, BookUp, TrendingDown } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";

export default function PayablesPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: purchases = [], isLoading } = useQuery<Purchase[]>({
    queryKey: ['purchases'],
    queryFn: getPurchases,
  });

  const outstandingPurchases = useMemo(() => {
    return purchases.filter(p => p.paymentStatus === 'unpaid');
  }, [purchases]);
  
  const filteredPayables = useMemo(() => {
    if (!searchQuery) return outstandingPurchases;
    return outstandingPurchases.filter(p => 
      p.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [outstandingPurchases, searchQuery]);

  const totalPayables = useMemo(() => {
    return filteredPayables.reduce((sum, p) => sum + p.totalCost, 0);
  }, [filteredPayables]);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount);
  }

  return (
    <div className="space-y-6">
        <StatsCard
            title="Total Accounts Payable"
            value={formatCurrency(totalPayables)}
            change={`${filteredPayables.length} unpaid invoices`}
            changeType="negative"
            icon={TrendingDown}
            description="Total amount owed to suppliers."
        />
        <Card>
        <CardHeader>
             <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="flex items-center gap-2">
                    <BookUp />
                    Accounts Payable Ledger
                    </CardTitle>
                    <CardDescription>
                    This ledger tracks all amounts your company owes to suppliers from unpaid purchases.
                    </CardDescription>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by supplier or invoice..."
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
                    <TableHead>Supplier</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead className="text-right">Amount Owed</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading payables...</TableCell></TableRow>
                ) : filteredPayables.length > 0 ? (
                    filteredPayables.map((purchase) => (
                    <TableRow key={purchase.id}>
                        <TableCell>{format(new Date(purchase.date), "PPP")}</TableCell>
                        <TableCell>{purchase.supplier}</TableCell>
                        <TableCell>{purchase.invoiceNumber}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(purchase.totalCost)}</TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        No outstanding supplier balances found.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} className="text-right text-lg font-bold">Total Payables</TableCell>
                        <TableCell className="text-right text-lg font-bold">{formatCurrency(totalPayables)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </CardContent>
        </Card>
    </div>
  );
}
