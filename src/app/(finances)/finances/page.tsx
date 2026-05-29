'use client';

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getInvoices } from "@/services/invoiceService";
import { getPurchases } from "@/services/purchaseService";
import { getExpenses } from "@/services/expenseService";
import { getPayrolls } from "@/services/payrollService";
import { getTaxRecords } from "@/services/taxService";
import { getBookings } from "@/services/bookingService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, FileText, ChevronRight } from "lucide-react";
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

export default function FinancesRedirectPage() {
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  const { data: invoices = [], isLoading: sLoad } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices, staleTime: 5 * 60 * 1000 });
  const { data: purchases = [], isLoading: pLoad } = useQuery({ queryKey: ['purchases'], queryFn: getPurchases, staleTime: 5 * 60 * 1000 });
  const { data: expenses = [], isLoading: eLoad } = useQuery({ queryKey: ['expenses'], queryFn: getExpenses, staleTime: 5 * 60 * 1000 });
  const { data: payrolls = [], isLoading: payLoad } = useQuery({ queryKey: ['payrolls'], queryFn: getPayrolls, staleTime: 5 * 60 * 1000 });
  const { data: taxes = [], isLoading: taxLoad } = useQuery({ queryKey: ['taxRecords'], queryFn: getTaxRecords, staleTime: 5 * 60 * 1000 });
  const { data: bookings = [] } = useQuery({ queryKey: ['bookings'], queryFn: getBookings, staleTime: 5 * 60 * 1000 });

  // Derive event IDs entirely from live ledger data — no hardcoded seeds
  const activeEventIds = useMemo(() => {
    const ids = new Set<string>();
    invoices.forEach(inv => { const bid = (inv as any).booking_id; if (bid) ids.add(bid); });
    purchases.forEach(p => p.event_id && ids.add(p.event_id));
    expenses.forEach(e => e.event_id && e.event_id !== 'OVERHEAD' && ids.add(e.event_id));
    payrolls.forEach(pay => pay.event_id && pay.event_id !== 'MONTHLY_CORE' && ids.add(pay.event_id));
    return Array.from(ids);
  }, [invoices, purchases, expenses, payrolls]);

  // Compute full P&L for the selected event (falls back to first available event)
  const eventPLData = useMemo(() => {
    const eventId = selectedEventId || activeEventIds[0];
    if (!eventId) return null;

    // Revenue from invoices linked to this booking
    const eventInvoices = invoices.filter(inv => (inv as any).booking_id === eventId);
    let grossRevenue = 0, salesTax = 0;
    const invoiceRows = eventInvoices.map(inv => {
      const t = calcInvoiceTotals(inv);
      grossRevenue += t.grandTotal;
      salesTax += t.vatAmount;
      return { inv, ...t };
    });
    const netRevenue = grossRevenue - salesTax;

    // COGS from purchases
    const eventPurchases = purchases.filter(p => p.event_id === eventId);
    const grossPurchases = eventPurchases.reduce((sum, p) => sum + p.totalCost, 0);
    const purchasesTax = eventPurchases.reduce((sum, p) => sum + (p.taxAmount || 0), 0);
    const netPurchases = grossPurchases - purchasesTax;

    // Operating overheads from expenses
    const eventExpenses = expenses.filter(e => e.event_id === eventId);
    const grossExpenses = eventExpenses.reduce((sum, e) => sum + e.amount, 0);
    const expensesTax = eventExpenses.reduce((sum, e) => sum + (e.vat_amount || 0), 0);
    const netExpenses = grossExpenses - expensesTax;

    // Labor from payroll
    const eventWages = payrolls.filter(pay => pay.event_id === eventId);
    const netWages = eventWages.reduce((sum, pay) => sum + pay.netSalary, 0);
    const deductions = eventWages.reduce((sum, pay) => sum + pay.deductions, 0);
    const grossWages = eventWages.reduce((sum, pay) => sum + pay.grossSalary, 0);
    const wcfContrib = eventWages.reduce((sum, pay) => sum + (pay.wcf_contrib || 0), 0);

    // Tax entries from tax book
    const eventTaxes = taxes.filter(t => t.event_id === eventId);
    const outputVAT = eventTaxes.filter(t => t.tax_type === 'VAT Output').reduce((sum, t) => sum + t.tax_amount, 0);
    const inputVAT = eventTaxes.filter(t => t.tax_type === 'VAT Input').reduce((sum, t) => sum + t.tax_amount, 0);
    const netVAT = outputVAT - inputVAT;
    const whtAccrued = eventTaxes.filter(t => t.tax_type.startsWith('WHT')).reduce((sum, t) => sum + t.tax_amount, 0);
    const payeWithheld = eventTaxes.filter(t => t.tax_type === 'PAYE').reduce((sum, t) => sum + t.tax_amount, 0);

    const totalCosts = netPurchases + netWages + netExpenses + wcfContrib;
    const netProfit = netRevenue - totalCosts;
    const netMarginPercentage = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    return {
      eventId,
      invoiceRows,
      eventPurchases,
      eventExpenses,
      eventWages,
      eventTaxes,
      grossRevenue,
      netRevenue,
      salesTax,
      grossPurchases,
      netPurchases,
      purchasesTax,
      grossExpenses,
      netExpenses,
      expensesTax,
      netWages,
      deductions,
      grossWages,
      wcfContrib,
      netVAT,
      whtAccrued,
      payeWithheld,
      totalCosts,
      netProfit,
      netMarginPercentage,
    };
  }, [selectedEventId, activeEventIds, invoices, purchases, expenses, payrolls, taxes]);

  // Cross-event comparison chart data
  const comparativeChartData = useMemo(() => {
    return activeEventIds.map(id => {
      const eInvoices = invoices.filter(inv => (inv as any).booking_id === id);
      const revenue = eInvoices.reduce((sum, inv) => sum + calcInvoiceTotals(inv).netAmount, 0);

      const ePurchases = purchases.filter(p => p.event_id === id);
      const materials = ePurchases.reduce((sum, p) => sum + (p.totalCost - (p.taxAmount || 0)), 0);

      const eExpenses = expenses.filter(e => e.event_id === id);
      const overheads = eExpenses.reduce((sum, e) => sum + (e.amount - (e.vat_amount || 0)), 0);

      const eWages = payrolls.filter(pay => pay.event_id === id);
      const labor = eWages.reduce((sum, pay) => sum + pay.netSalary, 0);
      const wcf = eWages.reduce((sum, pay) => sum + (pay.wcf_contrib || 0), 0);

      const totalCosts = materials + overheads + labor + wcf;
      const netProfit = revenue - totalCosts;

      const bookingRef = bookings.find(b => b.id === id);
      const labelName = bookingRef ? `${bookingRef.name.slice(0, 14)}…` : id.slice(-8);

      return {
        name: labelName,
        eventId: id,
        "Net Revenue": Math.round(revenue),
        "Total Expenses": Math.round(totalCosts),
        "Net Profit": Math.round(netProfit),
      };
    });
  }, [activeEventIds, invoices, purchases, expenses, payrolls, bookings]);

  const pieChartData = useMemo(() => {
    if (!eventPLData) return [];
    return [
      { name: "Ingredients (COGS)", value: eventPLData.netPurchases, color: "#10b981" },
      { name: "Casual Wages", value: eventPLData.netWages, color: "#3b82f6" },
      { name: "Direct Overheads", value: eventPLData.netExpenses, color: "#f59e0b" },
      { name: "TRA Labor Taxes", value: eventPLData.wcfContrib + eventPLData.payeWithheld, color: "#ef4444" },
    ].filter(item => item.value > 0);
  }, [eventPLData]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');

  const getBookingDetails = (id: string) => {
    const booking = bookings.find(b => b.id === id);
    if (booking) {
      return {
        name: booking.name,
        date: `${format(new Date(booking.start_date), "MMM dd, yyyy")} – ${format(new Date(booking.end_date), "MMM dd, yyyy")}`,
        status: booking.status,
      };
    }
    return { name: id, date: "Scheduled Event", status: "Active" };
  };

  const currentEventId = selectedEventId || activeEventIds[0] || "";
  const selectedDetails = currentEventId ? getBookingDetails(currentEventId) : null;
  const isSyncLoading = sLoad || pLoad || eLoad || payLoad || taxLoad;

  return (
    <div className="space-y-6">
      {/* Event Profitability Analyzer Header & Selector */}
      <Card className="bg-card border-amber-600/20">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2 text-foreground">
              <TrendingUp className="text-amber-600" />
              Event ID Linkage Profitability Analyzer
            </CardTitle>
            <CardDescription>
              Consolidates the 5 books of accounting (Sales, Purchases, Expenses, Payroll, Tax) into a unified per-event profit ledger. Data sourced live from all financial journals.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <span className="text-sm font-semibold whitespace-nowrap">Choose linked Event:</span>
            <Select value={currentEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder={isSyncLoading ? "Loading events…" : "No events with financial data yet"} />
              </SelectTrigger>
              <SelectContent>
                {activeEventIds.map(id => {
                  const details = getBookingDetails(id);
                  return (
                    <SelectItem key={id} value={id}>{id} — {details.name}</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Comparison and allocation charts */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Historical Event Profitability Comparison</CardTitle>
            <CardDescription>Side-by-side comparison of net revenues against expenses and profits across all linked events.</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {isSyncLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Loading comparison graphs…</div>
            ) : comparativeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparativeChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Net Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Total Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">No events with linked financial data yet. Record purchases or expenses with an Event ID to start.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Cost Allocation Breakdown</CardTitle>
            <CardDescription>Allocation of net event costs (excl. VAT) for selected event.</CardDescription>
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
                      <Tooltip formatter={(v) => formatCurrency(v as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs w-full px-2 pt-2">
                  {pieChartData.map(item => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="truncate text-muted-foreground" title={item.name}>{item.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground text-sm text-center">No cost breakdown available for this event.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Selected Event P&L Statement */}
      {eventPLData && selectedDetails && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader className="border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Event P&L Statement</CardTitle>
                  <CardDescription>
                    Event: <span className="font-bold text-foreground">{selectedDetails.name}</span> ({eventPLData.eventId})
                  </CardDescription>
                </div>
                <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                  {selectedDetails.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableBody>
                  {/* Revenue Section */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="font-bold text-base text-blue-600 uppercase tracking-wider">A. Revenue Book</TableCell>
                  </TableRow>
                  {eventPLData.invoiceRows.length > 0 ? (
                    eventPLData.invoiceRows.map(({ inv, netAmount }) => {
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
                    <TableRow className="text-sm">
                      <TableCell colSpan={2} className="pl-6 text-muted-foreground italic">No invoices linked to this event.</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-blue-50/10 font-bold border-y">
                    <TableCell className="pl-6">Total Net Event Revenues</TableCell>
                    <TableCell className="text-right text-blue-600">{formatCurrency(eventPLData.netRevenue)}</TableCell>
                  </TableRow>

                  {/* COGS Section */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="font-bold text-base text-emerald-600 uppercase tracking-wider pt-6">B. Inventory Cost of Goods Sold (COGS)</TableCell>
                  </TableRow>
                  {eventPLData.eventPurchases.length > 0 ? (
                    eventPLData.eventPurchases.map(p => (
                      <TableRow key={p.id} className="text-sm">
                        <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          Purchase {p.invoiceNumber}: {p.supplier} — {p.description}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.totalCost - (p.taxAmount || 0))}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="text-sm">
                      <TableCell colSpan={2} className="pl-6 text-muted-foreground italic">No purchases linked to this event.</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-emerald-50/10 font-bold border-y">
                    <TableCell className="pl-6">Total Net Material Expenses</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatCurrency(eventPLData.netPurchases)}</TableCell>
                  </TableRow>

                  {/* Direct Labor Section */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="font-bold text-base text-indigo-600 uppercase tracking-wider pt-6">C. Direct Labour Book (Payroll)</TableCell>
                  </TableRow>
                  {eventPLData.eventWages.length > 0 ? (
                    <>
                      {eventPLData.eventWages.map(pay => (
                        <TableRow key={pay.id} className="text-sm">
                          <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            Dayworker wages: {pay.employeeName} ({pay.days_worked} days @ {formatCurrency(pay.daily_rate || 0)}/day)
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(pay.netSalary)}</TableCell>
                        </TableRow>
                      ))}
                      {eventPLData.wcfContrib > 0 && (
                        <TableRow className="text-sm">
                          <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            Employer Workers Compensation Fund (WCF — 0.5% TRA)
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(eventPLData.wcfContrib)}</TableCell>
                        </TableRow>
                      )}
                    </>
                  ) : (
                    <TableRow className="text-sm">
                      <TableCell colSpan={2} className="pl-6 text-muted-foreground italic">No payroll entries linked to this event.</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-indigo-50/10 font-bold border-y">
                    <TableCell className="pl-6">Total Direct Event Labour Expenses</TableCell>
                    <TableCell className="text-right text-indigo-600">{formatCurrency(eventPLData.netWages + eventPLData.wcfContrib)}</TableCell>
                  </TableRow>

                  {/* Operating Overheads Section */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="font-bold text-base text-amber-600 uppercase tracking-wider pt-6">D. Direct Operations Overheads (Expenses)</TableCell>
                  </TableRow>
                  {eventPLData.eventExpenses.length > 0 ? (
                    eventPLData.eventExpenses.map(e => (
                      <TableRow key={e.id} className="text-sm">
                        <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          {e.ref_number}: {e.payee} — {e.description}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(e.amount - (e.vat_amount || 0))}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="text-sm">
                      <TableCell colSpan={2} className="pl-6 text-muted-foreground italic">No expenses linked to this event.</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-amber-50/10 font-bold border-y">
                    <TableCell className="pl-6">Total Net Operating Expenses</TableCell>
                    <TableCell className="text-right text-amber-600">{formatCurrency(eventPLData.netExpenses)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* P&L Summary Cards */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-amber-950 via-slate-900 to-zinc-950 text-white border-none shadow-xl">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-amber-400">Ledger Convergence Summary</CardTitle>
                <CardDescription className="text-slate-400">Mathematical per-event profit aggregation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>Net Event Revenue</span>
                    <span className="font-semibold text-white">{formatCurrency(eventPLData.netRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-400 pl-4 border-l border-slate-700">
                    <span>- Material Cost (COGS)</span>
                    <span>({formatCurrency(eventPLData.netPurchases)})</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-400 pl-4 border-l border-slate-700">
                    <span>- Labour Payroll Cost</span>
                    <span>({formatCurrency(eventPLData.netWages + eventPLData.wcfContrib)})</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-400 pl-4 border-l border-slate-700">
                    <span>- Operating Costs</span>
                    <span>({formatCurrency(eventPLData.netExpenses)})</span>
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-amber-500 font-bold">Event Net Profit</span>
                      <div className={cn("text-3xl font-extrabold tracking-tight mt-1", eventPLData.netProfit >= 0 ? "text-emerald-400" : "text-rose-500")}>
                        {formatCurrency(eventPLData.netProfit)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs uppercase tracking-wider text-slate-400">Net Margin</span>
                      <div className={cn("text-2xl font-black mt-1", eventPLData.netProfit >= 0 ? "text-emerald-400" : "text-rose-500")}>
                        {eventPLData.netMarginPercentage.toFixed(1)}%
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
                  TRA Tax Compliance Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Output VAT Collected (18%)</span>
                  <span className="font-medium text-amber-600">{formatCurrency(eventPLData.salesTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Input VAT Claimable (COGS + Expenses)</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(eventPLData.purchasesTax + eventPLData.expensesTax)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="font-semibold">Net VAT Liability</span>
                  <span className={cn("font-bold", eventPLData.salesTax - (eventPLData.purchasesTax + eventPLData.expensesTax) >= 0 ? "text-amber-600" : "text-emerald-600")}>
                    {formatCurrency(eventPLData.salesTax - (eventPLData.purchasesTax + eventPLData.expensesTax))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resident WHT (5%)</span>
                  <span className="font-medium text-amber-600">{formatCurrency(eventPLData.whtAccrued)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PAYE Withheld (Staff)</span>
                  <span className="font-medium text-amber-600">{formatCurrency(eventPLData.payeWithheld)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Empty state when no events have financial data */}
      {!isSyncLoading && activeEventIds.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <TrendingUp className="h-10 w-10 mb-4 opacity-30" />
            <p className="text-base font-medium">No linked financial events yet</p>
            <p className="text-sm mt-1">Record purchases or expenses with an Event ID to begin per-event profitability tracking.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
