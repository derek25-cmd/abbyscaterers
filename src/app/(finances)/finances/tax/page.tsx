'use client';

import { useState, useMemo } from "react";
import { Search, FileText, CheckCircle2, AlertCircle, RefreshCw, Landmark, Percent, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { getTaxRecords, updateTaxFilingStatus, addTaxRecord } from "@/services/taxService";
import { getInvoices } from "@/services/invoiceService";
import { getPurchases } from "@/services/purchaseService";
import { getExpenses } from "@/services/expenseService";
import { getPayrolls } from "@/services/payrollService";
import { TaxRecord, Invoice } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

function calcInvoiceTotals(inv: Invoice) {
  const subtotal = inv.items.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
  const totalBeforeVAT = totalForDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);
  if (inv.vatType === 'exclusive') {
    const vatAmount = totalBeforeVAT * 0.18;
    return { netAmount: totalBeforeVAT, vatAmount, grandTotal: totalBeforeVAT + vatAmount };
  }
  const grandTotal = totalBeforeVAT;
  const netAmount = grandTotal / 1.18;
  return { netAmount, vatAmount: grandTotal - netAmount, grandTotal };
}

interface ComputedTaxEntry {
  key: string;
  dbId?: string;
  event_id: string;
  date: string;
  tax_type: TaxRecord['tax_type'];
  ref_ledger: TaxRecord['ref_ledger'];
  ref_record: string;
  base_amount: number;
  tax_rate: number;
  tax_amount: number;
  filing_st: 'accrued' | 'filed' | 'paid';
}

export default function TaxBookPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [taxTypeFilter, setTaxTypeFilter] = useState<string>("ALL");

  const { data: taxRecords = [], refetch: refetchTax } = useQuery<TaxRecord[]>({
    queryKey: ['taxRecords'],
    queryFn: getTaxRecords,
  });

  const { data: invoices = [], refetch: refetchInvoices } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices });
  const { data: purchases = [] } = useQuery({ queryKey: ['purchases'], queryFn: getPurchases });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: getExpenses });
  const { data: payrolls = [] } = useQuery({ queryKey: ['payrolls'], queryFn: getPayrolls });

  // Build lookup maps from persisted tax records (filing status + DB id by source key)
  const taxFilingMap = useMemo(() => {
    const map: Record<string, 'accrued' | 'filed' | 'paid'> = {};
    taxRecords.forEach(r => { map[`${r.ref_ledger}-${r.ref_record}`] = r.filing_st; });
    return map;
  }, [taxRecords]);

  const taxIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    taxRecords.forEach(r => { map[`${r.ref_ledger}-${r.ref_record}`] = r.id; });
    return map;
  }, [taxRecords]);

  // Compute all tax obligations live from source ledgers
  const computedEntries = useMemo((): ComputedTaxEntry[] => {
    const entries: ComputedTaxEntry[] = [];

    // Output VAT 18% — sourced from issued Invoices
    invoices.forEach(inv => {
      if (!inv.items || inv.items.length === 0) return;
      const { netAmount, vatAmount } = calcInvoiceTotals(inv);
      if (vatAmount <= 0) return;
      const key = `sales-${inv.id}`;
      entries.push({
        key,
        dbId: taxIdMap[key],
        event_id: (inv as any).booking_id || 'GENERAL',
        date: inv.invoiceDate,
        tax_type: 'VAT Output',
        ref_ledger: 'sales',
        ref_record: inv.id,
        base_amount: netAmount,
        tax_rate: 18,
        tax_amount: vatAmount,
        filing_st: taxFilingMap[key] || 'accrued',
      });
    });

    // Input VAT 18% — sourced from Purchases with tax amount
    purchases.forEach(p => {
      if ((p.taxAmount || 0) <= 0) return;
      const key = `purchases-${p.id}`;
      entries.push({
        key,
        dbId: taxIdMap[key],
        event_id: p.event_id || 'GENERAL',
        date: p.date,
        tax_type: 'VAT Input',
        ref_ledger: 'purchases',
        ref_record: p.id,
        base_amount: p.totalCost - (p.taxAmount || 0),
        tax_rate: 18,
        tax_amount: p.taxAmount,
        filing_st: taxFilingMap[key] || 'accrued',
      });
    });

    // WHT 5% — sourced from Expenses categorised as Venue Rent or subcontracting
    expenses.forEach(e => {
      const isWHTSubject =
        e.category === 'Venue Rent' ||
        e.description.toLowerCase().includes('subcontract') ||
        e.description.toLowerCase().includes('decor');
      if (!isWHTSubject) return;
      const whtAmount = Math.round(e.amount * 0.05);
      if (whtAmount <= 0) return;
      const key = `expenses-${e.id}`;
      entries.push({
        key,
        dbId: taxIdMap[key],
        event_id: e.event_id || 'GENERAL',
        date: e.date,
        tax_type: 'WHT Resident 5%',
        ref_ledger: 'expenses',
        ref_record: e.id,
        base_amount: e.amount,
        tax_rate: 5,
        tax_amount: whtAmount,
        filing_st: taxFilingMap[key] || 'accrued',
      });
    });

    // PAYE — sourced from Payroll deductions (estimated at 60% of deductions per TRA progressive rates)
    payrolls.forEach(pay => {
      if ((pay.deductions || 0) <= 0) return;
      const estimatedPAYE = Math.round(pay.deductions * 0.6);
      if (estimatedPAYE <= 0) return;
      const key = `payroll-${pay.id}`;
      entries.push({
        key,
        dbId: taxIdMap[key],
        event_id: pay.event_id || 'MONTHLY_CORE',
        date: pay.paymentDate || pay.payPeriodEnd,
        tax_type: 'PAYE',
        ref_ledger: 'payroll',
        ref_record: pay.id,
        base_amount: pay.grossSalary,
        tax_rate: 9,
        tax_amount: estimatedPAYE,
        filing_st: taxFilingMap[key] || 'accrued',
      });
    });

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, purchases, expenses, payrolls, taxFilingMap, taxIdMap]);

  const filteredEntries = useMemo(() => {
    return computedEntries.filter(r => {
      const matchesSearch =
        r.event_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.tax_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.ref_ledger.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.ref_record.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = taxTypeFilter === "ALL" || r.tax_type === taxTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [computedEntries, searchQuery, taxTypeFilter]);

  // Aggregate TRA tax position from all computed entries
  const vatSummary = useMemo(() => {
    const outputVAT = computedEntries.filter(r => r.tax_type === 'VAT Output').reduce((sum, r) => sum + r.tax_amount, 0);
    const inputVAT = computedEntries.filter(r => r.tax_type === 'VAT Input').reduce((sum, r) => sum + r.tax_amount, 0);
    const netVAT = outputVAT - inputVAT;
    const outstandingPAYE = computedEntries.filter(r => r.tax_type === 'PAYE' && r.filing_st !== 'paid').reduce((sum, r) => sum + r.tax_amount, 0);
    const outstandingWHT = computedEntries.filter(r => (r.tax_type === 'WHT Resident 5%' || r.tax_type === 'WHT Resident 2%') && r.filing_st !== 'paid').reduce((sum, r) => sum + r.tax_amount, 0);
    return { outputVAT, inputVAT, netVAT, outstandingPAYE, outstandingWHT };
  }, [computedEntries]);

  const handleToggleStatus = async (entry: ComputedTaxEntry) => {
    const currentStatus = entry.filing_st;
    let nextStatus: 'accrued' | 'filed' | 'paid' = 'accrued';
    if (currentStatus === 'accrued') nextStatus = 'filed';
    else if (currentStatus === 'filed') nextStatus = 'paid';

    if (entry.dbId) {
      await updateTaxFilingStatus(entry.dbId, nextStatus);
    } else {
      await addTaxRecord({
        event_id: entry.event_id,
        date: entry.date,
        tax_type: entry.tax_type,
        ref_ledger: entry.ref_ledger,
        ref_record: entry.ref_record,
        base_amount: entry.base_amount,
        tax_rate: entry.tax_rate,
        tax_amount: entry.tax_amount,
        filing_st: nextStatus,
      });
    }

    toast({
      title: "Tax Filing Status Updated",
      description: `Record is now classified as ${nextStatus.toUpperCase()} with TRA.`,
    });
    refetchTax();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white w-fit">Paid to TRA</Badge>;
      case 'filed':
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white w-fit">Filing Logged</Badge>;
      default:
        return <Badge variant="outline" className="border-amber-600 text-amber-700 w-fit">Accrued / Outstanding</Badge>;
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');

  return (
    <div className="space-y-6">
      {/* Dynamic TRA Tax Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Output VAT (Revenue)</CardTitle>
            <Receipt className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(vatSummary.outputVAT)}</div>
            <p className="text-xs text-muted-foreground">Standard 18% charged on invoiced sales</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Input VAT (Claims)</CardTitle>
            <Percent className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(vatSummary.inputVAT)}</div>
            <p className="text-xs text-muted-foreground">Recoverable from standard-rated purchases</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net VAT Obligation</CardTitle>
            {vatSummary.netVAT >= 0
              ? <AlertCircle className="h-4 w-4 text-amber-500" />
              : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", vatSummary.netVAT >= 0 ? "text-amber-600" : "text-emerald-600")}>
              {formatCurrency(Math.abs(vatSummary.netVAT))}
            </div>
            <p className="text-xs text-muted-foreground">
              {vatSummary.netVAT >= 0 ? "Payable to TRA" : "Refund claimable from TRA"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PAYE & WHT Liability</CardTitle>
            <Landmark className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(vatSummary.outstandingPAYE + vatSummary.outstandingWHT)}
            </div>
            <p className="text-xs text-muted-foreground">Unfiled payroll & subcontracting tax</p>
          </CardContent>
        </Card>
      </div>

      {/* Tax Records Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText />
                Tanzania Tax Book (TRA Ledgers)
              </CardTitle>
              <CardDescription>
                Computed live from Invoices (VAT Output), Purchases (VAT Input), Expenses (WHT 5%), and Payroll (PAYE). Click "Cycle Status" to log filing progress with TRA.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={taxTypeFilter} onValueChange={setTaxTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Tax Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Tax Types</SelectItem>
                  <SelectItem value="VAT Output">VAT Output (Sales)</SelectItem>
                  <SelectItem value="VAT Input">VAT Input (Purchases)</SelectItem>
                  <SelectItem value="WHT Resident 5%">WHT Resident 5% (Services)</SelectItem>
                  <SelectItem value="WHT Resident 2%">WHT Resident 2% (Goods)</SelectItem>
                  <SelectItem value="PAYE">PAYE (Payroll)</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => { refetchTax(); refetchInvoices(); }} variant="outline" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="pt-2">
            <div className="relative w-full md:w-[320px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Event ID, ledger source, or reference..."
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
                <TableHead>Assessment Date</TableHead>
                <TableHead>Tax Category</TableHead>
                <TableHead>Source Ledger</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Event ID</TableHead>
                <TableHead className="text-right">Base Amount</TableHead>
                <TableHead className="text-right">TRA Rate</TableHead>
                <TableHead className="text-right">Tax Obligation</TableHead>
                <TableHead>TRA Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length > 0 ? (
                filteredEntries.map((rec) => (
                  <TableRow key={rec.key}>
                    <TableCell className="whitespace-nowrap">{format(new Date(rec.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-semibold">{rec.tax_type}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{rec.ref_ledger}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate" title={rec.ref_record}>{rec.ref_record}</TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-blue-600 text-xs">{rec.event_id}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(rec.base_amount)}</TableCell>
                    <TableCell className="text-right font-medium">{rec.tax_rate}%</TableCell>
                    <TableCell className="text-right font-bold text-amber-600">{formatCurrency(rec.tax_amount)}</TableCell>
                    <TableCell>{getStatusBadge(rec.filing_st)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(rec)}
                        className="text-xs font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      >
                        Cycle Status
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    No tax obligations found. Issue invoices, record purchases with VAT, or process payroll to populate this ledger.
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
