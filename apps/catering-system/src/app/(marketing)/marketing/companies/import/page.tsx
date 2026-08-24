"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Download, FileSpreadsheet, Loader2, Upload, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useImportCompanies } from "@/features/marketing/hooks/useMarketingQuery";

const TEMPLATE_COLUMNS = [
  "Company Name", "Industry", "Business Size", "Employee Count", "Address", "Region",
  "Contact Name", "Contact Position", "Contact Phone", "Contact Email", "Current Caterer", "Estimated Value",
];

const TEMPLATE_EXAMPLE = [
  "Serengeti Bank Ltd", "Banking", "LARGE", "250", "Plot 12, Samora Avenue", "Dar es Salaam",
  "Jane Mwakasege", "Procurement Manager", "0712345678", "jane@serengetibank.co.tz", "Other Caterer Co.", "5000000",
];

interface PreviewRow {
  companyName: string;
}

export default function CompanyImportPage() {
  const { toast } = useToast();
  const importCompanies = useImportCompanies();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [parseError, setParseError] = useState("");

  const handleDownloadTemplate = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Companies");
    sheet.addRow(TEMPLATE_COLUMNS);
    sheet.addRow(TEMPLATE_EXAMPLE);
    const buffer = await workbook.csv.writeBuffer();
    const blob = new Blob([buffer], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "abbys_companies_import_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (selected: File) => {
    setFile(selected);
    setParsing(true);
    setParseError("");
    setPreviewRows([]);
    setTotalRows(0);
    importCompanies.reset();

    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const buffer = await selected.arrayBuffer();
      const isCsv = selected.name.toLowerCase().endsWith(".csv");

      if (isCsv) {
        const text = new TextDecoder().decode(buffer);
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) throw new Error("File has no data rows");
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const nameIndex = headers.indexOf("company name");
        const dataLines = lines.slice(1);
        setTotalRows(dataLines.length);
        setPreviewRows(
          dataLines.slice(0, 8).map((line) => ({
            companyName: nameIndex >= 0 ? (line.split(",")[nameIndex] ?? "").trim() : "(unknown)",
          }))
        );
      } else {
        await workbook.xlsx.load(buffer);
        const sheet = workbook.worksheets[0];
        if (!sheet || sheet.rowCount < 2) throw new Error("File has no data rows");
        const headerRow = sheet.getRow(1);
        let nameCol = -1;
        headerRow.eachCell((cell, colNumber) => {
          if (String(cell.value ?? "").trim().toLowerCase() === "company name") nameCol = colNumber;
        });
        const rows: PreviewRow[] = [];
        const dataRowCount = sheet.rowCount - 1;
        for (let r = 2; r <= Math.min(sheet.rowCount, 9); r++) {
          const cellValue = nameCol >= 0 ? sheet.getRow(r).getCell(nameCol).value : "(unknown)";
          rows.push({ companyName: String(cellValue ?? "(unknown)") });
        }
        setTotalRows(dataRowCount);
        setPreviewRows(rows);
      }
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Could not read file");
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!file) return;
    try {
      const response = await importCompanies.mutateAsync(file);
      toast({ title: "Import complete", description: `${response.data.imported} companies imported.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Import failed", description: error instanceof Error ? error.message : "Please try again." });
    }
  };

  const result = importCompanies.data?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/marketing/companies" className="hover:text-foreground">Companies</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">Import</span>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Import Companies from CSV</h2>
        <p className="text-sm text-muted-foreground">Bulk-add prospects from a spreadsheet. Maximum 1000 rows, 5MB file size.</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">1. Download the template</CardTitle></CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Download CSV Template
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Required column: Company Name. Optional: {TEMPLATE_COLUMNS.slice(1).join(", ")}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">2. Upload your file</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-center hover:border-muted-foreground/50">
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">{file ? file.name : "Choose a CSV or XLSX file"}</span>
            <span className="text-xs text-muted-foreground">Click to browse</span>
            <input
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
          </label>

          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading file...
            </div>
          )}

          {parseError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> {parseError}
            </div>
          )}

          {!parsing && !parseError && previewRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm">
                Found <span className="font-semibold">{totalRows}</span> row{totalRows === 1 ? "" : "s"}. Preview of first {previewRows.length}:
              </p>
              <ul className="rounded-md border text-sm">
                {previewRows.map((row, i) => (
                  <li key={i} className={`px-3 py-1.5 ${i > 0 ? "border-t" : ""}`}>{row.companyName || "(blank — will be skipped)"}</li>
                ))}
              </ul>
              <Button onClick={handleConfirmImport} disabled={importCompanies.isPending}>
                {importCompanies.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Import
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Import Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="secondary">Total rows: {result.totalRows}</Badge>
              <Badge className="bg-success/15 text-success">Imported: {result.imported}</Badge>
              <Badge variant="outline">Duplicates skipped: {result.duplicates}</Badge>
              <Badge variant="outline">Empty rows skipped: {result.skipped}</Badge>
              {result.warnings > 0 && <Badge className="bg-warning/15 text-warning">Warnings: {result.warnings}</Badge>}
            </div>

            {result.warningDetails.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Warnings</p>
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                  {result.warningDetails.map((w, i) => (
                    <li key={i}>Row {w.row} ({w.companyName}) — {w.field}: {w.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button asChild>
              <Link href="/marketing/companies">View Companies</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
