'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSales } from '@/services/saleService';
import { getInvoices } from '@/services/invoiceService';
import { getProformaInvoices } from '@/services/proformaInvoiceService';
import { getOrders } from '@/services/orderService';
import { excludeCancelledOrders } from '@/lib/order-utils';
import { getBookings } from '@/services/bookingService';
import { getPurchases } from '@/services/purchaseService';
import { getExpenses } from '@/services/expenseService';
import { getPayrolls } from '@/services/payrollService';
import { getEmployees } from '@/services/employeeService';
import { getAttendanceRecords } from '@/services/attendanceService';
import { getProducts } from '@/services/productService';
import { getStockLogs } from '@/services/stockLogService';
import { getIngredients } from '@/services/ingredientService';
import { getIssuances } from '@/services/issuanceService';
import { getRecipes } from '@/services/recipeService';
import { getCateringMenus } from '@/services/menuCostingService';
import { getAssets } from '@/services/assetService';
import { getDeliveryNotes } from '@/services/deliveryNoteService';
import { getClients } from '@/services/clientService';
import { useStaffRole } from '@/hooks/use-staff-role';
import { authedFetch } from '@/lib/authed-fetch';
import { getPeriodRange, recentReferenceDates, PERIOD_TYPE_LABELS, type PeriodType } from '@/lib/reports/periods';
import { MODULE_CATALOG, MODULE_CATEGORIES } from '@/lib/reports/registry';
import type { RawDatasets } from '@/lib/reports/business-data';
import {
  aggregateSalesRevenue, aggregatePurchases, aggregateExpenses, aggregateTaxCompliance,
  aggregatePayrollHR, aggregateAttendance, aggregateInventoryStock, aggregateMenuCosting,
  aggregateAssetsEquipment, aggregateDelivery, aggregateClients,
} from '@/lib/reports/business-data';
import { fetchMarketingModuleData } from '@/lib/reports/marketing-data';
import { fetchSystemModuleData } from '@/lib/reports/system-data';
import type { ModuleReportData, AiInsights, ReportKpi } from '@/lib/reports/types';
import { exportModuleReportPdf, exportExecutiveSummaryPdf, exportComparisonPdf, exportExecutiveComparisonPdf } from '@/lib/pdf/reportPdfBuilder';
import { ModuleReportView } from '@/components/reports/business/module-report-view';
import { ComparisonView } from '@/components/reports/business/comparison-view';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sparkles, FileDown, Loader2, RefreshCw, LayoutDashboard, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const STALE_TIME = 5 * 60 * 1000;

const BUSINESS_AGGREGATORS: Record<string, (raw: RawDatasets, range: ReturnType<typeof getPeriodRange>) => ModuleReportData> = {
  'sales-revenue': aggregateSalesRevenue,
  purchases: aggregatePurchases,
  expenses: aggregateExpenses,
  'tax-compliance': aggregateTaxCompliance,
  'payroll-hr': aggregatePayrollHR,
  'attendance-workforce': aggregateAttendance,
  'inventory-stock': aggregateInventoryStock,
  'menu-costing': aggregateMenuCosting,
  'assets-equipment': aggregateAssetsEquipment,
  'delivery-fulfillment': aggregateDelivery,
  clients: aggregateClients,
};

export default function BusinessReportsPage() {
  const { isAdmin, role, isLoading: roleLoading } = useStaffRole();
  const canView = isAdmin || role === 'finance';

  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [selectedModule, setSelectedModule] = useState<string>('executive');
  const [insightsByKey, setInsightsByKey] = useState<Record<string, AiInsights | null>>({});
  const [insightsLoadingKey, setInsightsLoadingKey] = useState<string | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // ── Period selection: A is the primary period, B is only used when
  // comparison mode is on. Both default to '' meaning "use the Nth most
  // recent instance" (see effectiveAInstance/effectiveBInstance below) —
  // reset whenever the period type changes since a stale instance value
  // from a different type wouldn't match any option in the new list.
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [periodAInstance, setPeriodAInstance] = useState('');
  const [periodBInstance, setPeriodBInstance] = useState('');
  const periodInstances = useMemo(() => recentReferenceDates(periodType, 12), [periodType]);
  useEffect(() => {
    setPeriodAInstance('');
    setPeriodBInstance('');
  }, [periodType]);

  const effectiveAInstance = periodAInstance || periodInstances[0]?.value || new Date().toISOString();
  const effectiveBInstance = periodBInstance || periodInstances[1]?.value || effectiveAInstance;

  const rangeA = useMemo(() => getPeriodRange(periodType, new Date(effectiveAInstance)), [periodType, effectiveAInstance]);
  const rangeB = useMemo(() => getPeriodRange(periodType, new Date(effectiveBInstance)), [periodType, effectiveBInstance]);
  const periodALabel = `${PERIOD_TYPE_LABELS[periodType]} — ${rangeA.label}`;
  const periodBLabel = `${PERIOD_TYPE_LABELS[periodType]} — ${rangeB.label}`;

  // ── Raw datasets (fetched once, filtered per-period client-side — same
  // pattern as src/app/(finances)/finances/reports/page.tsx) ────────────────
  const q = {
    sales: useQuery({ queryKey: ['reports', 'sales'], queryFn: getSales, staleTime: STALE_TIME }),
    invoices: useQuery({ queryKey: ['reports', 'invoices'], queryFn: getInvoices, staleTime: STALE_TIME }),
    proformaInvoices: useQuery({ queryKey: ['reports', 'proformas'], queryFn: getProformaInvoices, staleTime: STALE_TIME }),
    orders: useQuery({
      queryKey: ['reports', 'orders'],
      queryFn: async () => excludeCancelledOrders(await getOrders()),
      staleTime: STALE_TIME,
    }),
    bookings: useQuery({ queryKey: ['reports', 'bookings'], queryFn: getBookings, staleTime: STALE_TIME }),
    purchases: useQuery({ queryKey: ['reports', 'purchases'], queryFn: getPurchases, staleTime: STALE_TIME }),
    expenses: useQuery({ queryKey: ['reports', 'expenses'], queryFn: getExpenses, staleTime: STALE_TIME }),
    payrolls: useQuery({ queryKey: ['reports', 'payrolls'], queryFn: getPayrolls, staleTime: STALE_TIME }),
    employees: useQuery({ queryKey: ['reports', 'employees'], queryFn: getEmployees, staleTime: STALE_TIME }),
    attendance: useQuery({ queryKey: ['reports', 'attendance'], queryFn: () => getAttendanceRecords(), staleTime: STALE_TIME }),
    products: useQuery({ queryKey: ['reports', 'products'], queryFn: getProducts, staleTime: STALE_TIME }),
    stockLogs: useQuery({ queryKey: ['reports', 'stockLogs'], queryFn: getStockLogs, staleTime: STALE_TIME, select: (r: any) => r?.data ?? r ?? [] }),
    ingredients: useQuery({ queryKey: ['reports', 'ingredients'], queryFn: getIngredients, staleTime: STALE_TIME }),
    issuances: useQuery({ queryKey: ['reports', 'issuances'], queryFn: getIssuances, staleTime: STALE_TIME }),
    recipes: useQuery({ queryKey: ['reports', 'recipes'], queryFn: getRecipes, staleTime: STALE_TIME }),
    cateringMenus: useQuery({ queryKey: ['reports', 'cateringMenus'], queryFn: getCateringMenus, staleTime: STALE_TIME }),
    assets: useQuery({ queryKey: ['reports', 'assets'], queryFn: getAssets, staleTime: STALE_TIME }),
    deliveryNotes: useQuery({ queryKey: ['reports', 'deliveryNotes'], queryFn: getDeliveryNotes, staleTime: STALE_TIME }),
    clients: useQuery({ queryKey: ['reports', 'clients'], queryFn: getClients, staleTime: STALE_TIME }),
  };

  const isLoadingBusiness = Object.values(q).some((r) => r.isLoading);

  const raw: RawDatasets = useMemo(() => ({
    sales: q.sales.data ?? [],
    invoices: q.invoices.data ?? [],
    proformaInvoices: q.proformaInvoices.data ?? [],
    orders: q.orders.data ?? [],
    bookings: q.bookings.data ?? [],
    purchases: q.purchases.data ?? [],
    expenses: q.expenses.data ?? [],
    payrolls: q.payrolls.data ?? [],
    employees: q.employees.data ?? [],
    attendance: q.attendance.data ?? [],
    products: q.products.data ?? [],
    stockLogs: (q.stockLogs.data as any[]) ?? [],
    ingredients: q.ingredients.data ?? [],
    issuances: q.issuances.data ?? [],
    recipes: q.recipes.data ?? [],
    cateringMenus: q.cateringMenus.data ?? [],
    assets: q.assets.data ?? [],
    deliveryNotes: q.deliveryNotes.data ?? [],
    clients: q.clients.data ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [Object.values(q).map((r) => r.dataUpdatedAt).join(',')]);

  const marketingQueryA = useQuery({
    queryKey: ['reports', 'marketing', periodType, rangeA.from.toISOString()],
    queryFn: () => fetchMarketingModuleData(rangeA),
    staleTime: STALE_TIME,
    enabled: canView,
  });
  const systemQueryA = useQuery({
    queryKey: ['reports', 'system', periodType, rangeA.from.toISOString()],
    queryFn: () => fetchSystemModuleData(rangeA),
    staleTime: STALE_TIME,
    enabled: canView,
  });
  const marketingQueryB = useQuery({
    queryKey: ['reports', 'marketing', periodType, rangeB.from.toISOString()],
    queryFn: () => fetchMarketingModuleData(rangeB),
    staleTime: STALE_TIME,
    enabled: canView && compareEnabled,
  });
  const systemQueryB = useQuery({
    queryKey: ['reports', 'system', periodType, rangeB.from.toISOString()],
    queryFn: () => fetchSystemModuleData(rangeB),
    staleTime: STALE_TIME,
    enabled: canView && compareEnabled,
  });

  const businessModuleDataA = useMemo(() => {
    const out: Record<string, ModuleReportData> = {};
    for (const [id, fn] of Object.entries(BUSINESS_AGGREGATORS)) out[id] = fn(raw, rangeA);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, rangeA]);
  const businessModuleDataB = useMemo(() => {
    const out: Record<string, ModuleReportData> = {};
    for (const [id, fn] of Object.entries(BUSINESS_AGGREGATORS)) out[id] = fn(raw, rangeB);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, rangeB]);

  const allModulesA: ModuleReportData[] = useMemo(() => {
    const list = Object.values(businessModuleDataA);
    if (marketingQueryA.data) list.push(marketingQueryA.data);
    if (systemQueryA.data) list.push(systemQueryA.data);
    return list;
  }, [businessModuleDataA, marketingQueryA.data, systemQueryA.data]);
  const allModulesB: ModuleReportData[] = useMemo(() => {
    const list = Object.values(businessModuleDataB);
    if (marketingQueryB.data) list.push(marketingQueryB.data);
    if (systemQueryB.data) list.push(systemQueryB.data);
    return list;
  }, [businessModuleDataB, marketingQueryB.data, systemQueryB.data]);

  const activeDataA: ModuleReportData | null =
    selectedModule === 'marketing-crm' ? marketingQueryA.data ?? null :
    selectedModule === 'audit-system' ? systemQueryA.data ?? null :
    selectedModule === 'executive' ? null :
    businessModuleDataA[selectedModule] ?? null;

  const activeDataB: ModuleReportData | null =
    selectedModule === 'marketing-crm' ? marketingQueryB.data ?? null :
    selectedModule === 'audit-system' ? systemQueryB.data ?? null :
    selectedModule === 'executive' ? null :
    businessModuleDataB[selectedModule] ?? null;

  const isLoading = selectedModule === 'marketing-crm' ? marketingQueryA.isLoading
    : selectedModule === 'audit-system' ? systemQueryA.isLoading
    : isLoadingBusiness;
  const isLoadingB = selectedModule === 'marketing-crm' ? marketingQueryB.isLoading
    : selectedModule === 'audit-system' ? systemQueryB.isLoading
    : isLoadingBusiness;

  // ── AI insights ────────────────────────────────────────────────────────────
  async function generateInsights(key: string, data: ModuleReportData) {
    setInsightsLoadingKey(key);
    setInsightsError(null);
    try {
      const res = await authedFetch('/api/reports/ai-insights', {
        method: 'POST',
        body: JSON.stringify({
          moduleLabel: data.moduleLabel,
          periodLabel: periodALabel,
          periodType: PERIOD_TYPE_LABELS[periodType],
          kpis: data.kpis,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'AI insights failed');
      setInsightsByKey((prev) => ({ ...prev, [key]: json.data }));
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'AI insights failed');
    } finally {
      setInsightsLoadingKey(null);
    }
  }

  async function generateComparisonInsightsFor(key: string, moduleLabel: string, kpisA: ReportKpi[], kpisB: ReportKpi[]) {
    setInsightsLoadingKey(key);
    setInsightsError(null);
    try {
      const res = await authedFetch('/api/reports/ai-insights', {
        method: 'POST',
        body: JSON.stringify({ kind: 'comparison', moduleLabel, periodALabel, periodBLabel, kpisA, kpisB }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'AI insights failed');
      setInsightsByKey((prev) => ({ ...prev, [key]: json.data }));
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'AI insights failed');
    } finally {
      setInsightsLoadingKey(null);
    }
  }

  async function generateExecutiveInsights() {
    const key = 'executive';
    setInsightsLoadingKey(key);
    setInsightsError(null);
    try {
      const res = await authedFetch('/api/reports/ai-insights', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'executive-summary',
          periodLabel: periodALabel,
          periodType: PERIOD_TYPE_LABELS[periodType],
          moduleSummaries: allModulesA.map((m) => ({ moduleLabel: m.moduleLabel, kpis: m.kpis })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'AI insights failed');
      setInsightsByKey((prev) => ({ ...prev, [key]: json.data }));
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'AI insights failed');
    } finally {
      setInsightsLoadingKey(null);
    }
  }

  async function generateExecutiveComparisonInsights() {
    const key = 'executive-comparison';
    const flatten = (modules: ModuleReportData[]) => modules.flatMap((m) => m.kpis.map((k) => ({ ...k, label: `${m.moduleLabel} — ${k.label}` })));
    await generateComparisonInsightsFor(key, 'Executive Summary (All Departments)', flatten(allModulesA), flatten(allModulesB));
  }

  if (roleLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <p className="font-semibold">Restricted</p>
        <p className="text-sm text-muted-foreground max-w-sm">Business Reports are only available to admin and finance staff. Contact an administrator if you need access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Business Reports</h1>
          <p className="text-sm text-muted-foreground">Every department, every period — with AI-generated insights and PDF export.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Period:</span>
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIOD_TYPE_LABELS) as PeriodType[]).map((p) => (
                  <SelectItem key={p} value={p}>{PERIOD_TYPE_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={effectiveAInstance} onValueChange={setPeriodAInstance}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {periodInstances.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 border-l pl-3">
            <Switch id="compare-toggle" checked={compareEnabled} onCheckedChange={setCompareEnabled} />
            <Label htmlFor="compare-toggle" className="text-sm font-medium cursor-pointer">Compare</Label>
          </div>
          {compareEnabled && (
            <Select value={effectiveBInstance} onValueChange={setPeriodBInstance}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {periodInstances.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="md:w-56 shrink-0 space-y-4">
          <Button
            variant={selectedModule === 'executive' ? 'secondary' : 'ghost'}
            className={cn('w-full justify-start h-9 text-sm', selectedModule === 'executive' && 'font-semibold')}
            onClick={() => setSelectedModule('executive')}
          >
            <LayoutDashboard className="mr-2 h-4 w-4 shrink-0" /> Executive Summary
          </Button>
          {MODULE_CATEGORIES.map((category) => (
            <div key={category}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground">{category}</p>
              <div className="space-y-0.5">
                {MODULE_CATALOG.filter((m) => m.category === category).map((m) => {
                  const Icon = m.icon;
                  return (
                    <Button
                      key={m.id}
                      variant={selectedModule === m.id ? 'secondary' : 'ghost'}
                      className={cn('w-full justify-start h-8 text-sm font-normal', selectedModule === m.id && 'font-semibold')}
                      onClick={() => setSelectedModule(m.id)}
                    >
                      <Icon className="mr-2 h-3.5 w-3.5 shrink-0" /> {m.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {selectedModule === 'executive' ? (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <div>
                  <h2 className="text-lg font-bold">Executive Summary — All Departments</h2>
                  <p className="text-sm text-muted-foreground">
                    {compareEnabled ? <><span className="font-medium text-foreground">{periodALabel}</span> vs <span className="font-medium text-foreground">{periodBLabel}</span></> : periodALabel}
                  </p>
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={() => compareEnabled
                    ? exportExecutiveComparisonPdf(allModulesA, allModulesB, periodALabel, periodBLabel, insightsByKey['executive-comparison'] ?? null)
                    : exportExecutiveSummaryPdf(allModulesA, periodALabel, insightsByKey['executive'] ?? null)}
                >
                  <FileDown className="mr-2 h-4 w-4" /> Export PDF
                </Button>
              </div>

              {isLoadingBusiness || (compareEnabled && isLoadingB) ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">Loading report data…</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {allModulesA.map((m) => {
                    const mB = compareEnabled ? allModulesB.find((x) => x.moduleId === m.moduleId) : null;
                    return (
                      <Card key={m.moduleId} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedModule(m.moduleId)}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">{m.moduleLabel}</CardTitle></CardHeader>
                        <CardContent className="space-y-1">
                          {m.kpis.slice(0, 3).map((k, i) => {
                            const kB = mB?.kpis[i];
                            const fmt = (v: number) => (k.format === 'currency' ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(v).replace('TZS', 'TZS ')
                              : k.format === 'percent' ? `${v.toFixed(1)}%` : v.toLocaleString());
                            return (
                              <div key={k.label} className="flex justify-between text-sm gap-2">
                                <span className="text-muted-foreground">{k.label}</span>
                                <span className="font-semibold text-right">
                                  {fmt(k.value)}{compareEnabled && kB ? <span className="text-muted-foreground font-normal"> / {fmt(kB.value)}</span> : null}
                                </span>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              <Card className="border-primary/30">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {compareEnabled ? 'Executive Comparison Narrative' : 'Executive AI Narrative'}</CardTitle>
                  <Button
                    variant="ghost" size="sm"
                    onClick={compareEnabled ? generateExecutiveComparisonInsights : generateExecutiveInsights}
                    disabled={insightsLoadingKey === (compareEnabled ? 'executive-comparison' : 'executive')}
                  >
                    {insightsLoadingKey === (compareEnabled ? 'executive-comparison' : 'executive') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    <span className="ml-2">{insightsByKey[compareEnabled ? 'executive-comparison' : 'executive'] ? 'Regenerate' : 'Generate'}</span>
                  </Button>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const key = compareEnabled ? 'executive-comparison' : 'executive';
                    const current = insightsByKey[key];
                    if (insightsLoadingKey === key) return <p className="text-sm text-muted-foreground">Analysing every department with Claude…</p>;
                    if (insightsError && insightsLoadingKey === null) return <p className="text-sm text-rose-600">{insightsError}</p>;
                    if (!current) return <p className="text-sm text-muted-foreground">Click &quot;Generate&quot; for a cross-department AI summary{compareEnabled ? ' comparing these two periods' : ''}.</p>;
                    return (
                      <div className="space-y-3">
                        <p className="text-sm">{current.narrative}</p>
                        {current.bullets.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Key Observations</p>
                            <ul className="list-disc list-inside text-sm space-y-0.5">{current.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
                          </div>
                        )}
                        {current.recommendations.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Recommendations</p>
                            <ul className="list-disc list-inside text-sm space-y-0.5">{current.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          ) : isLoading || !activeDataA || (compareEnabled && (isLoadingB || !activeDataB)) ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">Loading report data…</div>
          ) : compareEnabled && activeDataB ? (
            <ComparisonView
              moduleLabel={activeDataA.moduleLabel}
              periodALabel={periodALabel}
              periodBLabel={periodBLabel}
              dataA={activeDataA}
              dataB={activeDataB}
              insights={insightsByKey[`${selectedModule}-comparison`] ?? null}
              insightsLoading={insightsLoadingKey === `${selectedModule}-comparison`}
              insightsError={insightsLoadingKey !== `${selectedModule}-comparison` ? insightsError : null}
              onGenerateInsights={() => generateComparisonInsightsFor(`${selectedModule}-comparison`, activeDataA.moduleLabel, activeDataA.kpis, activeDataB.kpis)}
              onExportPdf={() => exportComparisonPdf(activeDataA.moduleLabel, periodALabel, periodBLabel, activeDataA.kpis, activeDataB.kpis, insightsByKey[`${selectedModule}-comparison`] ?? null)}
            />
          ) : (
            <ModuleReportView
              data={activeDataA}
              periodLabel={periodALabel}
              insights={insightsByKey[selectedModule] ?? null}
              insightsLoading={insightsLoadingKey === selectedModule}
              insightsError={insightsLoadingKey !== selectedModule ? insightsError : null}
              onGenerateInsights={() => generateInsights(selectedModule, activeDataA)}
              onExportPdf={() => exportModuleReportPdf(activeDataA, periodALabel, insightsByKey[selectedModule] ?? null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
