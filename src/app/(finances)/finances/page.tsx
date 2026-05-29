'use client';

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getInvoices } from "@/services/invoiceService";
import { getPurchases } from "@/services/purchaseService";
import { getExpenses } from "@/services/expenseService";
import { getPayrolls } from "@/services/payrollService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, FileText, ChevronRight, CalendarIcon, Receipt, ShoppingBag, Banknote, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Invoice } from "@/types";

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

// Normalise any date string to YYYY-MM-DD
function toDateStr(d: string | null | undefined): string {
  if (!d) return '';
  return d.slice(0, 10);
}

export default function FinancesRedirectPage() {
  const [selectedDate, setSelectedDate] = useState<string>('');

  const { data: invoices = [], isLoading: sLoad } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices, staleTime: 5 * 60 * 1000 });
  const { data: purchases = [], isLoading: pLoad } = useQuery({ queryKey: ['purchases'], queryFn: getPurchases, staleTime: 5 * 60 * 1000 });
  const { data: expenses = [], isLoading: eLoad } = useQuery({ queryKey: ['expenses'], queryFn: getExpenses, staleTime: 5 * 60 * 1000 });
  const { data: payrolls = [], isLoading: payLoad } = useQuery({ queryKey: ['payrolls'], queryFn: getPayrolls, staleTime: 5 * 60 * 1000 });

  // Collect every date that has any financial record — sorted most-recent first
  const activeDates = useMemo(() => {
    const dates = new Set<string>();
    invoices.forEach(inv => { const d = toDateStr(inv.invoiceDate); if (d) dates.add(d); });
    purchases.forEach(p => { const d = toDateStr(p.date); if (d) dates.add(d); });
    expenses.forEach(e => { const d = toDateStr(e.date); if (d) dates.add(d); });
    payrolls.forEach(pay => { const d = toDateStr(pay.paymentDate || pay.payPeriodEnd); if (d) dates.add(d); });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [invoices, purchases, expenses, payrolls]);

  // Which date is currently displayed (defaults to most-recent active date)
  const currentDate = selectedDate || activeDates[0] || '';

  // Convert Set of date strings to JS Date objects for the calendar modifiers
  const activeDateObjects = useMemo(
    () => activeDates.map(d => parseISO(d)),
    [activeDates]
  );

  // Compute full P&L for the selected date
  const datePLData = useMemo(() => {
    if (!currentDate) return null;

    // Revenue — invoices issued on this date
    const dateInvoices = invoices.filter(inv => toDateStr(inv.invoiceDate) === currentDate);
    let grossRevenue = 0, outputVAT = 0;
    const invoiceRows = dateInvoices.map(inv => {
      const t = calcInvoiceTotals(inv);
      grossRevenue += t.grandTotal;
      outputVAT += t.vatAmount;
      return { inv, ...t };
    });
    const netRevenue = grossRevenue - outputVAT;

    // COGS — purchases made on this date
    const datePurchases = purchases.filter(p => toDateStr(p.date) === currentDate);
    const grossPurchases = datePurchases.reduce((sum, p) => sum + p.totalCost, 0);
    const inputVATPurchases = datePurchases.reduce((sum, p) => sum + (p.taxAmount || 0), 0);
    const netPurchases = grossPurchases - inputVATPurchases;

    // Overheads — expenses on this date
    const dateExpenses = expenses.filter(e => toDateStr(e.date) === currentDate);
    const grossExpenses = dateExpenses.reduce((sum, e) => sum + e.amount, 0);
    const inputVATExpenses = dateExpenses.reduce((sum, e) => sum + (e.vat_amount || 0), 0);
    const netExpenses = grossExpenses - inputVATExpenses;

    // Labour — payrolls on this date
    const datePayrolls = payrolls.filter(pay => toDateStr(pay.paymentDate || pay.payPeriodEnd) === currentDate);
    const netWages = datePayrolls.reduce((sum, pay) => sum + pay.netSalary, 0);
    const wcfContrib = datePayrolls.reduce((sum, pay) => sum + (pay.wcf_contrib || 0), 0);
    const payeWithheld = datePayrolls.reduce((sum, pay) => sum + pay.deductions * 0.6, 0);

    const totalCosts = netPurchases + netWages + netExpenses + wcfContrib;
    const netProfit = netRevenue - totalCosts;
    const netMarginPercentage = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    return {
      date: currentDate,
      invoiceRows,
      datePurchases,
      dateExpenses,
      datePayrolls,
      grossRevenue,
      netRevenue,
      outputVAT,
      grossPurchases,
      netPurchases,
      inputVATPurchases,
      grossExpenses,
      netExpenses,
      inputVATExpenses,
      netWages,
      wcfContrib,
      payeWithheld,
      totalCosts,
      netProfit,
      netMarginPercentage,
    };
  }, [currentDate, invoices, purchases, expenses, payrolls]);

  // Last 12 active dates for the comparison bar chart (chronological order)
  const comparisonChartData = useMemo(() => {
    return activeDates.slice(0, 12).reverse().map(date => {
      const dateInvoices = invoices.filter(inv => toDateStr(inv.invoiceDate) === date);
      const revenue = dateInvoices.reduce((sum, inv) => sum + calcInvoiceTotals(inv).netAmount, 0);

      const datePurchases = purchases.filter(p => toDateStr(p.date) === date);
      const materials = datePurchases.reduce((sum, p) => sum + (p.totalCost - (p.taxAmount || 0)), 0);

      const dateExpenses = expenses.filter(e => toDateStr(e.date) === date);
      const overheads = dateExpenses.reduce((sum, e) => sum + (e.amount - (e.vat_amount || 0)), 0);

      const datePayrolls = payrolls.filter(pay => toDateStr(pay.paymentDate || pay.payPeriodEnd) === date);
      const labor = datePayrolls.reduce((sum, pay) => sum + pay.netSalary + (pay.wcf_contrib || 0), 0);

      const totalCosts = materials + overheads + labor;
      const netProfit = revenue - totalCosts;

      return {
        name: format(parseISO(date), 'dd MMM'),
        date,
        'Net Revenue': Math.round(revenue),
        'Total Costs': Math.round(totalCosts),
        'Net Profit': Math.round(netProfit),
      };
    });
  }, [activeDates, invoices, purchases, expenses, payrolls]);

  const pieChartData = useMemo(() => {
    if (!datePLData) return [];
    return [
      { name: 'Ingredients (COGS)', value: datePLData.netPurchases, color: '#10b981' },
      { name: 'Casual Wages', value: datePLData.netWages, color: '#3b82f6' },
      { name: 'Direct Overheads', value: datePLData.netExpenses, color: '#f59e0b' },
      { name: 'TRA Labour Taxes', value: datePLData.wcfContrib + datePLData.payeWithheld, color: '#ef4444' },
    ].filter(item => item.value > 0);
  }, [datePLData]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');

  const isSyncLoading = sLoad || pLoad || eLoad || payLoad;

  // Summary badge for the date picker trigger
  const dateSummary = useMemo(() => {
    if (!datePLData) return null;
    const counts = [];
    if (datePLData.invoiceRows.length) counts.push(`${datePLData.invoiceRows.length} invoice${datePLData.invoiceRows.length > 1 ? 's' : ''}`);
    if (datePLData.datePurchases.length) counts.push(`${datePLData.datePurchases.length} purchase${datePLData.datePurchases.length > 1 ? 's' : ''}`);
    if (datePLData.dateExpenses.length) counts.push(`${datePLData.dateExpenses.length} expense${datePLData.dateExpenses.length > 1 ? 's' : ''}`);
    if (datePLData.datePayrolls.length) counts.push(`${datePLData.datePayrolls.length} payroll${datePLData.datePayrolls.length > 1 ? 's' : ''}`);
    return counts.join(' · ') || 'No records';
  }, [datePLData]);

  return (
    <div className="space-y-6">
      {/* Header — date-based P&L selector */}
      <Card className="bg-card border-amber-600/20">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2 text-foreground">
              <TrendingUp className="text-amber-600" />
              Daily Financial Profitability Analyser
            </CardTitle>
            <CardDescription>
              All ledgers (Sales, Purchases, Expenses, Payroll) are linked by <strong>date</strong>.
              Select any date to see a consolidated P&L statement for that day's financial activity.
            </CardDescription>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-[260px] justify-start font-normal', !currentDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
                  {currentDate ? format(parseISO(currentDate), 'PPP') : (isSyncLoading ? 'Loading dates…' : 'No records found')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={currentDate ? parseISO(currentDate) : undefined}
                  onSelect={(d) => d && setSelectedDate(format(d, 'yyyy-MM-dd'))}
                  modifiers={{ active: activeDateObjects }}
                  modifiersClassNames={{ active: 'bg-amber-500/20 font-bold text-amber-700 rounded-md' }}
                  initialFocus
                />
                {activeDates.length > 0 && (
                  <div className="border-t p-2 text-xs text-muted-foreground text-center">
                    Highlighted dates have financial records
                  </div>
                )}
              </PopoverContent>
            </Popover>
            {dateSummary && (
              <span className="text-xs text-muted-foreground">{dateSummary}</span>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Quick-stats row for selected date */}
      {datePLData && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue (Net)</CardTitle>
              <Receipt className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(datePLData.netRevenue)}</div>
              <p className="text-xs text-muted-foreground">{datePLData.invoiceRows.length} invoice(s) excl. VAT</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">COGS (Purchases)</CardTitle>
              <ShoppingBag className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-emerald-600">{formatCurrency(datePLData.netPurchases)}</div>
              <p className="text-xs text-muted-foreground">{datePLData.datePurchases.length} purchase(s) excl. VAT</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overheads + Labour</CardTitle>
              <Users className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-amber-600">{formatCurrency(datePLData.netExpenses + datePLData.netWages + datePLData.wcfContrib)}</div>
              <p className="text-xs text-muted-foreground">{datePLData.dateExpenses.length} expense(s) · {datePLData.datePayrolls.length} payroll(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit / (Loss)</CardTitle>
              <Banknote className={cn('h-4 w-4', datePLData.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500')} />
            </CardHeader>
            <CardContent>
              <div className={cn('text-xl font-bold', datePLData.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                {formatCurrency(datePLData.netProfit)}
              </div>
              <p className="text-xs text-muted-foreground">Margin: {datePLData.netMarginPercentage.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts row */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Recent Dates — Revenue vs Costs vs Profit
            </CardTitle>
            <CardDescription>Last {comparisonChartData.length} dates with financial records.</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {isSyncLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Loading data…</div>
            ) : comparisonChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={v => formatCurrency(v as number)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Net Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Total Costs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm text-center">
                No financial records found yet. Start by recording invoices, purchases, or expenses.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Cost Allocation</CardTitle>
            <CardDescription>
              {currentDate ? `Breakdown for ${format(parseISO(currentDate), 'MMM dd, yyyy')}` : 'Select a date'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[280px]">
            {pieChartData.length > 0 ? (
              <>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => formatCurrency(v as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs w-full px-2 pt-2">
                  {pieChartData.map(item => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="truncate text-muted-foreground" title={item.name}>{item.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground text-sm text-center">
                {currentDate ? 'No cost records for this date.' : 'Select a date to see breakdown.'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full P&L Statement for selected date */}
      {datePLData && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader className="border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Daily P&L Statement</CardTitle>
                  <CardDescription>
                    All financial records dated <span className="font-bold text-foreground">{format(parseISO(datePLData.date), 'PPP')}</span>
                  </CardDescription>
                </div>
                <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                  {format(parseISO(datePLData.date), 'EEE, MMM dd')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableBody>
                  {/* A. Revenue */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="font-bold text-base text-blue-600 uppercase tracking-wider">A. Revenue (Sales Invoices)</TableCell>
                  </TableRow>
                  {datePLData.invoiceRows.length > 0 ? (
                    datePLData.invoiceRows.map(({ inv, netAmount }) => {
                      const description = inv.serviceDesc || inv.customEventType || inv.selectedEventType || 'Catering Services';
                      return (
                        <TableRow key={inv.id} className="text-sm">
                          <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            Invoice {inv.id} — {description}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(netAmount)}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow><TableCell colSpan={2} className="pl-6 text-muted-foreground italic text-sm">No invoices on this date.</TableCell></TableRow>
                  )}
                  <TableRow className="bg-blue-50/10 font-bold border-y">
                    <TableCell className="pl-6">Total Net Revenue</TableCell>
                    <TableCell className="text-right text-blue-600">{formatCurrency(datePLData.netRevenue)}</TableCell>
                  </TableRow>

                  {/* B. COGS */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="font-bold text-base text-emerald-600 uppercase tracking-wider pt-6">B. Cost of Goods Sold (Purchases)</TableCell>
                  </TableRow>
                  {datePLData.datePurchases.length > 0 ? (
                    datePLData.datePurchases.map(p => (
                      <TableRow key={p.id} className="text-sm">
                        <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          {p.invoiceNumber}: {p.supplier} — {p.description}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.totalCost - (p.taxAmount || 0))}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={2} className="pl-6 text-muted-foreground italic text-sm">No purchases on this date.</TableCell></TableRow>
                  )}
                  <TableRow className="bg-emerald-50/10 font-bold border-y">
                    <TableCell className="pl-6">Total Net Material Cost</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatCurrency(datePLData.netPurchases)}</TableCell>
                  </TableRow>

                  {/* C. Labour */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="font-bold text-base text-indigo-600 uppercase tracking-wider pt-6">C. Labour (Payroll)</TableCell>
                  </TableRow>
                  {datePLData.datePayrolls.length > 0 ? (
                    <>
                      {datePLData.datePayrolls.map(pay => (
                        <TableRow key={pay.id} className="text-sm">
                          <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            {pay.employeeName}{pay.days_worked ? ` — ${pay.days_worked} days @ ${formatCurrency(pay.daily_rate || 0)}` : ''}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(pay.netSalary)}</TableCell>
                        </TableRow>
                      ))}
                      {datePLData.wcfContrib > 0 && (
                        <TableRow className="text-sm">
                          <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            Employer WCF Contribution (0.5% TRA)
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(datePLData.wcfContrib)}</TableCell>
                        </TableRow>
                      )}
                    </>
                  ) : (
                    <TableRow><TableCell colSpan={2} className="pl-6 text-muted-foreground italic text-sm">No payroll entries on this date.</TableCell></TableRow>
                  )}
                  <TableRow className="bg-indigo-50/10 font-bold border-y">
                    <TableCell className="pl-6">Total Labour Cost</TableCell>
                    <TableCell className="text-right text-indigo-600">{formatCurrency(datePLData.netWages + datePLData.wcfContrib)}</TableCell>
                  </TableRow>

                  {/* D. Overheads */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="font-bold text-base text-amber-600 uppercase tracking-wider pt-6">D. Operating Overheads (Expenses)</TableCell>
                  </TableRow>
                  {datePLData.dateExpenses.length > 0 ? (
                    datePLData.dateExpenses.map(e => (
                      <TableRow key={e.id} className="text-sm">
                        <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          {e.ref_number}: {e.payee} — {e.description}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(e.amount - (e.vat_amount || 0))}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={2} className="pl-6 text-muted-foreground italic text-sm">No expenses on this date.</TableCell></TableRow>
                  )}
                  <TableRow className="bg-amber-50/10 font-bold border-y">
                    <TableCell className="pl-6">Total Net Overheads</TableCell>
                    <TableCell className="text-right text-amber-600">{formatCurrency(datePLData.netExpenses)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Summary + TRA Tax cards */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-amber-950 via-slate-900 to-zinc-950 text-white border-none shadow-xl">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-amber-400">Ledger Convergence</CardTitle>
                <CardDescription className="text-slate-400">
                  {format(parseISO(datePLData.date), 'PPP')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>Net Revenue</span>
                    <span className="font-semibold text-white">{formatCurrency(datePLData.netRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-400 pl-4 border-l border-slate-700">
                    <span>− Material Cost</span>
                    <span>({formatCurrency(datePLData.netPurchases)})</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-400 pl-4 border-l border-slate-700">
                    <span>− Labour Cost</span>
                    <span>({formatCurrency(datePLData.netWages + datePLData.wcfContrib)})</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-400 pl-4 border-l border-slate-700">
                    <span>− Overheads</span>
                    <span>({formatCurrency(datePLData.netExpenses)})</span>
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-amber-500 font-bold">Net Profit / (Loss)</span>
                      <div className={cn('text-3xl font-extrabold tracking-tight mt-1', datePLData.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-500')}>
                        {formatCurrency(datePLData.netProfit)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs uppercase tracking-wider text-slate-400">Margin</span>
                      <div className={cn('text-2xl font-black mt-1', datePLData.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-500')}>
                        {datePLData.netMarginPercentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="h-4 w-4 text-purple-600" />
                  TRA Tax Position
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Output VAT Collected</span>
                  <span className="font-medium text-amber-600">{formatCurrency(datePLData.outputVAT)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Input VAT — Purchases</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(datePLData.inputVATPurchases)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Input VAT — Expenses</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(datePLData.inputVATExpenses)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="font-semibold">Net VAT Liability</span>
                  <span className={cn('font-bold', datePLData.outputVAT - datePLData.inputVATPurchases - datePLData.inputVATExpenses >= 0 ? 'text-amber-600' : 'text-emerald-600')}>
                    {formatCurrency(datePLData.outputVAT - datePLData.inputVATPurchases - datePLData.inputVATExpenses)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PAYE Withheld</span>
                  <span className="font-medium text-amber-600">{formatCurrency(datePLData.payeWithheld)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isSyncLoading && activeDates.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <TrendingUp className="h-10 w-10 mb-4 opacity-30" />
            <p className="text-base font-medium">No financial records yet</p>
            <p className="text-sm mt-1">Create invoices, record purchases, or add expenses to start tracking daily profitability.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
