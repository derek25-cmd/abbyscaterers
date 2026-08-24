'use client';

import { useState, useMemo } from 'react';
import {
  format, parseISO, startOfMonth, endOfMonth, subMonths,
  startOfYear, endOfYear, differenceInDays, isWithinInterval,
  startOfDay, endOfDay,
} from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getInvoices } from '@/services/invoiceService';
import { getPurchases } from '@/services/purchaseService';
import { getExpenses } from '@/services/expenseService';
import { getPayrolls } from '@/services/payrollService';
import { getStockLogs } from '@/services/stockLogService';
import { useClientStorage } from '@/hooks/use-client-storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, ArrowLeftRight, Scale, Receipt, Percent, BarChart2,
  CalendarDays, UtensilsCrossed, Star, Users, Trash2, Truck,
  AlertCircle, FileDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Invoice } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcInvoiceTotals(inv: Invoice) {
  const subtotal = inv.items.reduce((s, i) => s + (i.total || 0), 0);
  const forDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
  const beforeVAT = forDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);
  if (inv.vatType === 'exclusive') {
    const vat = beforeVAT * 0.18;
    return { netAmount: beforeVAT, vatAmount: vat, grandTotal: beforeVAT + vat };
  }
  const grand = beforeVAT;
  const net = grand / 1.18;
  return { netAmount: net, vatAmount: grand - net, grandTotal: grand };
}

type Period = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all_time';
function getPeriodRange(p: Period): { from: Date; to: Date } {
  const now = new Date();
  switch (p) {
    case 'this_month':    return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last_month':    { const lm = subMonths(now, 1); return { from: startOfMonth(lm), to: endOfMonth(lm) }; }
    case 'last_3_months': return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
    case 'this_year':     return { from: startOfYear(now), to: endOfYear(now) };
    case 'all_time':      return { from: new Date('2020-01-01'), to: new Date('2099-12-31') };
  }
}
function inRange(d: string | null | undefined, from: Date, to: Date): boolean {
  if (!d) return false;
  try {
    const dt = parseISO(d.slice(0, 10));
    return dt >= startOfDay(from) && dt <= endOfDay(to);
  } catch { return false; }
}
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 })
    .format(n).replace('TZS', 'TZS ');
const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) + '%' : '—');
const num = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

// ── Report IDs ────────────────────────────────────────────────────────────────
type ReportId =
  | 'pl' | 'cashflow' | 'balance' | 'vat' | 'wht' | 'expense-analysis'
  | 'event-pl' | 'food-cost' | 'best-menu' | 'staff-cost' | 'wastage'
  | 'suppliers' | 'customer-trends' | 'outstanding';

interface ReportMeta { id: ReportId; label: string; icon: React.ComponentType<{ className?: string }>; }
const GROUPS: { label: string; color: string; reports: ReportMeta[] }[] = [
  {
    label: 'Financial', color: 'text-blue-600',
    reports: [
      { id: 'pl',               label: 'Profit & Loss',       icon: TrendingUp   },
      { id: 'cashflow',         label: 'Cash Flow Statement',  icon: ArrowLeftRight },
      { id: 'balance',          label: 'Balance Sheet',        icon: Scale        },
      { id: 'vat',              label: 'VAT Report',           icon: Receipt      },
      { id: 'wht',              label: 'Withholding Tax',      icon: Percent      },
      { id: 'expense-analysis', label: 'Expense Analysis',     icon: BarChart2    },
    ],
  },
  {
    label: 'Catering Operations', color: 'text-amber-600',
    reports: [
      { id: 'event-pl',         label: 'Event Profitability',  icon: CalendarDays    },
      { id: 'food-cost',        label: 'Food Cost %',          icon: UtensilsCrossed },
      { id: 'best-menu',        label: 'Best-Selling Menu',    icon: Star            },
      { id: 'staff-cost',       label: 'Staff Cost / Event',   icon: Users           },
      { id: 'wastage',          label: 'Inventory Wastage',    icon: Trash2          },
      { id: 'suppliers',        label: 'Supplier Spending',    icon: Truck           },
      { id: 'customer-trends',  label: 'Customer Trends',      icon: TrendingUp      },
      { id: 'outstanding',      label: 'Outstanding Balances', icon: AlertCircle     },
    ],
  },
];

// ── Colour palette for charts ─────────────────────────────────────────────────
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];

// ── PDF helpers ───────────────────────────────────────────────────────────────
function pdfHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFontSize(16); doc.setFont('helvetica','bold');
  doc.text("ABBY'S CATERERS — " + title.toUpperCase(), 14, 18);
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text(subtitle, 14, 25);
  doc.text(`Generated: ${format(new Date(),'PPP')}`, 14, 30);
}

// ════════════════════════════════════════════════════════════════════════════════
export default function FinanceReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportId>('pl');
  const [period, setPeriod] = useState<Period>('this_month');
  const { clients } = useClientStorage();

  // ── Data queries ─────────────────────────────────────────────────────────────
  const { data: invoices = [], isLoading: iLoad } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices, staleTime: 5 * 60 * 1000 });
  const { data: purchases = [], isLoading: pLoad } = useQuery({ queryKey: ['purchases'], queryFn: getPurchases, staleTime: 5 * 60 * 1000 });
  const { data: expenses = [], isLoading: eLoad } = useQuery({ queryKey: ['expenses'], queryFn: getExpenses, staleTime: 5 * 60 * 1000 });
  const { data: payrolls = [], isLoading: payLoad } = useQuery({ queryKey: ['payrolls'], queryFn: getPayrolls, staleTime: 5 * 60 * 1000 });
  const { data: stockLogs = [] } = useQuery({
    queryKey: ['stockLogs'], queryFn: getStockLogs, staleTime: 5 * 60 * 1000,
    select: (r) => r.data ?? [],
  });

  const isLoading = iLoad || pLoad || eLoad || payLoad;
  const { from, to } = getPeriodRange(period);

  const getClientName = (id: string | null) => {
    if (!id) return 'Walk-in / Direct';
    return clients.find(c => c.id === id)?.companyName || 'Unknown Client';
  };

  // ── Period-filtered data ─────────────────────────────────────────────────────
  const fd = useMemo(() => ({
    invoices:  invoices.filter(inv => inRange(inv.invoiceDate, from, to)),
    purchases: purchases.filter(p  => inRange(p.date, from, to)),
    expenses:  expenses.filter(e   => inRange(e.date, from, to)),
    payrolls:  payrolls.filter(pay => inRange(pay.paymentDate || pay.payPeriodEnd, from, to)),
    stockLogs: (stockLogs as any[]).filter(l => inRange(l.date, from, to)),
  }), [invoices, purchases, expenses, payrolls, stockLogs, from, to]);

  // ── P&L aggregates ────────────────────────────────────────────────────────────
  const pl = useMemo(() => {
    let rev = 0, outVAT = 0;
    fd.invoices.forEach(inv => { const t = calcInvoiceTotals(inv); rev += t.netAmount; outVAT += t.vatAmount; });
    const cogs = fd.purchases.reduce((s, p) => s + p.totalCost - (p.taxAmount || 0), 0);
    const inVATpurch = fd.purchases.reduce((s, p) => s + (p.taxAmount || 0), 0);
    const opex = fd.expenses.reduce((s, e) => s + e.amount - (e.vat_amount || 0), 0);
    const inVATexp = fd.expenses.reduce((s, e) => s + (e.vat_amount || 0), 0);
    const labour = fd.payrolls.reduce((s, pay) => s + pay.netSalary + (pay.wcf_contrib || 0), 0);
    const gross = rev - cogs;
    const ebitda = gross - opex - labour;
    return { rev, outVAT, cogs, inVATpurch, opex, inVATexp, labour, gross, ebitda,
      grossPct: pct(gross, rev), ebitdaPct: pct(ebitda, rev),
      netVAT: outVAT - inVATpurch - inVATexp };
  }, [fd]);

  // ── Export: P&L PDF ───────────────────────────────────────────────────────────
  const exportPLPDF = () => {
    const doc = new jsPDF();
    pdfHeader(doc, 'Profit & Loss Statement', `Period: ${format(from,'MMM d yyyy')} – ${format(to,'MMM d yyyy')}`);
    (doc as any).autoTable({
      startY: 36, theme: 'plain',
      body: [
        ['REVENUE',                             ''],
        ['  Gross Revenue (net of VAT)',         num(pl.rev)],
        ['  Output VAT collected',               num(pl.outVAT)],
        ['COST OF GOODS SOLD',                  ''],
        ['  Raw material purchases (net)',       `(${num(pl.cogs)})`],
        ['GROSS PROFIT',                         num(pl.gross)],
        ['  Gross Margin',                       pl.grossPct],
        ['OPERATING EXPENSES',                  ''],
        ['  Overheads & expenses (net)',         `(${num(pl.opex)})`],
        ['  Labour & payroll costs',             `(${num(pl.labour)})`],
        ['NET OPERATING PROFIT (EBITDA)',        num(pl.ebitda)],
        ['  Net Margin',                         pl.ebitdaPct],
        ['TAX POSITION',                         ''],
        ['  Output VAT',                         num(pl.outVAT)],
        ['  Input VAT (COGS + Expenses)',        `(${num(pl.inVATpurch + pl.inVATexp)})`],
        ['  Net VAT Liability',                  num(pl.netVAT)],
      ],
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } },
    });
    doc.save(`pl-statement-${format(new Date(),'yyyy-MM-dd')}.pdf`);
  };

  // ── Supplier spending ─────────────────────────────────────────────────────────
  const supplierRows = useMemo(() => {
    const map = new Map<string, { supplier: string; tin: string; count: number; total: number; last: string }>();
    fd.purchases.forEach(p => {
      const e = map.get(p.supplier) || { supplier: p.supplier, tin: p.supplier_tin || '—', count: 0, total: 0, last: '' };
      map.set(p.supplier, { ...e, count: e.count + 1, total: e.total + p.totalCost, last: p.date > e.last ? p.date : e.last });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [fd.purchases]);

  // ── Best-selling menu ─────────────────────────────────────────────────────────
  const menuRows = useMemo(() => {
    const map = new Map<string, { name: string; pax: number; revenue: number }>();
    fd.invoices.forEach(inv => {
      inv.items.forEach(item => {
        const key = item.mealType || item.particularDescription || 'Uncategorised';
        const e = map.get(key) || { name: key, pax: 0, revenue: 0 };
        map.set(key, { name: key, pax: e.pax + (item.pax || 1), revenue: e.revenue + (item.total || 0) });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [fd.invoices]);

  // ── Customer trends ───────────────────────────────────────────────────────────
  const customerRows = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number; last: string }>();
    fd.invoices.forEach(inv => {
      const key = inv.clientId || 'walk-in';
      const e = map.get(key) || { name: getClientName(inv.clientId), count: 0, revenue: 0, last: '' };
      map.set(key, { ...e, count: e.count + 1, revenue: e.revenue + calcInvoiceTotals(inv).grandTotal, last: inv.invoiceDate > e.last ? inv.invoiceDate : e.last });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [fd.invoices, clients]);

  // ── AR aging (uses all invoices, not period-filtered) ─────────────────────────
  const arRows = useMemo(() => {
    return invoices
      .filter(inv => inv.status === 'outstanding' || inv.status === 'partially paid')
      .map(inv => {
        const { grandTotal } = calcInvoiceTotals(inv);
        const balanceDue = grandTotal - (inv.amountPaid || 0);
        const days = differenceInDays(new Date(), parseISO(inv.invoiceDate.slice(0, 10)));
        const bucket = days <= 30 ? '0–30 days' : days <= 60 ? '31–60 days' : days <= 90 ? '61–90 days' : '90+ days';
        return { inv, grandTotal, balanceDue, days, bucket };
      })
      .sort((a, b) => b.days - a.days);
  }, [invoices]);
  const arTotal = arRows.reduce((s, r) => s + r.balanceDue, 0);

  // ── Wastage ───────────────────────────────────────────────────────────────────
  const wastageRows = useMemo(() => {
    return (fd.stockLogs as any[])
      .filter(l => l.type === 'Stock Out')
      .map(l => ({ ...l, lineValue: Number(l.actual_unit_price) * Number(l.quantity) }))
      .sort((a, b) => b.lineValue - a.lineValue);
  }, [fd.stockLogs]);
  const wastageTotal = wastageRows.reduce((s, r) => s + r.lineValue, 0);

  // ── Event P&L (per date) ──────────────────────────────────────────────────────
  const eventPLRows = useMemo(() => {
    const dates = new Set<string>();
    fd.invoices.forEach(i => dates.add(i.invoiceDate.slice(0,10)));
    fd.purchases.forEach(p => dates.add(p.date.slice(0,10)));
    fd.expenses.forEach(e => dates.add(e.date.slice(0,10)));
    fd.payrolls.forEach(pay => dates.add((pay.paymentDate || pay.payPeriodEnd || '').slice(0,10)));
    return Array.from(dates).sort((a,b)=>b.localeCompare(a)).map(date => {
      const revNet = fd.invoices.filter(i=>i.invoiceDate.slice(0,10)===date).reduce((s,i)=>s+calcInvoiceTotals(i).netAmount,0);
      const cogs   = fd.purchases.filter(p=>p.date.slice(0,10)===date).reduce((s,p)=>s+p.totalCost-(p.taxAmount||0),0);
      const opex   = fd.expenses.filter(e=>e.date.slice(0,10)===date).reduce((s,e)=>s+e.amount-(e.vat_amount||0),0);
      const labour = fd.payrolls.filter(pay=>(pay.paymentDate||pay.payPeriodEnd||'').slice(0,10)===date).reduce((s,pay)=>s+pay.netSalary+(pay.wcf_contrib||0),0);
      const profit = revNet - cogs - opex - labour;
      return { date, revNet, cogs, opex, labour, profit, margin: revNet>0?(profit/revNet*100):0 };
    });
  }, [fd]);

  // ── Food cost % ───────────────────────────────────────────────────────────────
  const foodCost = useMemo(() => {
    const foodKeywords = ['food', 'ingredient', 'beef', 'chicken', 'fish', 'vegetable', 'produce', 'meat', 'rice', 'flour'];
    const foodPurchases = fd.purchases.filter(p =>
      foodKeywords.some(k => (p.description + ' ' + (p.expenseCategory || '')).toLowerCase().includes(k))
    );
    const totalFood = foodPurchases.reduce((s, p) => s + p.totalCost, 0);
    const totalRev = fd.invoices.reduce((s, inv) => s + calcInvoiceTotals(inv).grandTotal, 0);
    const pctVal = totalRev > 0 ? (totalFood / totalRev) * 100 : 0;
    return { totalFood, totalRev, pctVal, rows: foodPurchases };
  }, [fd]);

  // ── Expense by category ───────────────────────────────────────────────────────
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    fd.expenses.forEach(e => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value);
  }, [fd.expenses]);

  // ── Cash flow ─────────────────────────────────────────────────────────────────
  const cashFlow = useMemo(() => {
    const inflows = invoices.filter(i => (i.status === 'paid' || i.status === 'partially paid') && inRange(i.paymentDate || i.invoiceDate, from, to))
      .reduce((s, i) => s + (i.status === 'partially paid' ? (i.amountPaid||0) : calcInvoiceTotals(i).grandTotal), 0);
    const outPurch = fd.purchases.filter(p=>p.paymentStatus==='paid').reduce((s,p)=>s+p.totalCost,0);
    const outExp   = fd.expenses.reduce((s,e)=>s+e.amount,0);
    const outPay   = fd.payrolls.filter(pay=>pay.status==='Paid').reduce((s,pay)=>s+pay.netSalary,0);
    return { inflows, outPurch, outExp, outPay, net: inflows - outPurch - outExp - outPay };
  }, [fd, invoices, from, to]);

  // ── WHT rows ──────────────────────────────────────────────────────────────────
  const whtRows = useMemo(() => {
    const rows: { type: string; ref: string; date: string; base: number; wht: number }[] = [];
    fd.expenses.filter(e => e.category === 'Venue Rent').forEach(e =>
      rows.push({ type: 'WHT 5% — Venue Rent', ref: e.ref_number, date: e.date, base: e.amount, wht: e.amount * 0.05 }));
    fd.payrolls.forEach(pay =>
      rows.push({ type: 'PAYE — Employee', ref: pay.employeeName, date: pay.paymentDate || pay.payPeriodEnd || '', base: pay.grossSalary, wht: pay.deductions * 0.6 }));
    return rows.sort((a,b)=>b.date.localeCompare(a.date));
  }, [fd]);
  const whtTotal = whtRows.reduce((s,r)=>s+r.wht,0);

  // ── Balance sheet (simplified) ────────────────────────────────────────────────
  const balanceSheet = useMemo(() => {
    const SEED_CASH = 10_000_000, SEED_BANK = 100_000_000, SEED_MOBILE = 40_000_000;
    const cashInflows = invoices.filter(i=>i.status==='paid'||i.status==='partially paid')
      .reduce((s,i)=>s+(i.status==='partially paid'?(i.amountPaid||0):calcInvoiceTotals(i).grandTotal),0);
    const cashOutflows = purchases.filter(p=>p.paymentStatus==='paid').reduce((s,p)=>s+p.totalCost,0)
      + expenses.reduce((s,e)=>s+e.amount,0)
      + payrolls.filter(pay=>pay.status==='Paid').reduce((s,pay)=>s+pay.netSalary,0);
    const cash = SEED_CASH + SEED_BANK + SEED_MOBILE + cashInflows - cashOutflows;
    const ar = invoices.filter(i=>i.status==='outstanding'||i.status==='partially paid')
      .reduce((s,i)=>s+calcInvoiceTotals(i).grandTotal-(i.amountPaid||0),0);
    const ap = purchases.filter(p=>p.paymentStatus==='unpaid').reduce((s,p)=>s+p.totalCost,0);
    const vatLiab = pl.netVAT > 0 ? pl.netVAT : 0;
    const totalAssets = cash + ar;
    const totalLiab = ap + vatLiab;
    const equity = totalAssets - totalLiab;
    return { cash, ar, totalAssets, ap, vatLiab, totalLiab, equity };
  }, [invoices, purchases, expenses, payrolls, pl.netVAT]);

  // ── Render section ────────────────────────────────────────────────────────────
  const periodLabel = `${format(from,'MMM d, yyyy')} – ${format(to,'MMM d, yyyy')}`;

  const renderReport = () => {
    if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading report data…</div>;

    switch (activeReport) {
      // ── P&L ──────────────────────────────────────────────────────────────────
      case 'pl': return (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div><h2 className="text-lg font-bold">Profit & Loss Statement</h2><p className="text-sm text-muted-foreground">{periodLabel}</p></div>
            <Button variant="outline" size="sm" onClick={exportPLPDF}><FileDown className="mr-2 h-4 w-4"/>Export PDF</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: 'Net Revenue', value: pl.rev, color: 'text-blue-600' },
              { label: 'Gross Profit', value: pl.gross, sub: pl.grossPct, color: 'text-emerald-600' },
              { label: 'Net Profit', value: pl.ebitda, sub: pl.ebitdaPct, color: pl.ebitda >= 0 ? 'text-emerald-600' : 'text-rose-600' },
            ].map(m => (
              <Card key={m.label}><CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className={cn('text-2xl font-bold', m.color)}>{fmt(m.value)}</p>
                {m.sub && <p className="text-xs text-muted-foreground">{m.sub} margin</p>}
              </CardContent></Card>
            ))}
          </div>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableBody>
                  {[
                    { label: 'REVENUE', sub: true },
                    { label: 'Net Revenue (excl. VAT)', value: pl.rev, indent: true },
                    { label: 'Output VAT collected', value: pl.outVAT, indent: true, muted: true },
                    { label: 'COST OF GOODS SOLD', sub: true },
                    { label: 'Raw material purchases (net)', value: -pl.cogs, indent: true },
                    { label: 'GROSS PROFIT', value: pl.gross, bold: true, highlight: 'emerald' },
                    { label: 'OPERATING EXPENSES', sub: true },
                    { label: 'Overheads & expenses (net)', value: -pl.opex, indent: true },
                    { label: 'Labour & payroll costs', value: -pl.labour, indent: true },
                    { label: 'NET OPERATING PROFIT', value: pl.ebitda, bold: true, highlight: pl.ebitda >= 0 ? 'emerald' : 'rose' },
                    { label: 'TAX POSITION', sub: true },
                    { label: 'Output VAT', value: pl.outVAT, indent: true, muted: true },
                    { label: 'Input VAT (COGS + Expenses)', value: -(pl.inVATpurch + pl.inVATexp), indent: true, muted: true },
                    { label: 'Net VAT Liability', value: pl.netVAT, bold: true, muted: true },
                  ].map((row, i) => (
                    <TableRow key={i} className={row.sub ? 'hover:bg-transparent' : ''}>
                      <TableCell className={cn(row.sub && 'font-bold uppercase text-xs tracking-wider text-muted-foreground pt-4', row.indent && 'pl-8', row.bold && 'font-bold')}>
                        {row.label}
                      </TableCell>
                      {row.value !== undefined && (
                        <TableCell className={cn('text-right font-mono', row.muted && 'text-muted-foreground',
                          row.highlight === 'emerald' && 'font-bold text-emerald-600',
                          row.highlight === 'rose' && 'font-bold text-rose-600')}>
                          {row.value < 0 ? `(${fmt(Math.abs(row.value))})` : fmt(row.value)}
                        </TableCell>
                      )}
                      {row.value === undefined && <TableCell />}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      );

      // ── CASH FLOW ─────────────────────────────────────────────────────────────
      case 'cashflow': return (
        <div className="space-y-4">
          <div><h2 className="text-lg font-bold">Cash Flow Statement</h2><p className="text-sm text-muted-foreground">{periodLabel}</p></div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-emerald-400/40">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-600">Total Cash Inflows</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-emerald-600">{fmt(cashFlow.inflows)}</p><p className="text-xs text-muted-foreground">From paid invoices</p></CardContent>
            </Card>
            <Card className={cashFlow.net >= 0 ? 'border-emerald-400/40' : 'border-rose-400/40'}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Net Cash Flow</CardTitle></CardHeader>
              <CardContent><p className={cn('text-2xl font-bold', cashFlow.net >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{fmt(cashFlow.net)}</p><p className="text-xs text-muted-foreground">Operating activities</p></CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Operating Activities</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow><TableCell className="font-semibold text-emerald-600">Cash received from customers</TableCell><TableCell className="text-right font-mono text-emerald-600">+ {fmt(cashFlow.inflows)}</TableCell></TableRow>
                  <TableRow><TableCell className="pl-6 text-muted-foreground">Cash paid to suppliers (purchases)</TableCell><TableCell className="text-right font-mono text-rose-500">− {fmt(cashFlow.outPurch)}</TableCell></TableRow>
                  <TableRow><TableCell className="pl-6 text-muted-foreground">Cash paid for expenses</TableCell><TableCell className="text-right font-mono text-rose-500">− {fmt(cashFlow.outExp)}</TableCell></TableRow>
                  <TableRow><TableCell className="pl-6 text-muted-foreground">Cash paid to employees (payroll)</TableCell><TableCell className="text-right font-mono text-rose-500">− {fmt(cashFlow.outPay)}</TableCell></TableRow>
                  <TableRow className="border-t font-bold">
                    <TableCell>Net Operating Cash Flow</TableCell>
                    <TableCell className={cn('text-right font-mono font-bold', cashFlow.net >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{cashFlow.net >= 0 ? '+' : ''}{fmt(cashFlow.net)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      );

      // ── BALANCE SHEET ─────────────────────────────────────────────────────────
      case 'balance': return (
        <div className="space-y-4">
          <div><h2 className="text-lg font-bold">Balance Sheet</h2><p className="text-sm text-muted-foreground">As at {format(new Date(), 'PPP')} — simplified view</p></div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm font-bold text-blue-600 uppercase tracking-wider">Assets</CardTitle></CardHeader>
              <CardContent>
                <Table><TableBody>
                  <TableRow><TableCell className="text-muted-foreground text-sm font-semibold uppercase">Current Assets</TableCell><TableCell /></TableRow>
                  <TableRow><TableCell className="pl-6">Cash & Bank Reserves</TableCell><TableCell className="text-right font-mono">{fmt(balanceSheet.cash)}</TableCell></TableRow>
                  <TableRow><TableCell className="pl-6">Accounts Receivable</TableCell><TableCell className="text-right font-mono">{fmt(balanceSheet.ar)}</TableCell></TableRow>
                  <TableRow className="font-bold border-t"><TableCell>Total Assets</TableCell><TableCell className="text-right font-mono text-blue-600">{fmt(balanceSheet.totalAssets)}</TableCell></TableRow>
                </TableBody></Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-bold text-rose-600 uppercase tracking-wider">Liabilities & Equity</CardTitle></CardHeader>
              <CardContent>
                <Table><TableBody>
                  <TableRow><TableCell className="text-muted-foreground text-sm font-semibold uppercase">Current Liabilities</TableCell><TableCell /></TableRow>
                  <TableRow><TableCell className="pl-6">Accounts Payable (unpaid purchases)</TableCell><TableCell className="text-right font-mono">{fmt(balanceSheet.ap)}</TableCell></TableRow>
                  <TableRow><TableCell className="pl-6">VAT Payable (net)</TableCell><TableCell className="text-right font-mono">{fmt(balanceSheet.vatLiab)}</TableCell></TableRow>
                  <TableRow className="font-bold border-t"><TableCell>Total Liabilities</TableCell><TableCell className="text-right font-mono text-rose-600">{fmt(balanceSheet.totalLiab)}</TableCell></TableRow>
                  <TableRow><TableCell className="text-muted-foreground text-sm font-semibold uppercase pt-4">Equity</TableCell><TableCell /></TableRow>
                  <TableRow className="font-bold"><TableCell className="pl-6">Retained Earnings / Net Equity</TableCell><TableCell className={cn('text-right font-mono font-bold', balanceSheet.equity >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{fmt(balanceSheet.equity)}</TableCell></TableRow>
                </TableBody></Table>
              </CardContent>
            </Card>
          </div>
        </div>
      );

      // ── VAT REPORT ────────────────────────────────────────────────────────────
      case 'vat': return (
        <div className="space-y-4">
          <div><h2 className="text-lg font-bold">VAT Report</h2><p className="text-sm text-muted-foreground">{periodLabel}</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: 'Output VAT (Sales)', value: pl.outVAT, color: 'text-amber-600' },
              { label: 'Input VAT (Purchases + Expenses)', value: pl.inVATpurch + pl.inVATexp, color: 'text-emerald-600' },
              { label: 'Net VAT Liability', value: pl.netVAT, color: pl.netVAT >= 0 ? 'text-amber-600' : 'text-emerald-600' },
            ].map(m => <Card key={m.label}><CardContent className="pt-4"><p className="text-sm text-muted-foreground">{m.label}</p><p className={cn('text-2xl font-bold', m.color)}>{fmt(m.value)}</p></CardContent></Card>)}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Output VAT — Sales Invoices</CardTitle></CardHeader>
              <CardContent><Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">VAT</TableHead></TableRow></TableHeader>
                <TableBody>
                  {fd.invoices.map(inv => { const t = calcInvoiceTotals(inv); return (
                    <TableRow key={inv.id}><TableCell className="font-mono text-xs">{inv.id}</TableCell><TableCell>{format(parseISO(inv.invoiceDate.slice(0,10)),'dd/MM/yy')}</TableCell><TableCell className="text-right">{fmt(t.netAmount)}</TableCell><TableCell className="text-right text-amber-600">{fmt(t.vatAmount)}</TableCell></TableRow>
                  );})}
                </TableBody>
                <TableFooter><TableRow><TableCell colSpan={3} className="text-right font-bold">Total Output VAT</TableCell><TableCell className="text-right font-bold text-amber-600">{fmt(pl.outVAT)}</TableCell></TableRow></TableFooter>
              </Table></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Input VAT — Purchases</CardTitle></CardHeader>
              <CardContent><Table>
                <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">VAT</TableHead></TableRow></TableHeader>
                <TableBody>
                  {fd.purchases.filter(p => (p.taxAmount || 0) > 0).map(p => (
                    <TableRow key={p.id}><TableCell className="text-sm">{p.supplier}</TableCell><TableCell>{format(parseISO(p.date.slice(0,10)),'dd/MM/yy')}</TableCell><TableCell className="text-right">{fmt(p.totalCost-(p.taxAmount||0))}</TableCell><TableCell className="text-right text-emerald-600">{fmt(p.taxAmount||0)}</TableCell></TableRow>
                  ))}
                </TableBody>
                <TableFooter><TableRow><TableCell colSpan={3} className="text-right font-bold">Total Input VAT</TableCell><TableCell className="text-right font-bold text-emerald-600">{fmt(pl.inVATpurch + pl.inVATexp)}</TableCell></TableRow></TableFooter>
              </Table></CardContent>
            </Card>
          </div>
        </div>
      );

      // ── WHT REPORT ────────────────────────────────────────────────────────────
      case 'wht': return (
        <div className="space-y-4">
          <div><h2 className="text-lg font-bold">Withholding Tax Report</h2><p className="text-sm text-muted-foreground">{periodLabel}</p></div>
          <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total WHT / PAYE Accrued</p><p className="text-3xl font-bold text-amber-600">{fmt(whtTotal)}</p></CardContent></Card>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Tax Type</TableHead><TableHead>Reference</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Gross Base</TableHead><TableHead className="text-right">Tax Withheld</TableHead></TableRow></TableHeader>
                <TableBody>
                  {whtRows.length > 0 ? whtRows.map((r, i) => (
                    <TableRow key={i}><TableCell className="text-sm">{r.type}</TableCell><TableCell className="text-sm">{r.ref}</TableCell><TableCell>{r.date ? format(parseISO(r.date.slice(0,10)),'dd/MM/yy') : '—'}</TableCell><TableCell className="text-right">{fmt(r.base)}</TableCell><TableCell className="text-right font-semibold text-amber-600">{fmt(r.wht)}</TableCell></TableRow>
                  )) : <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No WHT / PAYE entries in this period.</TableCell></TableRow>}
                </TableBody>
                <TableFooter><TableRow><TableCell colSpan={4} className="text-right font-bold">Total</TableCell><TableCell className="text-right font-bold text-amber-600">{fmt(whtTotal)}</TableCell></TableRow></TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>
      );

      // ── EXPENSE ANALYSIS ──────────────────────────────────────────────────────
      case 'expense-analysis': return (
        <div className="space-y-4">
          <div><h2 className="text-lg font-bold">Expense Analysis</h2><p className="text-sm text-muted-foreground">{periodLabel}</p></div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">By Category</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name}: ${(percent*100).toFixed(0)}%`}>
                    {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip formatter={(v: any) => fmt(v)} /></PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Category Breakdown</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {expenseByCategory.map((r, i) => {
                      const total = expenseByCategory.reduce((s,x)=>s+x.value,0);
                      return <TableRow key={i}><TableCell><div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:COLORS[i%COLORS.length]}}/>{r.name}</div></TableCell><TableCell className="text-right">{fmt(r.value)}</TableCell><TableCell className="text-right text-muted-foreground">{pct(r.value,total)}</TableCell></TableRow>;
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      );

      // ── EVENT PROFITABILITY ───────────────────────────────────────────────────
      case 'event-pl': return (
        <div className="space-y-4">
          <div><h2 className="text-lg font-bold">Event Profitability Report</h2><p className="text-sm text-muted-foreground">P&L per date of activity — {periodLabel}</p></div>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">COGS</TableHead><TableHead className="text-right">Expenses</TableHead><TableHead className="text-right">Labour</TableHead><TableHead className="text-right">Net Profit</TableHead><TableHead className="text-right">Margin</TableHead></TableRow></TableHeader>
                <TableBody>
                  {eventPLRows.length > 0 ? eventPLRows.map(r => (
                    <TableRow key={r.date}>
                      <TableCell className="font-medium">{format(parseISO(r.date),'PPP')}</TableCell>
                      <TableCell className="text-right text-blue-600">{fmt(r.revNet)}</TableCell>
                      <TableCell className="text-right text-rose-500">{r.cogs > 0 ? `(${fmt(r.cogs)})` : '—'}</TableCell>
                      <TableCell className="text-right text-amber-600">{r.opex > 0 ? `(${fmt(r.opex)})` : '—'}</TableCell>
                      <TableCell className="text-right text-indigo-600">{r.labour > 0 ? `(${fmt(r.labour)})` : '—'}</TableCell>
                      <TableCell className={cn('text-right font-bold', r.profit >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{fmt(r.profit)}</TableCell>
                      <TableCell className={cn('text-right', r.profit >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{r.margin.toFixed(1)}%</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No activity in this period.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      );

      // ── FOOD COST % ───────────────────────────────────────────────────────────
      case 'food-cost': return (
        <div className="space-y-4">
          <div><h2 className="text-lg font-bold">Food Cost Percentage Report</h2><p className="text-sm text-muted-foreground">{periodLabel}</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold text-blue-600">{fmt(foodCost.totalRev)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Food-Related Purchases</p><p className="text-2xl font-bold text-emerald-600">{fmt(foodCost.totalFood)}</p></CardContent></Card>
            <Card className={cn('border-2', foodCost.pctVal > 35 ? 'border-rose-400' : 'border-emerald-400')}>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Food Cost %</p>
                <p className={cn('text-3xl font-black', foodCost.pctVal > 35 ? 'text-rose-600' : 'text-emerald-600')}>{foodCost.pctVal.toFixed(1)}%</p>
                <Badge variant="outline" className={cn('mt-1 text-xs', foodCost.pctVal > 35 ? 'border-rose-500 text-rose-600' : 'border-emerald-500 text-emerald-600')}>
                  {foodCost.pctVal > 35 ? '⚠ Above 35% benchmark' : '✓ Within 28–35% target'}
                </Badge>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Food & Ingredient Purchases</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Cost (TZS)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {foodCost.rows.map(p => <TableRow key={p.id}><TableCell>{format(parseISO(p.date.slice(0,10)),'dd MMM yyyy')}</TableCell><TableCell>{p.supplier}</TableCell><TableCell className="max-w-[200px] truncate">{p.description}</TableCell><TableCell className="text-right">{fmt(p.totalCost)}</TableCell></TableRow>)}
                </TableBody>
                <TableFooter><TableRow><TableCell colSpan={3} className="text-right font-bold">Total Food Cost</TableCell><TableCell className="text-right font-bold text-emerald-600">{fmt(foodCost.totalFood)}</TableCell></TableRow></TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>
      );

      // ── BEST-SELLING MENU ─────────────────────────────────────────────────────
      case 'best-menu': return (
        <div className="space-y-4">
          <div><h2 className="text-lg font-bold">Best-Selling Menu Report</h2><p className="text-sm text-muted-foreground">{periodLabel}</p></div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Revenue by Menu Item</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={menuRows.slice(0,8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1}/>
                    <XAxis type="number" stroke="#888" fontSize={10} tickFormatter={v=>`${(v/1000000).toFixed(1)}M`}/>
                    <YAxis type="category" dataKey="name" stroke="#888" fontSize={10} width={110}/>
                    <Tooltip formatter={(v:any)=>fmt(v)}/>
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[0,4,4,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Ranked List</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Menu Item</TableHead><TableHead className="text-right">Pax</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {menuRows.length > 0 ? menuRows.map((r, i) => <TableRow key={i}><TableCell className="font-bold text-muted-foreground">{i+1}</TableCell><TableCell>{r.name}</TableCell><TableCell className="text-right">{num(r.pax)}</TableCell><TableCell className="text-right font-semibold">{fmt(r.revenue)}</TableCell></TableRow>)
                    : <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No invoice items in this period.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      );

      // ── STAFF COST ────────────────────────────────────────────────────────────
      case 'staff-cost': return (
        <div className="space-y-4">
          <div><h2 className="text-lg font-bold">Staff Cost Report</h2><p className="text-sm text-muted-foreground">{periodLabel}</p></div>
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Payroll Cost (period)</p>
            <p className="text-3xl font-bold text-indigo-600">{fmt(fd.payrolls.reduce((s,p)=>s+p.netSalary+(p.wcf_contrib||0),0))}</p>
          </CardContent></Card>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Deductions</TableHead><TableHead className="text-right">Net Salary</TableHead><TableHead className="text-right">WCF</TableHead></TableRow></TableHeader>
                <TableBody>
                  {fd.payrolls.length > 0 ? fd.payrolls.map(pay => (
                    <TableRow key={pay.id}>
                      <TableCell className="font-medium">{pay.employeeName}</TableCell>
                      <TableCell>{pay.paymentDate ? format(parseISO(pay.paymentDate.slice(0,10)),'dd MMM yy') : pay.payPeriodEnd ? format(parseISO(pay.payPeriodEnd.slice(0,10)),'dd MMM yy') : '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{pay.staff_type || 'staff'}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(pay.grossSalary)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(pay.deductions)}</TableCell>
                      <TableCell className="text-right font-semibold text-indigo-600">{fmt(pay.netSalary)}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">{fmt(pay.wcf_contrib||0)}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No payroll records in this period.</TableCell></TableRow>}
                </TableBody>
                <TableFooter><TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">Totals</TableCell>
                  <TableCell className="text-right font-bold">{fmt(fd.payrolls.reduce((s,p)=>s+p.grossSalary,0))}</TableCell>
                  <TableCell className="text-right font-bold">{fmt(fd.payrolls.reduce((s,p)=>s+p.deductions,0))}</TableCell>
                  <TableCell className="text-right font-bold text-indigo-600">{fmt(fd.payrolls.reduce((s,p)=>s+p.netSalary,0))}</TableCell>
                  <TableCell className="text-right font-bold text-muted-foreground">{fmt(fd.payrolls.reduce((s,p)=>s+(p.wcf_contrib||0),0))}</TableCell>
                </TableRow></TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>
      );

      // ── WASTAGE ───────────────────────────────────────────────────────────────
      case 'wastage': return (
        <div className="space-y-4">
          <div><h2 className="text-lg font-bold">Inventory Stock-Out Report</h2><p className="text-sm text-muted-foreground">Goods issued from stock — {periodLabel}</p></div>
          <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Stock-Out Value (potential COGS / wastage)</p><p className="text-3xl font-bold text-amber-600">{fmt(wastageTotal)}</p></CardContent></Card>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Branch</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                <TableBody>
                  {wastageRows.length > 0 ? wastageRows.map((l: any) => (
                    <TableRow key={l.id}><TableCell>{format(parseISO(l.date.slice(0,10)),'dd MMM yyyy')}</TableCell><TableCell className="font-medium">{l.productName}</TableCell><TableCell>{l.branch}</TableCell><TableCell className="text-muted-foreground text-sm max-w-[160px] truncate" title={l.reason}>{l.reason}</TableCell><TableCell className="text-right">{num(l.quantity)}</TableCell><TableCell className="text-right">{fmt(Number(l.actual_unit_price))}</TableCell><TableCell className="text-right font-semibold">{fmt(l.lineValue)}</TableCell></TableRow>
                  )) : <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No stock-out records in this period.</TableCell></TableRow>}
                </TableBody>
                <TableFooter><TableRow><TableCell colSpan={6} className="text-right font-bold">Total Value</TableCell><TableCell className="text-right font-bold text-amber-600">{fmt(wastageTotal)}</TableCell></TableRow></TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>
      );

      // ── SUPPLIER SPENDING ─────────────────────────────────────────────────────
      case 'suppliers': return (
        <div className="space-y-4">
          <div><h2 className="text-lg font-bold">Supplier Spending Analysis</h2><p className="text-sm text-muted-foreground">{periodLabel}</p></div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Top Suppliers by Spend</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={supplierRows.slice(0,6)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1}/>
                    <XAxis type="number" stroke="#888" fontSize={10} tickFormatter={v=>`${(v/1000000).toFixed(1)}M`}/>
                    <YAxis type="category" dataKey="supplier" stroke="#888" fontSize={10} width={120} tickFormatter={v=>v.length>14?v.slice(0,14)+'…':v}/>
                    <Tooltip formatter={(v:any)=>fmt(v)}/>
                    <Bar dataKey="total" fill="#10b981" radius={[0,4,4,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Supplier Table</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>TIN</TableHead><TableHead className="text-right">Invoices</TableHead><TableHead className="text-right">Total Spent</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {supplierRows.length > 0 ? supplierRows.map((r, i) => <TableRow key={i}><TableCell className="font-medium">{r.supplier}</TableCell><TableCell className="font-mono text-xs">{r.tin}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right font-semibold">{fmt(r.total)}</TableCell></TableRow>)
                    : <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No purchases in this period.</TableCell></TableRow>}
                  </TableBody>
                  <TableFooter><TableRow><TableCell colSpan={3} className="text-right font-bold">Total</TableCell><TableCell className="text-right font-bold text-emerald-600">{fmt(supplierRows.reduce((s,r)=>s+r.total,0))}</TableCell></TableRow></TableFooter>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      );

      // ── CUSTOMER TRENDS ───────────────────────────────────────────────────────
      case 'customer-trends': return (
        <div className="space-y-4">
          <div><h2 className="text-lg font-bold">Customer Sales Trends</h2><p className="text-sm text-muted-foreground">{periodLabel}</p></div>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Invoices</TableHead><TableHead className="text-right">Total Revenue</TableHead><TableHead className="text-right">Last Invoice</TableHead></TableRow></TableHeader>
                <TableBody>
                  {customerRows.length > 0 ? customerRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-bold text-muted-foreground">{i+1}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right font-semibold text-blue-600">{fmt(r.revenue)}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">{r.last ? format(parseISO(r.last.slice(0,10)),'dd MMM yyyy') : '—'}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No invoices in this period.</TableCell></TableRow>}
                </TableBody>
                <TableFooter><TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold text-blue-600">{fmt(customerRows.reduce((s,r)=>s+r.revenue,0))}</TableCell>
                  <TableCell />
                </TableRow></TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>
      );

      // ── OUTSTANDING BALANCES (AR AGING) ───────────────────────────────────────
      case 'outstanding': return (
        <div className="space-y-4">
          <div><h2 className="text-lg font-bold">Outstanding Customer Balances</h2><p className="text-sm text-muted-foreground">Accounts Receivable Aging — as at {format(new Date(),'PPP')}</p></div>
          <div className="grid gap-4 md:grid-cols-4">
            {(['0–30 days','31–60 days','61–90 days','90+ days'] as const).map(bucket => {
              const val = arRows.filter(r=>r.bucket===bucket).reduce((s,r)=>s+r.balanceDue,0);
              const color = bucket === '0–30 days' ? 'text-blue-600' : bucket === '31–60 days' ? 'text-amber-600' : bucket === '61–90 days' ? 'text-orange-600' : 'text-rose-600';
              return <Card key={bucket}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{bucket}</p><p className={cn('text-xl font-bold', color)}>{fmt(val)}</p></CardContent></Card>;
            })}
          </div>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Invoice #</TableHead><TableHead>Invoice Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Days O/S</TableHead><TableHead className="text-right">Balance Due</TableHead><TableHead>Aging Bucket</TableHead></TableRow></TableHeader>
                <TableBody>
                  {arRows.length > 0 ? arRows.map(({ inv, balanceDue, days, bucket }) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{getClientName(inv.clientId)}</TableCell>
                      <TableCell className="font-mono text-sm">{inv.id}</TableCell>
                      <TableCell>{format(parseISO(inv.invoiceDate.slice(0,10)),'dd MMM yyyy')}</TableCell>
                      <TableCell><Badge variant={inv.status==='partially paid'?'default':'outline'} className={inv.status==='partially paid'?'bg-blue-600':''}>{inv.status}</Badge></TableCell>
                      <TableCell className="text-right">{days}d</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(balanceDue)}</TableCell>
                      <TableCell><Badge variant="outline" className={cn('text-xs', bucket==='90+ days'?'border-rose-500 text-rose-600':bucket==='61–90 days'?'border-orange-500 text-orange-600':bucket==='31–60 days'?'border-amber-500 text-amber-600':'border-blue-500 text-blue-600')}>{bucket}</Badge></TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No outstanding balances.</TableCell></TableRow>}
                </TableBody>
                <TableFooter><TableRow><TableCell colSpan={5} className="text-right font-bold">Total Outstanding</TableCell><TableCell className="text-right font-bold text-rose-600">{fmt(arTotal)}</TableCell><TableCell /></TableRow></TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>
      );
    }
  };

  // ── Layout ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">Financial & Operations Reports</h2>
          <p className="text-sm text-muted-foreground">Comprehensive reporting across all financial and catering activity.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Period:</span>
          <Select value={period} onValueChange={v => setPeriod(v as Period)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_3_months">Last 3 Months</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="all_time">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Body: sidebar + report */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar navigation */}
        <div className="md:w-52 shrink-0 space-y-4">
          {GROUPS.map(group => (
            <div key={group.label}>
              <p className={cn('text-xs font-bold uppercase tracking-wider mb-2', group.color)}>{group.label}</p>
              <div className="space-y-0.5">
                {group.reports.map(r => {
                  const Icon = r.icon;
                  return (
                    <Button
                      key={r.id}
                      variant={activeReport === r.id ? 'secondary' : 'ghost'}
                      className={cn('w-full justify-start h-8 text-sm font-normal', activeReport === r.id && 'font-semibold')}
                      onClick={() => setActiveReport(r.id)}
                    >
                      <Icon className="mr-2 h-3.5 w-3.5 shrink-0" />
                      {r.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Report content */}
        <div className="flex-1 min-w-0">
          {renderReport()}
        </div>
      </div>
    </div>
  );
}
