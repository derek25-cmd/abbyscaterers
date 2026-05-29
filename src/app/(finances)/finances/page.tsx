'use client';

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getSales } from "@/services/saleService";
import { getPurchases } from "@/services/purchaseService";
import { getExpenses } from "@/services/expenseService";
import { getPayrolls } from "@/services/payrollService";
import { getTaxRecords } from "@/services/taxService";
import { getBookings } from "@/services/bookingService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { TrendingUp, DollarSign, Users, ShoppingBag, FileText, CheckCircle2, ChevronRight, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FinancesRedirectPage() {
  const [selectedEventId, setSelectedEventId] = useState<string>("EVT-2026-0615-C782");

  // Fetch all 5 books to converge on Event ID Linkages
  const { data: sales = [], isLoading: sLoad } = useQuery({ queryKey: ['sales'], queryFn: getSales });
  const { data: purchases = [], isLoading: pLoad } = useQuery({ queryKey: ['purchases'], queryFn: getPurchases });
  const { data: expenses = [], isLoading: eLoad } = useQuery({ queryKey: ['expenses'], queryFn: getExpenses });
  const { data: payrolls = [], isLoading: payLoad } = useQuery({ queryKey: ['payrolls'], queryFn: getPayrolls });
  const { data: taxes = [], isLoading: taxLoad } = useQuery({ queryKey: ['taxRecords'], queryFn: getTaxRecords });
  const { data: bookings = [] } = useQuery({ queryKey: ['bookings'], queryFn: getBookings });

  // Get active Event IDs in the system
  const activeEventIds = useMemo(() => {
    const ids = new Set<string>();
    
    // Seed standard ones for robust first impressions
    ids.add("EVT-2026-0615-C782");
    ids.add("EVT-2026-0701-W990");

    sales.forEach(s => s.event_id && ids.add(s.event_id));
    purchases.forEach(p => p.event_id && ids.add(p.event_id));
    expenses.forEach(e => e.event_id && e.event_id !== 'OVERHEAD' && ids.add(e.event_id));
    payrolls.forEach(pay => pay.event_id && pay.event_id !== 'MONTHLY_CORE' && ids.add(pay.event_id));

    return Array.from(ids);
  }, [sales, purchases, expenses, payrolls]);

  // Aggregate current event data breakdown
  const eventPLData = useMemo(() => {
    if (!selectedEventId) return null;

    // 1. Sales Revenues
    const eventSales = sales.filter(s => s.event_id === selectedEventId);
    const grossRevenue = eventSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const salesTax = eventSales.reduce((sum, s) => sum + s.taxAmount, 0);
    const netRevenue = grossRevenue - salesTax;

    // 2. Raw Material COGS (Purchases)
    const eventPurchases = purchases.filter(p => p.event_id === selectedEventId);
    const grossPurchases = eventPurchases.reduce((sum, p) => sum + p.totalCost, 0);
    const purchasesTax = eventPurchases.reduce((sum, p) => sum + p.taxAmount, 0);
    const netPurchases = grossPurchases - purchasesTax;

    // 3. Operating Expenses (Generator, transport, fuel)
    const eventExpenses = expenses.filter(e => e.event_id === selectedEventId);
    const grossExpenses = eventExpenses.reduce((sum, e) => sum + e.amount, 0);
    const expensesTax = eventExpenses.reduce((sum, e) => sum + e.vat_amount, 0);
    const netExpenses = grossExpenses - expensesTax;

    // 4. Labor Costs (Dayworkers and event staff wages)
    const eventWages = payrolls.filter(pay => pay.event_id === selectedEventId);
    const netWages = eventWages.reduce((sum, pay) => sum + pay.netSalary, 0);
    const deductions = eventWages.reduce((sum, pay) => sum + pay.deductions, 0);
    const grossWages = eventWages.reduce((sum, pay) => sum + pay.grossSalary, 0);
    const wcfContrib = eventWages.reduce((sum, pay) => sum + (pay.wcf_contrib || 0), 0);

    // 5. Taxes (Output vs Input VAT + Withholding taxes accrued)
    const eventTaxes = taxes.filter(t => t.event_id === selectedEventId);
    const outputVAT = eventTaxes.filter(t => t.tax_type === 'VAT Output').reduce((sum, t) => sum + t.tax_amount, 0);
    const inputVAT = eventTaxes.filter(t => t.tax_type === 'VAT Input').reduce((sum, t) => sum + t.tax_amount, 0);
    const netVAT = outputVAT - inputVAT;
    const whtAccrued = eventTaxes.filter(t => t.tax_type.startsWith('WHT')).reduce((sum, t) => sum + t.tax_amount, 0);
    const payeWithheld = eventTaxes.filter(t => t.tax_type === 'PAYE').reduce((sum, t) => sum + t.tax_amount, 0);

    // Mathematical convergence P&L
    const totalCosts = netPurchases + netWages + netExpenses + wcfContrib;
    const netProfit = netRevenue - totalCosts;
    const netMarginPercentage = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    return {
      eventId: selectedEventId,
      eventSales,
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
      netMarginPercentage
    };
  }, [selectedEventId, sales, purchases, expenses, payrolls, taxes]);

  // Aggregate profitability comparison for the bar chart
  const comparativeChartData = useMemo(() => {
    return activeEventIds.map(id => {
      const eSales = sales.filter(s => s.event_id === id);
      const ePurchases = purchases.filter(p => p.event_id === id);
      const eExpenses = expenses.filter(e => e.event_id === id);
      const eWages = payrolls.filter(pay => pay.event_id === id);

      const revenue = eSales.reduce((sum, s) => sum + (s.totalAmount - s.taxAmount), 0);
      const materials = ePurchases.reduce((sum, p) => sum + (p.totalCost - p.taxAmount), 0);
      const overheads = eExpenses.reduce((sum, e) => sum + (e.amount - e.vat_amount), 0);
      const labor = eWages.reduce((sum, pay) => sum + pay.netSalary, 0);
      const wcf = eWages.reduce((sum, pay) => sum + (pay.wcf_contrib || 0), 0);

      const totalCosts = materials + overheads + labor + wcf;
      const netProfit = revenue - totalCosts;

      const bookingRef = bookings.find(b => b.id === id);
      const labelName = bookingRef ? `${id} - ${bookingRef.name.slice(0, 10)}...` : id;

      return {
        name: labelName,
        eventId: id,
        "Net Revenue": Math.round(revenue),
        "Total Expenses": Math.round(totalCosts),
        "Net Profit": Math.round(netProfit),
      };
    });
  }, [activeEventIds, sales, purchases, expenses, payrolls, bookings]);

  // Data for the Expense allocation Pie Chart
  const pieChartData = useMemo(() => {
    if (!eventPLData) return [];
    return [
      { name: "Ingredients (COGS)", value: eventPLData.netPurchases, color: "#10b981" },
      { name: "Casual Wages", value: eventPLData.netWages, color: "#3b82f6" },
      { name: "Direct Overheads", value: eventPLData.netExpenses, color: "#f59e0b" },
      { name: "TRA Labor Taxes", value: eventPLData.wcfContrib + eventPLData.payeWithheld, color: "#ef4444" }
    ].filter(item => item.value > 0);
  }, [eventPLData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  };

  const getBookingDetails = (id: string) => {
    const booking = bookings.find(b => b.id === id);
    if (booking) {
      return {
        name: booking.name,
        date: `${format(new Date(booking.start_date), "MMM dd, yyyy")} - ${format(new Date(booking.end_date), "MMM dd, yyyy")}`,
        status: booking.status
      };
    }
    // Static Fallback references for default seeded events
    if (id === "EVT-2026-0615-C782") {
      return {
        name: "BoT Corporate Gala Dinner",
        date: "Jun 15, 2026",
        status: "Active"
      };
    }
    if (id === "EVT-2026-0701-W990") {
      return {
        name: "Private Wedding Reception",
        date: "Jul 01, 2026",
        status: "Pending"
      };
    }
    return {
      name: "Catering Event Booking",
      date: "Scheduled Event",
      status: "Active"
    };
  };

  const selectedDetails = getBookingDetails(selectedEventId);

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
              We consolidate the 5 books of accounting (Sales, Purchases, Expenses, Payroll, Tax) into a unified profit ledger.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <span className="text-sm font-semibold whitespace-nowrap">Choose linked Event:</span>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select an Event ID" />
              </SelectTrigger>
              <SelectContent>
                {activeEventIds.map(id => {
                  const details = getBookingDetails(id);
                  return (
                    <SelectItem key={id} value={id}>{id} - {details.name}</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Comparison and allocation charts */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Profitability Bar Chart */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Historical Event Profitability Comparison</CardTitle>
            <CardDescription>Side-by-side comparison of net revenues against expenses and profits.</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {isSyncLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Loading comparison graphs...</div>
            ) : comparativeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparativeChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Net Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Total Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">No comparison data available yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Expense allocation Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Cost allocation Breakdown</CardTitle>
            <CardDescription>Allocation of net event costs (excl. VAT).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[280px]">
            {pieChartData.length > 0 ? (
              <>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs w-full px-2 pt-2">
                  {pieChartData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="truncate text-muted-foreground" title={item.name}>{item.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">No expenses recorded for this event.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Selected Event P&L Statement */}
      {eventPLData && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Profit & Loss statement ledger details */}
          <Card className="md:col-span-2">
            <CardHeader className="border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Event P&L Statement</CardTitle>
                  <CardDescription>Event: <span className="font-bold text-foreground">{selectedDetails.name}</span> ({eventPLData.eventId})</CardDescription>
                </div>
                <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                  Status: {selectedDetails.status}
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
                  {eventPLData.eventSales.map(s => (
                    <TableRow key={s.id} className="text-sm">
                      <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                        <ChevronRight className="h-3.5 w-3.5" />
                        Sales Invoice {s.invoiceNumber} ({s.description})
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(s.totalAmount - s.taxAmount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-blue-50/10 font-bold border-y">
                    <TableCell className="pl-6">Total Net Event Revenues</TableCell>
                    <TableCell className="text-right text-blue-600">{formatCurrency(eventPLData.netRevenue)}</TableCell>
                  </TableRow>

                  {/* COGS Section */}
                  <TableRow className="hover:bg-transparent pt-6">
                    <TableCell colSpan={2} className="font-bold text-base text-emerald-600 uppercase tracking-wider pt-6">B. Inventory Cost of Goods Sold (COGS)</TableCell>
                  </TableRow>
                  {eventPLData.eventPurchases.map(p => (
                    <TableRow key={p.id} className="text-sm">
                      <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                        <ChevronRight className="h-3.5 w-3.5" />
                        Purchase {p.invoiceNumber}: {p.supplier} ({p.description})
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(p.totalCost - p.taxAmount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-emerald-50/10 font-bold border-y">
                    <TableCell className="pl-6">Total Net Material Expenses</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatCurrency(eventPLData.netPurchases)}</TableCell>
                  </TableRow>

                  {/* Direct Labor Section */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="font-bold text-base text-indigo-600 uppercase tracking-wider pt-6">C. Direct labor Book (Payroll)</TableCell>
                  </TableRow>
                  {eventPLData.eventWages.map(pay => (
                    <TableRow key={pay.id} className="text-sm">
                      <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                        <ChevronRight className="h-3.5 w-3.5" />
                        Dayworker wages: {pay.employeeName} ({pay.days_worked} days @ {formatCurrency(pay.daily_rate || 0)}/day)
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(pay.netSalary)}</TableCell>
                    </TableRow>
                  ))}
                  {eventPLData.eventWages.some(pay => pay.wcf_contrib && pay.wcf_contrib > 0) && (
                    <TableRow className="text-sm">
                      <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                        <ChevronRight className="h-3.5 w-3.5" />
                        Employer Workers Compensation Fund (WCF - 0.5% TRA insurance)
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(eventPLData.wcfContrib)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-indigo-50/10 font-bold border-y">
                    <TableCell className="pl-6">Total Direct Event labor Expenses</TableCell>
                    <TableCell className="text-right text-indigo-600">{formatCurrency(eventPLData.netWages + eventPLData.wcfContrib)}</TableCell>
                  </TableRow>

                  {/* Direct Operations Overhead Section */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="font-bold text-base text-amber-600 uppercase tracking-wider pt-6">D. Direct Operations Overheads (Expenses)</TableCell>
                  </TableRow>
                  {eventPLData.eventExpenses.map(e => (
                    <TableRow key={e.id} className="text-sm">
                      <TableCell className="pl-6 flex items-center gap-2 text-muted-foreground">
                        <ChevronRight className="h-3.5 w-3.5" />
                        Expense {e.ref_number}: {e.payee} ({e.description})
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(e.amount - e.vat_amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-amber-50/10 font-bold border-y">
                    <TableCell className="pl-6">Total Net Operating Expenses</TableCell>
                    <TableCell className="text-right text-amber-600">{formatCurrency(eventPLData.netExpenses)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mathematical P&L summary convergence */}
          <div className="space-y-6">
            {/* P&L Margin Convergence Card */}
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
                    <span>- Labor Payroll Cost</span>
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

            {/* TRA Tax audit compliance card */}
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="h-4 w-4 text-purple-600" />
                  TRA Tax Compliance Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seeded Output VAT (18% Sales)</span>
                  <span className="font-medium text-amber-600">{formatCurrency(eventPLData.salesTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claimed Input VAT (18% COGS)</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(eventPLData.purchasesTax + eventPLData.expensesTax)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="font-semibold">Net VAT Liability for Event</span>
                  <span className={cn("font-bold", eventPLData.salesTax - (eventPLData.purchasesTax + eventPLData.expensesTax) >= 0 ? "text-amber-600" : "text-emerald-600")}>
                    {formatCurrency(eventPLData.salesTax - (eventPLData.purchasesTax + eventPLData.expensesTax))}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resident Withholding Tax (5%)</span>
                  <span className="font-medium text-amber-600">{formatCurrency(eventPLData.whtAccrued)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PAYE Tax Withheld (Staff)</span>
                  <span className="font-medium text-amber-600">{formatCurrency(eventPLData.payeWithheld)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
