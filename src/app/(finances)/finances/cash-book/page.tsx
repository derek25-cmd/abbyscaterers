'use client';

import { useState, useMemo } from "react";
import { Landmark, ArrowDownLeft, ArrowUpRight, Search, CreditCard, RefreshCw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { getInvoices } from "@/services/invoiceService";
import { getPurchases } from "@/services/purchaseService";
import { getExpenses } from "@/services/expenseService";
import { getPayrolls } from "@/services/payrollService";
import { Invoice } from "@/types";
import { format } from "date-fns";

export default function CashBookPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("ALL");

  // Fetch all ledgers to construct the Cash Book dynamically (double-entry convergence)
  const { data: invoices = [], isLoading: sLoading } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices, staleTime: 5 * 60 * 1000 });
  const { data: purchases = [], isLoading: pLoading } = useQuery({ queryKey: ['purchases'], queryFn: getPurchases, staleTime: 5 * 60 * 1000 });
  const { data: expenses = [], isLoading: eLoading } = useQuery({ queryKey: ['expenses'], queryFn: getExpenses, staleTime: 5 * 60 * 1000 });
  const { data: payrolls = [], isLoading: payLoading } = useQuery({ queryKey: ['payrolls'], queryFn: getPayrolls, staleTime: 5 * 60 * 1000 });

  // Merge, filter, and sort transactions chronologically to calculate running balances
  const chronologicalCashFlow = useMemo(() => {
    const cashBookEntries: Array<{
      id: string;
      date: string;
      description: string;
      event_id: string;
      type: 'INFLOW' | 'OUTFLOW';
      method: 'cash' | 'bank' | 'mobile_money';
      reference: string;
      amount: number;
    }> = [];

    // 1. Paid and Partially Paid Invoices are Inflows
    const calcGrossTotal = (inv: Invoice) => {
      const subtotal = inv.items.reduce((sum, item) => sum + (item.total || 0), 0);
      const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
      const totalBeforeVAT = totalForDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);
      return inv.vatType === 'exclusive' ? totalBeforeVAT * 1.18 : totalBeforeVAT;
    };
    invoices
      .filter(inv => inv.status === 'paid' || inv.status === 'partially paid')
      .forEach(inv => {
        const amount = inv.status === 'partially paid' ? (inv.amountPaid || 0) : calcGrossTotal(inv);
        if (amount <= 0) return;
        cashBookEntries.push({
          id: inv.id,
          date: inv.paymentDate || inv.invoiceDate,
          description: `Revenue: ${inv.serviceDesc || inv.customEventType || inv.selectedEventType || 'Catering Services'}`,
          event_id: (inv as any).booking_id || 'GENERAL',
          type: 'INFLOW',
          method: 'bank',
          reference: inv.id,
          amount,
        });
      });

    // 2. Paid Purchases are Outflows
    purchases.filter(p => p.paymentStatus === 'paid').forEach(p => {
      cashBookEntries.push({
        id: p.id,
        date: p.date,
        description: `COGS: ${p.supplier} - ${p.description}`,
        event_id: p.event_id || 'GENERAL',
        type: 'OUTFLOW',
        method: p.paymentMethod === 'bank' ? 'bank' : p.paymentMethod === 'credit' ? 'bank' : 'cash',
        reference: p.invoiceNumber,
        amount: p.totalCost
      });
    });

    // 3. Paid Expenses are Outflows
    expenses.forEach(e => {
      cashBookEntries.push({
        id: e.id,
        date: e.date,
        description: `Expense: ${e.payee} - ${e.description}`,
        event_id: e.event_id,
        type: 'OUTFLOW',
        method: e.payment_md,
        reference: e.ref_number,
        amount: e.amount
      });
    });

    // 4. Paid Payroll are Outflows
    payrolls.filter(pay => pay.status === 'Paid').forEach(pay => {
      cashBookEntries.push({
        id: pay.id,
        date: pay.paymentDate || format(new Date(), 'yyyy-MM-dd'),
        description: `Payroll: Wages for ${pay.employeeName}`,
        event_id: pay.event_id || 'MONTHLY_CORE',
        type: 'OUTFLOW',
        method: 'bank', // Standard salaries paid through bank transfers
        reference: pay.id,
        amount: pay.netSalary
      });
    });

    // Sort chronologically (ascending to calculate chronological running balance)
    const sorted = cashBookEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate chronological running balance and attach to objects
    let runningBalance = 150000000.00; // Seed with Tanzanian catering startup cash reserves: 150M TZS
    
    return sorted.map(entry => {
      if (entry.type === 'INFLOW') {
        runningBalance += entry.amount;
      } else {
        runningBalance -= entry.amount;
      }
      return {
        ...entry,
        runningBalance
      };
    }).reverse(); // Reverse to display newest first in the UI
  }, [invoices, purchases, expenses, payrolls]);

  const filteredCashFlow = useMemo(() => {
    return chronologicalCashFlow.filter(e => {
      const matchesSearch = 
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.event_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.reference.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesMethod = paymentMethodFilter === "ALL" || e.method === paymentMethodFilter;

      return matchesSearch && matchesMethod;
    });
  }, [chronologicalCashFlow, searchQuery, paymentMethodFilter]);

  // Aggregate current cash balances
  const balances = useMemo(() => {
    let cash = 10000000.00; // Starting Cash In Hand
    let bank = 100000000.00; // Starting Stanbic Bank account
    let mobile = 40000000.00; // Starting M-Pesa Business Wallet

    chronologicalCashFlow.forEach(e => {
      const modifier = e.type === 'INFLOW' ? e.amount : -e.amount;
      if (e.method === 'cash') cash += modifier;
      else if (e.method === 'bank') bank += modifier;
      else if (e.method === 'mobile_money') mobile += modifier;
    });

    return { cash, bank, mobile, total: cash + bank + mobile };
  }, [chronologicalCashFlow]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'bank':
        return <Badge variant="outline" className="border-blue-600 text-blue-700 font-bold bg-blue-50/10">Stanbic Bank</Badge>;
      case 'mobile_money':
        return <Badge variant="outline" className="border-emerald-600 text-emerald-700 font-bold bg-emerald-50/10">M-Pesa</Badge>;
      default:
        return <Badge variant="outline" className="border-amber-600 text-amber-700 font-bold bg-amber-50/10">Cash Box</Badge>;
    }
  };

  const isDataLoading = sLoading || pLoading || eLoading || payLoading;

  return (
    <div className="space-y-6">
      {/* Balances Dashboard */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consolidated Cash Reserves</CardTitle>
            <Layers className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(balances.total)}</div>
            <p className="text-xs text-muted-foreground">Total cash running balance</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stanbic Bank Balance</CardTitle>
            <Landmark className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(balances.bank)}</div>
            <p className="text-xs text-muted-foreground">Bank account liquid deposits</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">M-Pesa Wallet Balance</CardTitle>
            <CreditCard className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(balances.mobile)}</div>
            <p className="text-xs text-muted-foreground">VodaCom M-Pesa Merchant Wallet</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Office Cash Safe</CardTitle>
            <Landmark className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(balances.cash)}</div>
            <p className="text-xs text-muted-foreground">Physical petty cash safe balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Cash Book Entries Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>Cash Book Chronological Ledger</CardTitle>
              <CardDescription>
                Consolidated statement of cash inflows and outflows from Sales, Purchases, Expenses, and Payroll.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Wallets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Wallets</SelectItem>
                  <SelectItem value="bank">Stanbic Bank</SelectItem>
                  <SelectItem value="mobile_money">M-Pesa Wallet</SelectItem>
                  <SelectItem value="cash">Cash Box</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="pt-2">
            <div className="relative w-full md:w-[320px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search description, reference, Event ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-background pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Event ID</TableHead>
                <TableHead>Ledger Description</TableHead>
                <TableHead>Reference #</TableHead>
                <TableHead>Disbursement Method</TableHead>
                <TableHead className="text-right">Inflow (+)</TableHead>
                <TableHead className="text-right">Outflow (-)</TableHead>
                <TableHead className="text-right">Running Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isDataLoading ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center">Reconciling liquid balances chronologically...</TableCell></TableRow>
              ) : filteredCashFlow.length > 0 ? (
                filteredCashFlow.map((entry) => (
                  <TableRow key={entry.id + entry.type}>
                    <TableCell className="whitespace-nowrap">{format(new Date(entry.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-blue-600">{entry.event_id}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{entry.description}</TableCell>
                    <TableCell className="font-mono text-xs">{entry.reference}</TableCell>
                    <TableCell>{getMethodBadge(entry.method)}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-semibold">
                      {entry.type === 'INFLOW' ? `+ ${formatCurrency(entry.amount)}` : ''}
                    </TableCell>
                    <TableCell className="text-right text-red-500 font-semibold">
                      {entry.type === 'OUTFLOW' ? `- ${formatCurrency(entry.amount)}` : ''}
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground">
                      {formatCurrency(entry.runningBalance)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No cashflow transactions recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
