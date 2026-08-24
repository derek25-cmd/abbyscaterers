"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Loader2,
  Search,
  Download,
  AlertTriangle,
  Repeat,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientStorage } from "@/hooks/use-client-storage";
import { useToast } from "@/hooks/use-toast";
import {
  format,
  parseISO,
  eachDayOfInterval,
  differenceInDays,
  addDays,
  isValid,
} from "date-fns";
import { getMenusByClientAndRange } from "@/services/dailyMenuService";
import type { DailyMenu, Client } from "@/types";
import jsPDF from "jspdf";
import "jspdf-autotable";
import type { DateRange } from "react-day-picker";

// ─── Types ────────────────────────────────────────────────────────────
interface DishOccurrence {
  date: string;
  mealSection: "Breakfast" | "Lunch";
}

interface DishFrequency {
  name: string;
  count: number;
  occurrences: DishOccurrence[];
  isConsecutive: boolean;
  consecutiveRuns: number;
}

interface DayMenuData {
  date: string;
  breakfastItems: string[];
  lunchItems: string[];
}

// ─── Props ────────────────────────────────────────────────────────────
interface ConsistencyCheckerDialogProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────
const BREAKFAST_ROW_START = 0; // row indices 0..10  (row 0 is header "Breakfast")
const LUNCH_ROW_START = 11;   // row indices 11..26 (row 11 is header "Lunch")

function classifyRow(rowIndex: number): "Breakfast" | "Lunch" | null {
  if (rowIndex > BREAKFAST_ROW_START && rowIndex < LUNCH_ROW_START) return "Breakfast";
  if (rowIndex > LUNCH_ROW_START) return "Lunch";
  return null; // header rows
}

function buildDayMenus(menus: DailyMenu[]): DayMenuData[] {
  const grouped = new Map<string, { breakfast: Set<string>; lunch: Set<string> }>();

  menus.forEach((menu) => {
    const dateStr = menu.menu_date;
    if (!grouped.has(dateStr)) {
      grouped.set(dateStr, { breakfast: new Set(), lunch: new Set() });
    }
    const day = grouped.get(dateStr)!;

    menu.recipes.forEach((r) => {
      if (!r.name || r.name.trim() === "") return;
      const section = classifyRow(r.rowIndex);
      if (section === "Breakfast") day.breakfast.add(r.name);
      if (section === "Lunch") day.lunch.add(r.name);
    });
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      breakfastItems: Array.from(data.breakfast),
      lunchItems: Array.from(data.lunch),
    }));
}

function buildFrequencyMap(dayMenus: DayMenuData[]): DishFrequency[] {
  const freqMap = new Map<string, DishOccurrence[]>();

  dayMenus.forEach((day) => {
    day.breakfastItems.forEach((item) => {
      if (!freqMap.has(item)) freqMap.set(item, []);
      freqMap.get(item)!.push({ date: day.date, mealSection: "Breakfast" });
    });
    day.lunchItems.forEach((item) => {
      if (!freqMap.has(item)) freqMap.set(item, []);
      freqMap.get(item)!.push({ date: day.date, mealSection: "Lunch" });
    });
  });

  const results: DishFrequency[] = [];

  freqMap.forEach((occurrences, name) => {
    // Check for consecutive days
    const sortedDates = [...new Set(occurrences.map((o) => o.date))].sort();
    let consecutiveRuns = 0;
    let isConsecutive = false;

    for (let i = 1; i < sortedDates.length; i++) {
      const prev = parseISO(sortedDates[i - 1]);
      const curr = parseISO(sortedDates[i]);
      if (differenceInDays(curr, prev) === 1) {
        consecutiveRuns++;
        isConsecutive = true;
      }
    }

    results.push({
      name,
      count: occurrences.length,
      occurrences,
      isConsecutive,
      consecutiveRuns,
    });
  });

  return results.sort((a, b) => b.count - a.count);
}

function getFrequencyBadge(count: number, isConsecutive: boolean) {
  if (isConsecutive) {
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
        <Repeat className="w-3 h-3 mr-1" />
        Consecutive
      </Badge>
    );
  }
  if (count >= 3) {
    return (
      <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 hover:bg-amber-600">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Frequent ({count}×)
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
      {count}×
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────────────
export function ConsistencyCheckerDialog({
  isOpen,
  setIsOpen,
}: ConsistencyCheckerDialogProps) {
  const { clients, isLoading: clientsLoading } = useClientStorage();
  const { toast } = useToast();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [menus, setMenus] = useState<DailyMenu[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  const dayMenus = useMemo(() => buildDayMenus(menus), [menus]);
  const frequencies = useMemo(() => buildFrequencyMap(dayMenus), [dayMenus]);

  const flaggedItems = useMemo(
    () => frequencies.filter((f) => f.isConsecutive || f.count >= 3),
    [frequencies]
  );

  const handleAnalyze = useCallback(async () => {
    if (!selectedClientId || !dateRange?.from || !dateRange?.to) {
      toast({
        variant: "destructive",
        title: "Missing Info",
        description: "Please select a client and a date range.",
      });
      return;
    }

    setIsAnalyzing(true);
    setHasAnalyzed(false);
    try {
      const startStr = format(dateRange.from, "yyyy-MM-dd");
      const endStr = format(dateRange.to, "yyyy-MM-dd");
      const data = await getMenusByClientAndRange(
        selectedClientId,
        startStr,
        endStr
      );
      setMenus(data);
      setHasAnalyzed(true);

      if (data.length === 0) {
        toast({
          title: "No Data",
          description:
            "No saved daily menus found for this client in the selected period.",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch menu data.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedClientId, dateRange, toast]);

  // ─── PDF Export ─────────────────────────────────────────────────────
  const handleExportPdf = useCallback(() => {
    if (dayMenus.length === 0) return;
    setIsExporting(true);

    try {
      const doc = new jsPDF({ orientation: "landscape" });
      const clientName = selectedClient?.companyName || "Client";
      const rangeLabel = dateRange?.from && dateRange?.to
        ? `${format(dateRange.from, "dd MMM yyyy")} – ${format(dateRange.to, "dd MMM yyyy")}`
        : "";

      // ── Title page ──
      doc.setFontSize(28);
      doc.setTextColor(20, 20, 20);
      doc.text("Menu Consistency Report", 148, 60, { align: "center" });

      doc.setFontSize(18);
      doc.setTextColor(80, 80, 80);
      doc.text(clientName, 148, 80, { align: "center" });

      doc.setFontSize(12);
      doc.setTextColor(120, 120, 120);
      doc.text(rangeLabel, 148, 94, { align: "center" });

      // Summary stats
      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      const totalDays = dayMenus.length;
      const totalUniqueDishes = frequencies.length;
      const flaggedCount = flaggedItems.length;

      const statsY = 120;
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(40, statsY - 10, 216, 40, 4, 4, "FD");

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("DAYS COVERED", 70, statsY + 2, { align: "center" });
      doc.text("UNIQUE DISHES", 148, statsY + 2, { align: "center" });
      doc.text("FLAGGED ITEMS", 226, statsY + 2, { align: "center" });

      doc.setFontSize(20);
      doc.setTextColor(30, 30, 30);
      doc.text(String(totalDays), 70, statsY + 20, { align: "center" });
      doc.text(String(totalUniqueDishes), 148, statsY + 20, { align: "center" });

      if (flaggedCount > 0) {
        doc.setTextColor(220, 38, 38);
      }
      doc.text(String(flaggedCount), 226, statsY + 20, { align: "center" });
      doc.setTextColor(30, 30, 30);

      // ── Page 2+: Daily Menu History ──
      doc.addPage();

      // Title
      doc.setFontSize(16);
      doc.setTextColor(30, 30, 30);
      doc.text("Daily Menu History", 14, 16);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`${clientName} • ${rangeLabel}`, 14, 23);

      // Build the table rows
      const tableBody = dayMenus.map((day) => {
        const dateLabel = isValid(parseISO(day.date))
          ? format(parseISO(day.date), "EEE, dd MMM yyyy")
          : day.date;
        return [
          dateLabel,
          day.breakfastItems.length > 0
            ? day.breakfastItems.join("\n")
            : "—",
          day.lunchItems.length > 0
            ? day.lunchItems.join("\n")
            : "—",
        ];
      });

      (doc as any).autoTable({
        head: [["Date", "Breakfast Items", "Lunch Items"]],
        body: tableBody,
        startY: 28,
        theme: "grid",
        margin: { left: 14, right: 14 },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: "bold",
          halign: "center",
        },
        styles: {
          fontSize: 9,
          cellPadding: 4,
          overflow: "linebreak",
          valign: "top",
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: "bold", halign: "left" },
          1: { cellWidth: "auto" },
          2: { cellWidth: "auto" },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: function (data: any) {
          if (data.section === "body" && data.column.index > 0) {
            // Highlight items that appear in flaggedItems
            const cellText = data.cell.raw as string;
            if (cellText && cellText !== "—") {
              const items = cellText.split("\n");
              const hasFlagged = items.some((item: string) =>
                flaggedItems.some((f) => f.name === item)
              );
              if (hasFlagged) {
                data.cell.styles.textColor = [185, 28, 28];
                data.cell.styles.fontStyle = "bold";
              }
            }
          }
        },
      });

      // ── Frequency Analysis page ──
      if (frequencies.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(30, 30, 30);
        doc.text("Dish Frequency Analysis", 14, 16);
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(
          "Items sorted by frequency. Flagged items are highlighted in red.",
          14,
          23
        );

        const freqBody = frequencies.map((f) => {
          const status = f.isConsecutive
            ? "⚠ CONSECUTIVE"
            : f.count >= 3
            ? "⚡ FREQUENT"
            : "OK";
          const dates = [
            ...new Set(f.occurrences.map((o) => {
              const d = parseISO(o.date);
              return isValid(d) ? format(d, "dd/MM") : o.date;
            })),
          ].join(", ");
          return [f.name, String(f.count), status, dates];
        });

        (doc as any).autoTable({
          head: [["Dish Name", "Count", "Status", "Dates Served"]],
          body: freqBody,
          startY: 28,
          theme: "grid",
          margin: { left: 14, right: 14 },
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: "bold",
            halign: "center",
          },
          styles: {
            fontSize: 9,
            cellPadding: 3,
            overflow: "linebreak",
            valign: "middle",
          },
          columnStyles: {
            0: { cellWidth: 70, fontStyle: "bold" },
            1: { cellWidth: 20, halign: "center" },
            2: { cellWidth: 35, halign: "center" },
            3: { cellWidth: "auto", fontSize: 8 },
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          didParseCell: function (data: any) {
            if (data.section === "body" && data.column.index === 2) {
              const val = data.cell.raw as string;
              if (val.includes("CONSECUTIVE")) {
                data.cell.styles.textColor = [185, 28, 28];
                data.cell.styles.fontStyle = "bold";
              } else if (val.includes("FREQUENT")) {
                data.cell.styles.textColor = [180, 83, 9];
                data.cell.styles.fontStyle = "bold";
              }
            }
          },
        });
      }

      // ── Save ──
      const safeClientName = clientName.replace(/[^a-zA-Z0-9]/g, "_");
      doc.save(
        `Menu_Consistency_${safeClientName}_${format(dateRange!.from!, "yyyyMMdd")}_${format(dateRange!.to!, "yyyyMMdd")}.pdf`
      );

      toast({
        title: "Exported",
        description: "Menu Consistency Report exported as PDF.",
      });
    } catch (err) {
      console.error("PDF Export Error:", err);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "An error occurred generating the PDF.",
      });
    } finally {
      setIsExporting(false);
    }
  }, [dayMenus, frequencies, flaggedItems, selectedClient, dateRange, toast]);

  // ─── Reset when dialog closes ──────────────────────────────────────
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedClientId(null);
      setDateRange(undefined);
      setMenus([]);
      setHasAnalyzed(false);
    }
    setIsOpen(open);
  };

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-primary" />
            Menu Consistency Checker
          </DialogTitle>
          <DialogDescription>
            Analyze the menus served to a client over a period to identify
            repetitions and improve menu diversity.
          </DialogDescription>
        </DialogHeader>

        {/* ── Controls ── */}
        <div className="flex flex-wrap items-end gap-3 pb-4 border-b shrink-0">
          {/* Client Selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
              Client
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between h-9",
                    !selectedClientId && "text-muted-foreground"
                  )}
                  disabled={clientsLoading}
                >
                  {clientsLoading
                    ? "Loading..."
                    : selectedClient?.companyName || "Select client..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search clients..." />
                  <CommandList>
                    <CommandEmpty>No clients found.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.companyName}
                          onSelect={() => setSelectedClientId(c.id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              c.id === selectedClientId
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {c.companyName}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Date Range */}
          <div className="min-w-[220px]">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
              Date Range
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-9 justify-start text-left font-normal",
                    !dateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd MMM")} –{" "}
                        {format(dateRange.to, "dd MMM yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd MMM yyyy")
                    )
                  ) : (
                    "Pick a date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Actions */}
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !selectedClientId || !dateRange?.from || !dateRange?.to}
            className="h-9"
          >
            {isAnalyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Analyze
          </Button>

          {hasAnalyzed && dayMenus.length > 0 && (
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="h-9"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export PDF
            </Button>
          )}
        </div>

        {/* ── Results ── */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 220px)' }}>
          {!hasAnalyzed ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-5 bg-primary/5 rounded-full mb-4">
                <Utensils className="h-10 w-10 text-primary opacity-40" />
              </div>
              <h3 className="text-lg font-semibold mb-1">
                Select a Client & Period
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Choose a client and date range above, then click{" "}
                <strong>Analyze</strong> to see all menus served during that
                period.
              </p>
            </div>
          ) : dayMenus.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="h-10 w-10 mb-4 text-amber-500 opacity-60" />
              <h3 className="text-lg font-semibold mb-1">No Menus Found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                No saved daily menus exist for{" "}
                <strong>{selectedClient?.companyName}</strong> in the selected
                period. Ensure menus have been saved in the Daily Menu Planner.
              </p>
            </div>
          ) : (
            <div className="space-y-6 pr-2">
              {/* ── Flagged Summary ── */}
              {flaggedItems.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Repetition Alerts ({flaggedItems.length} items)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="flex flex-wrap gap-2">
                      {flaggedItems.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center gap-1.5 bg-white dark:bg-background rounded-md border px-2.5 py-1.5 shadow-sm"
                        >
                          <span className="text-xs font-medium">
                            {item.name}
                          </span>
                          {getFrequencyBadge(item.count, item.isConsecutive)}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {flaggedItems.length === 0 && (
                <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
                  <CardContent className="py-4 px-4 flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                      <Check className="h-4 w-4 text-green-700 dark:text-green-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">
                        Good Variety!
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        No concerning repetitions detected in this period.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Daily Menu History ── */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Daily Menu History ({dayMenus.length} days)
                </h3>

                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-3 text-left font-semibold text-xs uppercase tracking-wider w-[130px]">
                          Date
                        </th>
                        <th className="p-3 text-left font-semibold text-xs uppercase tracking-wider border-l">
                          🍳 Breakfast
                        </th>
                        <th className="p-3 text-left font-semibold text-xs uppercase tracking-wider border-l">
                          🍽️ Lunch
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayMenus.map((day, i) => {
                        const dateLabel = isValid(parseISO(day.date))
                          ? format(parseISO(day.date), "EEE, dd MMM")
                          : day.date;
                        return (
                          <tr
                            key={day.date}
                            className={cn(
                              "border-b hover:bg-muted/20 transition-colors",
                              i % 2 === 1 && "bg-muted/5"
                            )}
                          >
                            <td className="p-3 font-medium text-xs whitespace-nowrap">
                              {dateLabel}
                            </td>
                            <td className="p-3 border-l">
                              {day.breakfastItems.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {day.breakfastItems.map((item) => {
                                    const freq = frequencies.find(
                                      (f) => f.name === item
                                    );
                                    const isFlagged =
                                      freq &&
                                      (freq.isConsecutive || freq.count >= 3);
                                    return (
                                      <span
                                        key={item}
                                        className={cn(
                                          "inline-block text-xs px-2 py-0.5 rounded-full border",
                                          isFlagged
                                            ? "bg-red-50 border-red-200 text-red-700 font-semibold dark:bg-red-950 dark:border-red-800 dark:text-red-300"
                                            : "bg-background border-border"
                                        )}
                                      >
                                        {item}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  No breakfast
                                </span>
                              )}
                            </td>
                            <td className="p-3 border-l">
                              {day.lunchItems.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {day.lunchItems.map((item) => {
                                    const freq = frequencies.find(
                                      (f) => f.name === item
                                    );
                                    const isFlagged =
                                      freq &&
                                      (freq.isConsecutive || freq.count >= 3);
                                    return (
                                      <span
                                        key={item}
                                        className={cn(
                                          "inline-block text-xs px-2 py-0.5 rounded-full border",
                                          isFlagged
                                            ? "bg-red-50 border-red-200 text-red-700 font-semibold dark:bg-red-950 dark:border-red-800 dark:text-red-300"
                                            : "bg-background border-border"
                                        )}
                                      >
                                        {item}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  No lunch
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Frequency Table ── */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Dish Frequency ({frequencies.length} unique dishes)
                </h3>

                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-3 text-left font-semibold text-xs uppercase tracking-wider">
                          Dish
                        </th>
                        <th className="p-3 text-center font-semibold text-xs uppercase tracking-wider w-[60px]">
                          Count
                        </th>
                        <th className="p-3 text-center font-semibold text-xs uppercase tracking-wider w-[120px]">
                          Status
                        </th>
                        <th className="p-3 text-left font-semibold text-xs uppercase tracking-wider border-l">
                          Dates
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {frequencies.map((f, i) => (
                        <tr
                          key={f.name}
                          className={cn(
                            "border-b hover:bg-muted/20 transition-colors",
                            i % 2 === 1 && "bg-muted/5"
                          )}
                        >
                          <td className="p-3 font-medium text-xs">
                            {f.name}
                          </td>
                          <td className="p-3 text-center font-bold text-xs">
                            {f.count}
                          </td>
                          <td className="p-3 text-center">
                            {getFrequencyBadge(f.count, f.isConsecutive)}
                          </td>
                          <td className="p-3 border-l">
                            <div className="flex flex-wrap gap-1">
                              {[
                                ...new Set(
                                  f.occurrences.map((o) => o.date)
                                ),
                              ].map((d) => (
                                <span
                                  key={d}
                                  className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono"
                                >
                                  {isValid(parseISO(d))
                                    ? format(parseISO(d), "dd/MM")
                                    : d}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
