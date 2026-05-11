"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, ArrowLeft, DollarSign, FileCheck, FileClock, Download, CalendarIcon, ChevronsUpDown, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProformaInvoiceStorage } from "@/hooks/use-proforma-invoice-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import jsPDF from "jspdf";
import "jspdf-autotable";
import type { ProformaInvoice } from "@/types";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isAfter, isBefore, isSameDay } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const calculateTotal = (inv: ProformaInvoice): number => {
    const subtotal = inv.items?.reduce((sum, item) => sum + (item.total || 0), 0) ?? 0;
    const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
    const totalBeforeVat = totalForDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);
    const vat = inv.vatType === "exclusive" ? totalBeforeVat * 0.18 : 0;
    return totalBeforeVat + vat;
};

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

export default function MonthlyProformaReportPage() {
    const { toast } = useToast();
    const { proformaInvoices, isLoading: proformasLoading } = useProformaInvoiceStorage();
    const { clients, isLoading: clientsLoading } = useClientStorage();
    const { getInvoiceByProformaId, isLoading: invoicesLoading } = useInvoiceStorage();
    const [isExporting, setIsExporting] = useState(false);

    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<"all" | "invoiced" | "pending">("all");
    const [clientPopoverOpen, setClientPopoverOpen] = useState(false);

    const filtered = useMemo(() => {
        let result: ProformaInvoice[] = proformaInvoices;

        if (dateRange?.from) {
            result = result.filter(pi => {
                if (!pi.invoiceDate) return false;
                const d = startOfDay(parseISO(pi.invoiceDate));
                if (dateRange.to) {
                    return isWithinInterval(d, { start: startOfDay(dateRange.from!), end: endOfDay(dateRange.to) });
                }
                return isAfter(d, startOfDay(dateRange.from!)) || isSameDay(d, dateRange.from!);
            });
        } else if (dateRange?.to) {
            result = result.filter(pi => {
                if (!pi.invoiceDate) return false;
                const d = startOfDay(parseISO(pi.invoiceDate));
                return isBefore(d, endOfDay(dateRange.to!)) || isSameDay(d, dateRange.to!);
            });
        }

        if (selectedClientIds.length > 0) {
            const set = new Set(selectedClientIds);
            result = result.filter(pi => pi.clientId && set.has(pi.clientId));
        }

        if (statusFilter === "invoiced") result = result.filter(pi => !!pi.isInvoiced);
        if (statusFilter === "pending") result = result.filter(pi => !pi.isInvoiced);

        return result;
    }, [proformaInvoices, dateRange, selectedClientIds, statusFilter]);

    const summary = useMemo(() => {
        const total = filtered.reduce((s, pi) => s + calculateTotal(pi), 0);
        const invoiced = filtered.filter(pi => pi.isInvoiced).length;
        const pending = filtered.filter(pi => !pi.isInvoiced).length;
        return { total, count: filtered.length, invoiced, pending };
    }, [filtered]);

    const dateRangeLabel = () => {
        if (dateRange?.from && dateRange?.to)
            return `${format(dateRange.from, "dd MMM yyyy")} – ${format(dateRange.to, "dd MMM yyyy")}`;
        if (dateRange?.from) return `From ${format(dateRange.from, "dd MMM yyyy")}`;
        if (dateRange?.to) return `Until ${format(dateRange.to, "dd MMM yyyy")}`;
        return "All Dates";
    };

    const handlePdfExport = () => {
        setIsExporting(true);
        try {
            const doc = new jsPDF({ orientation: "landscape" });
            doc.setFontSize(14);
            doc.text("Proforma Invoice Report", 14, 14);
            doc.setFontSize(9);
            doc.text(dateRangeLabel(), 14, 21);

            const rows = filtered.map((pi, i) => {
                const client = clients.find(c => c.id === pi.clientId);
                const linkedInvoice = getInvoiceByProformaId(pi.id);
                return [
                    i + 1,
                    client?.companyName || "N/A",
                    pi.id,
                    linkedInvoice?.id || "—",
                    pi.invoiceDate ? format(parseISO(pi.invoiceDate), "dd/MM/yyyy") : "N/A",
                    `${pi.startDate ? format(parseISO(pi.startDate), "dd/MM/yyyy") : "?"} – ${pi.endDate ? format(parseISO(pi.endDate), "dd/MM/yyyy") : "?"}`,
                    pi.isInvoiced ? "Invoiced" : "Pending",
                    formatCurrency(calculateTotal(pi)),
                ];
            });

            (doc as any).autoTable({
                theme: "grid",
                head: [["S/N", "Client", "Proforma No.", "Invoice No.", "Date", "Service Period", "Status", "Total (TZS)"]],
                body: rows,
                startY: 26,
                columnStyles: { 7: { halign: "right" } },
                foot: [["", "", "", "", "", "", "GRAND TOTAL (TZS)", formatCurrency(summary.total)]],
                footStyles: { fontStyle: "bold", halign: "right" },
            });

            doc.save(`Proforma_Invoice_Report_${format(new Date(), "yyyy-MM-dd")}.pdf`);
            toast({ title: "Export Successful", description: "Report exported to PDF." });
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Export Failed", description: "Could not generate PDF." });
        } finally {
            setIsExporting(false);
        }
    };

    const handleCsvExport = () => {
        const headers = ["S/N", "Client", "Proforma No.", "Invoice No.", "Invoice Date", "Service Period", "Status", "Total (TZS)"];
        const rows = filtered.map((pi, i) => {
            const client = clients.find(c => c.id === pi.clientId);
            const linkedInvoice = getInvoiceByProformaId(pi.id);
            return [
                i + 1,
                `"${(client?.companyName || "N/A").replace(/"/g, '""')}"`,
                pi.id,
                linkedInvoice?.id || "",
                pi.invoiceDate ? format(parseISO(pi.invoiceDate), "dd/MM/yyyy") : "N/A",
                `"${pi.startDate ? format(parseISO(pi.startDate), "dd/MM/yyyy") : "?"} – ${pi.endDate ? format(parseISO(pi.endDate), "dd/MM/yyyy") : "?"}"`,
                pi.isInvoiced ? "Invoiced" : "Pending",
                calculateTotal(pi).toFixed(2),
            ].join(",");
        });
        rows.push(["", "", "", "", "", "", "GRAND TOTAL", formatCurrency(summary.total)].join(","));

        const blob = new Blob([[headers.join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Proforma_Invoice_Report_${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Export Successful", description: "Report exported to CSV." });
    };

    const isLoading = proformasLoading || clientsLoading || invoicesLoading;

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Proforma Invoice Report</h1>
                    <p className="text-muted-foreground">List and export proforma invoices for a selected period.</p>
                </div>
                <Button asChild variant="outline" size="sm">
                    <Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link>
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Value (TZS)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{formatCurrency(summary.total)}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Proformas</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{summary.count}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Invoiced</CardTitle>
                        <FileCheck className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">{summary.invoiced}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Invoicing</CardTitle>
                        <FileClock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold text-orange-600">{summary.pending}</div></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Proformas — {dateRangeLabel()}</CardTitle>
                    <div className="flex items-center gap-2 pt-4 flex-wrap">
                        {/* Client multi-select */}
                        <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full md:w-[220px] justify-between">
                                    {selectedClientIds.length > 0 ? `${selectedClientIds.length} client(s)` : "All Clients"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[280px] p-0">
                                <Command>
                                    <CommandInput placeholder="Search client..." />
                                    <CommandList>
                                        <CommandEmpty>No clients found.</CommandEmpty>
                                        <CommandGroup>
                                            {clients.map(client => (
                                                <CommandItem
                                                    key={client.id}
                                                    value={client.companyName}
                                                    onSelect={() =>
                                                        setSelectedClientIds(prev =>
                                                            prev.includes(client.id)
                                                                ? prev.filter(id => id !== client.id)
                                                                : [...prev, client.id]
                                                        )
                                                    }
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", selectedClientIds.includes(client.id) ? "opacity-100" : "opacity-0")} />
                                                    {client.companyName}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        {/* Status filter */}
                        <Select onValueChange={(v: "all" | "invoiced" | "pending") => setStatusFilter(v)} value={statusFilter}>
                            <SelectTrigger className="w-full md:w-[160px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="invoiced">Invoiced</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Date range picker */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full md:w-[280px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from
                                        ? dateRange.to
                                            ? <>{format(dateRange.from, "LLL dd, y")} – {format(dateRange.to, "LLL dd, y")}</>
                                            : format(dateRange.from, "LLL dd, y")
                                        : "Pick a date range"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                            </PopoverContent>
                        </Popover>

                        {dateRange && (
                            <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)} className="text-muted-foreground">
                                <X className="h-4 w-4 mr-1" /> Clear dates
                            </Button>
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                            <Button onClick={handleCsvExport} variant="outline" size="sm" disabled={isExporting || filtered.length === 0}>
                                <Download className="mr-2 h-4 w-4" />CSV
                            </Button>
                            <Button onClick={handlePdfExport} variant="outline" size="sm" disabled={isExporting || filtered.length === 0}>
                                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                {isExporting ? "Exporting..." : "PDF"}
                            </Button>
                        </div>
                    </div>

                    {/* Active client badges */}
                    {selectedClientIds.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                            {selectedClientIds.map(id => {
                                const client = clients.find(c => c.id === id);
                                return (
                                    <Badge key={id} variant="secondary" className="pl-2">
                                        {client?.companyName}
                                        <button
                                            onClick={() => setSelectedClientIds(prev => prev.filter(cid => cid !== id))}
                                            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                );
                            })}
                        </div>
                    )}
                </CardHeader>

                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">S/N</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Proforma No.</TableHead>
                                <TableHead>Invoice No.</TableHead>
                                <TableHead>Invoice Date</TableHead>
                                <TableHead>Service Period</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Total (TZS)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                            ) : filtered.length > 0 ? filtered.map((pi, i) => {
                                const client = clients.find(c => c.id === pi.clientId);
                                const linkedInvoice = getInvoiceByProformaId(pi.id);
                                return (
                                    <TableRow key={pi.id}>
                                        <TableCell>{i + 1}</TableCell>
                                        <TableCell className="font-medium">{client?.companyName || "N/A"}</TableCell>
                                        <TableCell className="font-mono text-xs">{pi.id}</TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {linkedInvoice?.id
                                                ? <span className="text-primary">{linkedInvoice.id}</span>
                                                : <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell>{pi.invoiceDate ? format(parseISO(pi.invoiceDate), "dd/MM/yyyy") : "N/A"}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {pi.startDate ? format(parseISO(pi.startDate), "dd/MM/yyyy") : "?"} – {pi.endDate ? format(parseISO(pi.endDate), "dd/MM/yyyy") : "?"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={pi.isInvoiced ? "default" : "outline"} className="text-[10px]">
                                                {pi.isInvoiced ? "Invoiced" : "Pending"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(calculateTotal(pi))}</TableCell>
                                    </TableRow>
                                );
                            }) : (
                                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No proforma invoices found for the selected criteria.</TableCell></TableRow>
                            )}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={7} className="text-right font-bold text-lg">Grand Total (TZS)</TableCell>
                                <TableCell className="text-right font-bold text-lg text-primary">{formatCurrency(summary.total)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
