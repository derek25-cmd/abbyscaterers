
"use client";

import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileText, Loader2, Download, ArrowLeft, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getPayrolls } from "@/services/payrollService";
import jsPDF from "jspdf";
import "jspdf-autotable";
import type { ProformaInvoice as Payroll } from "@/types";
import { format, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

export default function MonthlyPayrollReportPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  useMemo(async () => {
    setIsLoading(true);
    const data = await getPayrolls();
    setPayrolls(data);
    setIsLoading(false);
  }, []);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    payrolls.forEach(p => months.add(format(parseISO(p.payPeriodStart), 'yyyy-MM')));
    return Array.from(months).sort().reverse();
  }, [payrolls]);

  const monthlyPayrolls = useMemo(() => {
    return payrolls.filter(p => format(parseISO(p.payPeriodStart), 'yyyy-MM') === selectedMonth);
  }, [selectedMonth, payrolls]);

  const totalNetSalary = useMemo(() => {
    return monthlyPayrolls.reduce((sum, p) => sum + p.netSalary, 0);
  }, [monthlyPayrolls]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  const handlePdfExport = () => {
    setIsExporting(true);
    const doc = new jsPDF({ orientation: 'l' });
    doc.text(`Monthly Payroll Report - ${format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}`, 14, 15);
    (doc as any).autoTable({
        head: [['Employee', 'Gross Salary', 'Deductions', 'Net Salary', 'Status']],
        body: monthlyPayrolls.map(p => [p.employeeName, formatCurrency(p.grossSalary), formatCurrency(p.deductions), formatCurrency(p.netSalary), p.status]),
        startY: 25,
    });
    doc.save(`Monthly_Payroll_Report_${selectedMonth}.pdf`);
    toast({ title: "Export Successful", description: "Report exported to PDF." });
    setIsExporting(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Monthly Payroll Report</h1>
          <p className="text-muted-foreground">Review payroll summaries for a selected month.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Select onValueChange={setSelectedMonth} value={selectedMonth}>
              <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select a month" /></SelectTrigger>
              <SelectContent>{availableMonths.map(month => (<SelectItem key={month} value={month}>{format(parseISO(`${month}-01`), 'MMMM yyyy')}</SelectItem>))}</SelectContent>
          </Select>
          <Button onClick={handlePdfExport} variant="outline" size="sm" disabled={isExporting}>
             {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
             {isExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
          <Button asChild variant="outline" size="sm"><Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link></Button>
        </div>
      </div>
      
      <Card>
        <CardHeader><CardTitle>Payroll for: {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}</CardTitle></CardHeader>
        <CardContent>
           <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead className="text-right">Gross Salary</TableHead><TableHead className="text-right">Deductions</TableHead><TableHead className="text-right">Net Salary</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
              ) : monthlyPayrolls.length > 0 ? monthlyPayrolls.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.employeeName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.grossSalary)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.deductions)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(p.netSalary)}</TableCell>
                    <TableCell>{p.status}</TableCell>
                  </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="text-center h-24">No payrolls found for this month.</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-bold text-lg">Total Net Payroll</TableCell>
                <TableCell className="text-right font-bold text-lg text-primary">{formatCurrency(totalNetSalary)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
