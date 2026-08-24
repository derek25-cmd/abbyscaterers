import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getStageMeta } from "./pipeline";
import { formatTZS } from "./format";
import type { MonthlyReportData } from "../types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportReportPdf(report: MonthlyReportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  let y = margin;
  const label = `${MONTH_NAMES[report.month - 1]} ${report.year}`;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`Marketing & CRM Report — ${label}`, margin, y);
  y += 10;

  doc.setFontSize(12);
  doc.text("Executive Summary", margin, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Total Visits", String(report.summary.totalVisits)],
      ["Verified Visits", String(report.summary.verifiedVisits)],
      ["New Leads", String(report.summary.newLeads)],
      ["Hot Leads", String(report.summary.hotLeads)],
      ["Quotations Requested", String(report.summary.quotationsRequested)],
      ["Deals Won", String(report.summary.dealsWon)],
      ["Revenue Generated", formatTZS(report.summary.revenueGenerated)],
      ["Conversion Rate", `${report.summary.conversionRate}%`],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text("Pipeline Movement", margin, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Stage", "Companies"]],
    body: [
      ...report.pipelineMovement.map((row) => [getStageMeta(row.stage).label, String(row.movedIn)]),
      ["Lost", String(report.lostThisMonth)],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text("Team Performance", margin, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Marketer", "Visits", "Verified", "Leads", "Quotes", "Deals", "Revenue", "Avg Score", "Follow-up Rate"]],
    body: report.teamPerformance.map((row) => [
      row.marketerName, String(row.totalVisits), String(row.verifiedVisits), String(row.newLeads),
      String(row.quotationsRequested), String(row.dealsWon), formatTZS(row.revenueGenerated),
      String(row.avgLeadScore), `${row.followUpRate}%`,
    ]),
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text("Top Companies", margin, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Company", "Industry", "Stage", "Score", "Est. Value"]],
    body: report.topCompanies.map((company) => [
      company.name, company.industry ?? "—", getStageMeta(company.pipeline_stage).label,
      String(company.lead_score), formatTZS(company.estimated_value),
    ]),
  });

  doc.save(`abbys_marketing_report_${report.year}_${String(report.month).padStart(2, "0")}.pdf`);
}

export async function exportReportExcel(report: MonthlyReportData) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet("Executive Summary");
  summarySheet.columns = [{ header: "Metric", key: "metric" }, { header: "Value", key: "value" }];
  summarySheet.addRows([
    { metric: "Total Visits", value: report.summary.totalVisits },
    { metric: "Verified Visits", value: report.summary.verifiedVisits },
    { metric: "New Leads", value: report.summary.newLeads },
    { metric: "Hot Leads", value: report.summary.hotLeads },
    { metric: "Quotations Requested", value: report.summary.quotationsRequested },
    { metric: "Deals Won", value: report.summary.dealsWon },
    { metric: "Revenue Generated (TZS)", value: report.summary.revenueGenerated },
    { metric: "Conversion Rate (%)", value: report.summary.conversionRate },
  ]);

  const movementSheet = workbook.addWorksheet("Pipeline Movement");
  movementSheet.columns = [{ header: "Stage", key: "stage" }, { header: "Companies", key: "count" }];
  report.pipelineMovement.forEach((row) => movementSheet.addRow({ stage: getStageMeta(row.stage).label, count: row.movedIn }));
  movementSheet.addRow({ stage: "Lost", count: report.lostThisMonth });

  const teamSheet = workbook.addWorksheet("Team Performance");
  teamSheet.columns = [
    { header: "Marketer", key: "marketer" }, { header: "Visits", key: "visits" }, { header: "Verified", key: "verified" },
    { header: "Leads", key: "leads" }, { header: "Quotations", key: "quotes" }, { header: "Deals", key: "deals" },
    { header: "Revenue (TZS)", key: "revenue" }, { header: "Avg Score", key: "score" }, { header: "Follow-up Rate (%)", key: "rate" },
  ];
  report.teamPerformance.forEach((row) => teamSheet.addRow({
    marketer: row.marketerName, visits: row.totalVisits, verified: row.verifiedVisits, leads: row.newLeads,
    quotes: row.quotationsRequested, deals: row.dealsWon, revenue: row.revenueGenerated, score: row.avgLeadScore, rate: row.followUpRate,
  }));

  const topSheet = workbook.addWorksheet("Top Companies");
  topSheet.columns = [
    { header: "Company", key: "name" }, { header: "Industry", key: "industry" }, { header: "Stage", key: "stage" },
    { header: "Score", key: "score" }, { header: "Estimated Value (TZS)", key: "value" },
  ];
  report.topCompanies.forEach((company) => topSheet.addRow({
    name: company.name, industry: company.industry ?? "", stage: getStageMeta(company.pipeline_stage).label,
    score: company.lead_score, value: company.estimated_value ?? 0,
  }));

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `abbys_marketing_report_${report.year}_${String(report.month).padStart(2, "0")}.xlsx`
  );
}
