/** Shared shape every business-report module renders into — keeps the page and
 * PDF export generic instead of needing one bespoke component per module. */
export interface ReportKpi {
  label: string;
  value: number;
  format: 'currency' | 'number' | 'percent';
  deltaPct?: number; // vs the equivalent previous period, when computable
}

export interface ReportTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface ReportChartPoint {
  name: string;
  value: number;
}

export interface ReportChart {
  title: string;
  type: 'bar' | 'pie';
  data: ReportChartPoint[];
}

export interface ModuleReportData {
  moduleId: string;
  moduleLabel: string;
  kpis: ReportKpi[];
  tables: ReportTable[];
  charts: ReportChart[];
}

export interface AiInsights {
  narrative: string;
  bullets: string[];
  recommendations: string[];
}
