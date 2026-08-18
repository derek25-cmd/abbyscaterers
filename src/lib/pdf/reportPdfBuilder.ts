import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ModuleReportData, AiInsights, ReportKpi } from '@/lib/reports/types';

/**
 * Shared PDF layout, extracted from the three copies of this same pattern
 * that already existed (src/lib/payslipPdf.ts, src/lib/menuCostingPdf.ts,
 * and the local pdfHeader() in finances/reports/page.tsx) — same brand
 * header, same dark-brown [51, 42, 38] table header colour, same
 * `y = lastAutoTable.finalY + gap` chaining, same page-number footer.
 */

const BRAND_COLOR: [number, number, number] = [51, 42, 38];
const MARGIN = 14;

export interface ReportDoc {
  doc: jsPDF;
  y: number;
}

function fmtValue(v: { value: number; format: ReportKpi['format'] }): string {
  if (v.format === 'currency') return `TZS ${Math.round(v.value).toLocaleString()}`;
  if (v.format === 'percent') return `${v.value.toFixed(1)}%`;
  return v.value.toLocaleString();
}

export function createReportDoc(title: string, subtitle: string, orientation: 'portrait' | 'landscape' = 'portrait'): ReportDoc {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = MARGIN;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text("ABBY'S LEGENDARY CATERERS", MARGIN, y);
  y += 7;

  doc.setFontSize(13);
  doc.text(title, MARGIN, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(subtitle, MARGIN, y);
  y += 4;
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, MARGIN, y);
  y += 6;
  doc.setTextColor(0, 0, 0);

  return { doc, y };
}

export function addKpiTable(rd: ReportDoc, kpis: ReportKpi[]): void {
  autoTable(rd.doc, {
    startY: rd.y,
    head: [['Metric', 'Value', 'vs Previous Period']],
    body: kpis.map((k) => [k.label, fmtValue(k), typeof k.deltaPct === 'number' ? `${k.deltaPct >= 0 ? '+' : ''}${k.deltaPct.toFixed(1)}%` : '—']),
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    margin: { left: MARGIN, right: MARGIN },
  });
  rd.y = (rd.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

export function addDataTable(rd: ReportDoc, title: string, columns: string[], rows: (string | number)[][]): void {
  const pageHeight = rd.doc.internal.pageSize.getHeight();
  if (rd.y > pageHeight - 40) {
    rd.doc.addPage();
    rd.y = MARGIN;
  }
  rd.doc.setFontSize(11);
  rd.doc.setFont('helvetica', 'bold');
  rd.doc.text(title, MARGIN, rd.y);
  rd.y += 5;

  autoTable(rd.doc, {
    startY: rd.y,
    head: [columns],
    body: rows.length ? rows.map((r) => r.map((c) => (typeof c === 'number' ? c.toLocaleString() : c))) : [['No data in this period', ...Array(Math.max(0, columns.length - 1)).fill('')]],
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255] },
    margin: { left: MARGIN, right: MARGIN },
  });
  rd.y = (rd.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

export function addNarrativeSection(rd: ReportDoc, title: string, insights: AiInsights): void {
  const pageWidth = rd.doc.internal.pageSize.getWidth();
  const pageHeight = rd.doc.internal.pageSize.getHeight();
  if (rd.y > pageHeight - 50) {
    rd.doc.addPage();
    rd.y = MARGIN;
  }

  rd.doc.setFontSize(11);
  rd.doc.setFont('helvetica', 'bold');
  rd.doc.text(title, MARGIN, rd.y);
  rd.y += 6;

  rd.doc.setFontSize(9);
  rd.doc.setFont('helvetica', 'normal');
  const narrativeLines = rd.doc.splitTextToSize(insights.narrative, pageWidth - MARGIN * 2);
  rd.doc.text(narrativeLines, MARGIN, rd.y);
  rd.y += narrativeLines.length * 4.5 + 4;

  if (insights.bullets.length) {
    rd.doc.setFont('helvetica', 'bold');
    rd.doc.text('Key Observations', MARGIN, rd.y);
    rd.y += 5;
    rd.doc.setFont('helvetica', 'normal');
    insights.bullets.forEach((b) => {
      const lines = rd.doc.splitTextToSize(`•  ${b}`, pageWidth - MARGIN * 2 - 4);
      rd.doc.text(lines, MARGIN + 2, rd.y);
      rd.y += lines.length * 4.5 + 1;
    });
    rd.y += 3;
  }

  if (insights.recommendations.length) {
    rd.doc.setFont('helvetica', 'bold');
    rd.doc.text('Recommendations', MARGIN, rd.y);
    rd.y += 5;
    rd.doc.setFont('helvetica', 'normal');
    insights.recommendations.forEach((r) => {
      const lines = rd.doc.splitTextToSize(`•  ${r}`, pageWidth - MARGIN * 2 - 4);
      rd.doc.text(lines, MARGIN + 2, rd.y);
      rd.y += lines.length * 4.5 + 1;
    });
  }
}

export function finalizeAndSave(rd: ReportDoc, filename: string): void {
  const pageCount = rd.doc.getNumberOfPages();
  const pageWidth = rd.doc.internal.pageSize.getWidth();
  const pageHeight = rd.doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    rd.doc.setPage(i);
    rd.doc.setFontSize(8);
    rd.doc.setTextColor(150, 150, 150);
    rd.doc.setFont('helvetica', 'normal');
    rd.doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }
  rd.doc.save(filename);
}

/** Builds and saves a complete module report PDF in one call. */
export function exportModuleReportPdf(data: ModuleReportData, periodLabel: string, insights: AiInsights | null): void {
  const rd = createReportDoc(data.moduleLabel, `Period: ${periodLabel}`, 'portrait');
  addKpiTable(rd, data.kpis);
  data.tables.forEach((t) => addDataTable(rd, t.title, t.columns, t.rows));
  if (insights) addNarrativeSection(rd, 'AI Insights', insights);
  finalizeAndSave(rd, `${data.moduleLabel.replace(/\s+/g, '_')}_${periodLabel.replace(/\s+/g, '_')}.pdf`);
}

export function addComparisonTable(rd: ReportDoc, kpisA: ReportKpi[], kpisB: ReportKpi[], labelA: string, labelB: string): void {
  autoTable(rd.doc, {
    startY: rd.y,
    head: [['Metric', labelA, labelB, 'Δ%']],
    body: kpisA.map((a, i) => {
      const b = kpisB[i];
      const delta = b && b.value !== 0 ? ((a.value - b.value) / Math.abs(b.value)) * 100 : undefined;
      return [
        a.label,
        fmtValue(a),
        b ? fmtValue(b) : '—',
        typeof delta === 'number' ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%` : '—',
      ];
    }),
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: MARGIN, right: MARGIN },
  });
  rd.y = (rd.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

/** Builds and saves a single-module comparison report: Period A vs Period B. */
export function exportComparisonPdf(moduleLabel: string, periodALabel: string, periodBLabel: string, kpisA: ReportKpi[], kpisB: ReportKpi[], insights: AiInsights | null): void {
  const rd = createReportDoc(`${moduleLabel} — Comparison`, `${periodALabel}  vs  ${periodBLabel}`, 'portrait');
  addComparisonTable(rd, kpisA, kpisB, periodALabel, periodBLabel);
  if (insights) addNarrativeSection(rd, 'AI Insights', insights);
  finalizeAndSave(rd, `${moduleLabel.replace(/\s+/g, '_')}_Comparison_${periodALabel.replace(/\s+/g, '_')}_vs_${periodBLabel.replace(/\s+/g, '_')}.pdf`);
}

/** Builds and saves the cross-department executive summary — every module's
 * KPI table in one document, with the AI executive narrative up front. */
export function exportExecutiveSummaryPdf(modules: ModuleReportData[], periodLabel: string, insights: AiInsights | null): void {
  const rd = createReportDoc('Executive Summary — All Departments', `Period: ${periodLabel}`, 'portrait');
  if (insights) addNarrativeSection(rd, 'Executive Narrative', insights);

  modules.forEach((m) => {
    const pageHeight = rd.doc.internal.pageSize.getHeight();
    if (rd.y > pageHeight - 50) {
      rd.doc.addPage();
      rd.y = MARGIN;
    }
    rd.doc.setFontSize(12);
    rd.doc.setFont('helvetica', 'bold');
    rd.doc.text(m.moduleLabel, MARGIN, rd.y);
    rd.y += 6;
    addKpiTable(rd, m.kpis);
  });

  finalizeAndSave(rd, `Executive_Summary_${periodLabel.replace(/\s+/g, '_')}.pdf`);
}

/** Builds and saves the cross-department comparison: every module's KPIs,
 * Period A vs Period B, in one document. */
export function exportExecutiveComparisonPdf(modulesA: ModuleReportData[], modulesB: ModuleReportData[], periodALabel: string, periodBLabel: string, insights: AiInsights | null): void {
  const rd = createReportDoc('Executive Summary — Comparison', `${periodALabel}  vs  ${periodBLabel}`, 'portrait');
  if (insights) addNarrativeSection(rd, 'Executive Comparison Narrative', insights);

  modulesA.forEach((mA) => {
    const mB = modulesB.find((m) => m.moduleId === mA.moduleId);
    if (!mB) return;
    const pageHeight = rd.doc.internal.pageSize.getHeight();
    if (rd.y > pageHeight - 50) {
      rd.doc.addPage();
      rd.y = MARGIN;
    }
    rd.doc.setFontSize(12);
    rd.doc.setFont('helvetica', 'bold');
    rd.doc.text(mA.moduleLabel, MARGIN, rd.y);
    rd.y += 6;
    addComparisonTable(rd, mA.kpis, mB.kpis, periodALabel, periodBLabel);
  });

  finalizeAndSave(rd, `Executive_Comparison_${periodALabel.replace(/\s+/g, '_')}_vs_${periodBLabel.replace(/\s+/g, '_')}.pdf`);
}
