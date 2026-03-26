'use client';

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Save, Send, AlertTriangle, FileText, Download, Lock, Unlock, FileCheck, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO } from "date-fns";
import { addSupervisorReport, getSupervisorReportById, updateSupervisorReport } from "@/services/supervisorReportService";
import { getOrders } from "@/services/orderService";
import { getStockLogs } from "@/services/stockLogService";
import { getIssuances } from "@/services/issuanceService";
import { getMenusByDate } from "@/services/dailyMenuService";
import { getDeliveryNotes } from "@/services/deliveryNoteService";
import { supabase } from "@/lib/supabase-client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { SupervisorReport, ReportCriterion, ReportRating } from "@/types";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const CRITERIA_DESCRIPTIONS = [
  "All orders submitted to chef as ordered",
  "All recipes prepared accordingly",
  "All food tastes done and passed",
  "Kitchen time management",
  "Staff neatness & hygiene",
  "Equipment & materials cleanliness",
  "Delivery van condition",
  "Food packaging & transportation",
  "General delivery efficiency",
  "Timely delivery",
  "Site arrangements and settings",
  "Food served hot",
  "General services condition",
  "Customer feedback",
  "Return trip time management",
  "Delivery notes signed & returned",
  "Invoices prepared & submitted",
  "Kitchen & environment cleanliness",
  "Overall time management",
  "Next day plan completed",
  "Evening meeting conducted",
  "Reports prepared and filed"
];

const RATINGS: ReportRating[] = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

interface SupervisorReportFormProps {
  reportId?: string;
}

export function SupervisorReportForm({ reportId }: SupervisorReportFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(!!reportId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isBundleDialogOpen, setIsBundleDialogOpen] = useState(false);

  const [reportData, setReportData] = useState<Partial<SupervisorReport>>({
    report_date: format(new Date(), 'yyyy-MM-dd'),
    status: 'Draft',
    criteria: CRITERIA_DESCRIPTIONS.map(desc => ({
      description: desc,
      rating: 'Good' as ReportRating,
      isIssue: false,
      reason: ''
    })),
    prepared_by: user?.user_metadata?.name || user?.email || '',
    general_comments: '',
    checked_by: ''
  });

  // Bundle state
  const [availability, setAvailability] = useState({
    orders: false,
    stock: false,
    issuance: false,
    menu: false,
    proformas: false,
    invoices: false,
    deliveryNotes: false,
    costing: false
  });
  const [selectedAttachments, setSelectedAttachments] = useState({
    orders: true,
    stock: true,
    issuance: true,
    menu: true,
    proformas: true,
    invoices: true,
    deliveryNotes: true,
    costing: true
  });

  useEffect(() => {
    if (reportId) {
      const fetchReport = async () => {
        const data = await getSupervisorReportById(reportId);
        if (data) {
          setReportData(data);
          checkOtherReportsAvailability(data.report_date);
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Report not found.' });
          router.push('/reports/supervisor-daily');
        }
        setLoading(false);
      };
      fetchReport();
    }
  }, [reportId, toast, router]);

  const checkOtherReportsAvailability = async (date: string) => {
    const [ordersData, stockData, issuanceData, menusData, allDeliveryNotes, { data: allProformas }, { data: allInvoices }, { data: allCosting }] = await Promise.all([
      getOrders(),
      getStockLogs(),
      getIssuances(),
      getMenusByDate(date),
      getDeliveryNotes(),
      supabase.from('proforma_invoices').select('*'),
      supabase.from('invoices').select('*'),
      supabase.from('costing_reports').select('*')
    ]);

    const dateProformas = (allProformas || []).filter(p => p.invoiceDate === date || p.createdAt?.startsWith(date));
    const dateInvoices = (allInvoices || []).filter(i => i.invoiceDate === date || i.createdAt?.startsWith(date));
    const dateDeliveryNotes = allDeliveryNotes.filter(d => d.delivery_date?.startsWith(date));
    const dateCosting = (allCosting || []).filter(c => c.report_date === date || c.created_at?.startsWith(date));

    setAvailability({
      orders: ordersData.some(o => o.startDate <= date && o.endDate >= date),
      stock: stockData.some(l => l.date === date),
      issuance: issuanceData.some(i => i.date === date),
      menu: menusData.length > 0,
      proformas: dateProformas.length > 0,
      invoices: dateInvoices.length > 0,
      deliveryNotes: dateDeliveryNotes.length > 0,
      costing: dateCosting.length > 0
    });
  };

  const handleRatingChange = (index: number, rating: ReportRating) => {
    const newCriteria = [...(reportData.criteria || [])];
    newCriteria[index].rating = rating;
    setReportData(prev => ({ ...prev, criteria: newCriteria }));
  };

  const handleIssueToggle = (index: number, checked: boolean) => {
    const newCriteria = [...(reportData.criteria || [])];
    newCriteria[index].isIssue = checked;
    if (checked) {
      newCriteria[index].rating = null;
    } else {
      newCriteria[index].rating = 'Good';
      newCriteria[index].reason = '';
    }
    setReportData(prev => ({ ...prev, criteria: newCriteria }));
  };

  const handleReasonChange = (index: number, reason: string) => {
    const newCriteria = [...(reportData.criteria || [])];
    newCriteria[index].reason = reason;
    setReportData(prev => ({ ...prev, criteria: newCriteria }));
  };

  const validate = () => {
    const issues = (reportData.criteria || []).filter(c => c.isIssue && !c.reason?.trim());
    if (issues.length > 0) {
      toast({ variant: 'destructive', title: 'Action Required', description: 'Please provide a reason for all marked issues (X).' });
      return false;
    }
    return true;
  };

  const saveReport = async (status: 'Draft' | 'Submitted') => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        ...reportData,
        status,
        supervisor_id: user?.id,
        supervisor_name: user?.user_metadata?.name || user?.email || 'Supervisor',
        prepared_by: reportData.prepared_by || user?.user_metadata?.name || 'Supervisor'
      } as Omit<SupervisorReport, 'id' | 'created_at' | 'updated_at'>;

      if (reportId) {
        await updateSupervisorReport(reportId, payload);
        toast({ title: 'Success', description: `Report ${status === 'Submitted' ? 'submitted' : 'saved as draft'}.` });
      } else {
        const result = await addSupervisorReport(payload);
        if (result) {
          toast({ title: 'Success', description: 'Daily report created.' });
          if (status === 'Draft') router.push(`/reports/supervisor-daily/${result.id}`);
        }
      }

      if (status === 'Submitted') router.push('/reports/supervisor-daily');
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save report. Check connectivity or duplicates.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDFBundle = async () => {
    setIsExporting(true);
    setIsBundleDialogOpen(false);

    try {
      const doc = new jsPDF();
      const reportDate = reportData.report_date!;

      // PAGE 1: SUPERVISOR REPORT
      doc.setFontSize(10);
      doc.text("Abby's Legendary Caterers Limited", 105, 10, { align: "center" });
      doc.setFontSize(8);
      doc.text("Form Code: ALC-KIT-FRM-01", 105, 15, { align: "center" });
      doc.setFontSize(14);
      doc.text("Supervisor Daily Report", 105, 25, { align: "center" });

      doc.setFontSize(10);
      doc.text(`Date: ${format(parseISO(reportDate), 'PPP')}`, 14, 35);
      doc.text(`Supervisor: ${reportData.supervisor_name || user?.user_metadata?.name || 'N/A'}`, 14, 40);
      doc.text(`Status: ${reportData.status}`, 150, 35);

      const tableColumn = ["S/N", "Operational Criterion", "Rating / Issue", "Reason/Explanation"];
      const tableRows = (reportData.criteria || []).map((c, i) => [
        i + 1,
        c.description,
        c.isIssue ? "X (ISSUE)" : (c.rating || "N/A"),
        c.reason || ""
      ]);

      (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        theme: 'grid',
        headStyles: { fillColor: [128, 0, 32] },
        styles: { fontSize: 8 },
        columnStyles: { 2: { halign: 'center' }, 0: { cellWidth: 10 } },
        didParseCell: (data: any) => {
          if (data.cell.text[0].includes('X (ISSUE)')) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      let finalY = (doc as any).lastAutoTable.finalY;
      doc.text("General Comments:", 14, finalY + 10);
      doc.text(reportData.general_comments || "None", 14, finalY + 15, { maxWidth: 180 });
      doc.text(`Prepared By: ${reportData.prepared_by}`, 14, finalY + 30);
      doc.text(`Checked By: ${reportData.checked_by || '___________________'}`, 120, finalY + 30);

      // ATTACHMENTS
      if (selectedAttachments.orders && availability.orders) {
        const orders = await getOrders();
        const dailyEvents = orders.flatMap(order =>
          order.clientEvents
            .filter(e => e.date === reportDate)
            .map(e => ({ ...e, orderId: order.id, customer: order.name }))
        );

        if (dailyEvents.length > 0) {
          doc.addPage();
          doc.setFontSize(14);
          doc.text("Attachment: Daily Order Report", 105, 15, { align: "center" });
          (doc as any).autoTable({
            head: [['Order ID', 'Customer', 'Meal Type', 'Pax', 'Total']],
            body: dailyEvents.map(e => [e.orderId, e.customer, e.mealType, e.numberOfPeople, `${(e.unitPrice * e.numberOfPeople).toLocaleString()} TZS`]),
            startY: 25,
            headStyles: { fillColor: [0, 71, 171] }
          });
        }
      }

      if (selectedAttachments.stock && availability.stock) {
        const stockLogs = await getStockLogs();
        const dailyLogs = stockLogs.filter(l => l.date === reportDate);

        if (dailyLogs.length > 0) {
          doc.addPage();
          doc.setFontSize(14);
          doc.text("Attachment: Daily Stock Log", 105, 15, { align: "center" });
          (doc as any).autoTable({
            head: [['Product', 'Type', 'Qty', 'Value', 'Reason']],
            body: dailyLogs.map(l => [l.productName, l.type, l.quantity, `${l.price.toLocaleString()} TZS`, l.reason]),
            startY: 25,
            headStyles: { fillColor: [0, 128, 128] }
          });
        }
      }

      if (selectedAttachments.issuance && availability.issuance) {
        const issuances = await getIssuances();
        const dailyIssuances = issuances.filter(i => i.date === reportDate);

        if (dailyIssuances.length > 0) {
          doc.addPage();
          doc.setFontSize(14);
          doc.text("Attachment: Daily Issuance Report", 105, 15, { align: "center" });
          (doc as any).autoTable({
            head: [['ID', 'Issued To', 'Order', 'Status', 'Value']],
            body: dailyIssuances.map(i => [i.id, i.issuedTo, i.orderId, i.status, `${i.totalValue.toLocaleString()} TZS`]),
            startY: 25,
            headStyles: { fillColor: [255, 140, 0] }
          });
        }
      }

      if (selectedAttachments.menu && availability.menu) {
        const menus = await getMenusByDate(reportDate);

        if (menus.length > 0) {
          doc.addPage();
          doc.setFontSize(14);
          doc.text("Attachment: Daily Menu Planner", 105, 15, { align: "center" });
          (doc as any).autoTable({
            head: [['Region', 'Order ID', 'Recipes']],
            body: menus.map(m => [m.region, m.order_id, m.recipes.map(r => r.name).join(', ')]),
            startY: 25,
            headStyles: { fillColor: [102, 51, 153] }
          });
        }
      }

      if (selectedAttachments.proformas && availability.proformas) {
        const { data: allProformas } = await supabase.from('proforma_invoices').select('*');
        const dailyProformas = (allProformas || []).filter(p => p.invoiceDate === reportDate || p.createdAt?.startsWith(reportDate));
        if (dailyProformas.length > 0) {
          doc.addPage();
          doc.setFontSize(14);
          doc.text("Attachment: Daily Proforma Invoices", 105, 15, { align: "center" });
          (doc as any).autoTable({
            head: [['ID', 'Client / Receiver', 'Date', 'Amount', 'Status']],
            body: dailyProformas.map(p => [p.id, p.receiverName || p.clientId, p.invoiceDate || p.createdAt?.split('T')[0], `${(Number(p.serviceCharge) || 0) + (Number(p.transportCosts) || 0)} TZS`, p.isInvoiced ? 'Invoiced' : 'Pending']),
            startY: 25,
            headStyles: { fillColor: [0, 102, 204] }
          });
        }
      }

      if (selectedAttachments.invoices && availability.invoices) {
        const { data: allInvoices } = await supabase.from('invoices').select('*');
        const dailyInvoices = (allInvoices || []).filter(i => i.invoiceDate === reportDate || i.createdAt?.startsWith(reportDate));
        if (dailyInvoices.length > 0) {
          doc.addPage();
          doc.setFontSize(14);
          doc.text("Attachment: Daily Final Invoices", 105, 15, { align: "center" });
          (doc as any).autoTable({
            head: [['ID', 'Client / Receiver', 'Date', 'Amount', 'Status']],
            body: dailyInvoices.map(i => [i.id, i.receiverName || i.clientId, i.invoiceDate || i.createdAt?.split('T')[0], `${(Number(i.serviceCharge) || 0) + (Number(i.transportCosts) || 0)} TZS`, i.status]),
            startY: 25,
            headStyles: { fillColor: [0, 153, 76] }
          });
        }
      }

      if (selectedAttachments.deliveryNotes && availability.deliveryNotes) {
        const allDeliveryNotes = await getDeliveryNotes();
        const dailyDeliveryNotes = allDeliveryNotes.filter(d => d.delivery_date?.startsWith(reportDate));
        if (dailyDeliveryNotes.length > 0) {
          doc.addPage();
          doc.setFontSize(14);
          doc.text("Attachment: Daily Delivery Notes", 105, 15, { align: "center" });
          (doc as any).autoTable({
            head: [['ID', 'Order ID', 'Client', 'Delivered By', 'Location']],
            body: dailyDeliveryNotes.map(d => [d.id, d.order_id, d.client_name, d.delivered_by, d.delivery_location]),
            startY: 25,
            headStyles: { fillColor: [204, 102, 0] }
          });
        }
      }

      if (selectedAttachments.costing && availability.costing) {
        const { data: allCosting } = await supabase.from('costing_reports').select('*');
        const dailyCosting = (allCosting || []).filter(c => c.report_date === reportDate || c.created_at?.startsWith(reportDate));
        if (dailyCosting.length > 0) {
          doc.addPage();
          doc.setFontSize(14);
          doc.text("Attachment: Daily Costing Reports", 105, 15, { align: "center" });
          (doc as any).autoTable({
            head: [['Type', 'Description', 'Amount']],
            body: dailyCosting.map(c => [c.type.toUpperCase(), c.description, `${Number(c.amount).toLocaleString()} TZS`]),
            startY: 25,
            headStyles: { fillColor: [153, 0, 76] }
          });
        }
      }

      doc.save(`Supervisor_Daily_Report_Package_${reportDate}.pdf`);
      toast({ title: 'Export Successful', description: 'All selected reports have been bundled into the PDF.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Export Failed', description: 'Failed to generate bundle PDF.' });
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  const isLocked = reportData.status === 'Submitted';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={() => router.push('/reports/supervisor-daily')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to History
        </Button>
        <div className="flex gap-2">
          {reportId && (
            <Button variant="outline" onClick={() => setIsBundleDialogOpen(true)} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileCheck className="h-4 w-4 mr-2" />}
              Export Bundle PDF
            </Button>
          )}
          {!isLocked && (
            <>
              <Button variant="outline" onClick={() => saveReport('Draft')} disabled={isSubmitting}>
                <Save className="mr-2 h-4 w-4" /> Save Draft
              </Button>
              <Button onClick={() => saveReport('Submitted')} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                <Send className="mr-2 h-4 w-4" /> Submit Report
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="text-center border-b bg-muted/30">
          <div className="text-sm font-bold text-primary mb-1">ABBY&apos;S LEGENDARY CATERERS LIMITED</div>
          <div className="text-xs text-muted-foreground mb-4">Form Code: ALC-KIT-FRM-01</div>
          <CardTitle className="text-2xl font-bold">Supervisor Daily Report</CardTitle>
          <CardDescription>Daily operational evaluation and quality control checklist.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Report Date</Label>
              <Input
                type="date"
                value={reportData.report_date}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setReportData(prev => ({ ...prev, report_date: newDate }));
                  checkOtherReportsAvailability(newDate);
                }}
                disabled={isLocked}
              />
            </div>
            <div className="space-y-2">
              <Label>Supervisor Name</Label>
              <Input value={reportData.supervisor_name || user?.user_metadata?.name || ''} disabled />
            </div>
          </div>

          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="w-12">S/N</TableHead>
                  <TableHead>Criteria Description</TableHead>
                  <TableHead className="text-center">Evaluation / Rating</TableHead>
                  <TableHead className="w-1/4">Issue / Reason (If Any)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.criteria?.map((c, index) => (
                  <TableRow key={index} className={cn(c.isIssue && "bg-destructive/5")}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="max-w-xs">{c.description}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Checkbox
                            id={`issue-${index}`}
                            checked={c.isIssue}
                            onCheckedChange={(val) => handleIssueToggle(index, !!val)}
                            disabled={isLocked}
                          />
                          <Label htmlFor={`issue-${index}`} className={cn("text-xs cursor-pointer", c.isIssue && "text-destructive font-bold")}>Mark as Issue (X)</Label>
                        </div>
                        {!c.isIssue && (
                          <RadioGroup
                            value={c.rating || ""}
                            onValueChange={(val) => handleRatingChange(index, val as ReportRating)}
                            className="flex gap-2 flex-wrap justify-center"
                            disabled={isLocked}
                          >
                            {RATINGS.map(r => (
                              <div key={r} className="flex items-center space-x-1">
                                <RadioGroupItem value={r} id={`r-${index}-${r}`} className="h-3 w-3" />
                                <Label htmlFor={`r-${index}-${r}`} className="text-[10px] cursor-pointer">{r}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.isIssue ? (
                        <div className="space-y-1">
                          <AlertTriangle className="h-4 w-4 text-destructive mb-1" />
                          <Textarea
                            placeholder="Enter reason for failure..."
                            className="text-xs min-h-[60px] border-destructive/50"
                            value={c.reason}
                            onChange={(e) => handleReasonChange(index, e.target.value)}
                            required
                            disabled={isLocked}
                          />
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground italic">No issue marked.</div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-4">
            <Label className="text-lg font-semibold">General Comments</Label>
            <Textarea
              placeholder="Any additional observations or feedback for the day..."
              rows={4}
              value={reportData.general_comments}
              onChange={(e) => setReportData(prev => ({ ...prev, general_comments: e.target.value }))}
              disabled={isLocked}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
            <div className="space-y-2">
              <Label>Prepared By (Digital Signature)</Label>
              <Input
                placeholder="Type your full name..."
                value={reportData.prepared_by}
                onChange={(e) => setReportData(prev => ({ ...prev, prepared_by: e.target.value }))}
                disabled={isLocked}
              />
            </div>
            <div className="space-y-2">
              <Label>Checked By (Optional)</Label>
              <Input
                placeholder="Manager signature..."
                value={reportData.checked_by}
                onChange={(e) => setReportData(prev => ({ ...prev, checked_by: e.target.value }))}
                disabled={isLocked}
              />
            </div>
          </div>
        </CardContent>
        {isLocked && (
          <CardFooter className="bg-muted/20 border-t flex justify-center py-4">
            <Badge variant="secondary" className="px-4 py-1 text-sm">
              <Lock className="h-4 w-4 mr-2" /> This report is submitted and locked for editing.
            </Badge>
          </CardFooter>
        )}
      </Card>

      <Dialog open={isBundleDialogOpen} onOpenChange={setIsBundleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>PDF Bundle Configuration</DialogTitle>
            <DialogDescription>
              Select which daily logs and reports from {format(parseISO(reportData.report_date!), 'PPP')} you want to attach to this Supervisor Report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  {availability.orders ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                  <div className="flex flex-col">
                    <Label className="font-semibold">Daily Order Report</Label>
                    <span className="text-xs text-muted-foreground">{availability.orders ? 'Available' : 'No records found'}</span>
                  </div>
                </div>
                <Checkbox
                  checked={selectedAttachments.orders}
                  onCheckedChange={(val) => setSelectedAttachments(prev => ({ ...prev, orders: !!val }))}
                  disabled={!availability.orders}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  {availability.stock ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                  <div className="flex flex-col">
                    <Label className="font-semibold">Daily Stock Log</Label>
                    <span className="text-xs text-muted-foreground">{availability.stock ? 'Available' : 'No records found'}</span>
                  </div>
                </div>
                <Checkbox
                  checked={selectedAttachments.stock}
                  onCheckedChange={(val) => setSelectedAttachments(prev => ({ ...prev, stock: !!val }))}
                  disabled={!availability.stock}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  {availability.issuance ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                  <div className="flex flex-col">
                    <Label className="font-semibold">Daily Issuance Report</Label>
                    <span className="text-xs text-muted-foreground">{availability.issuance ? 'Available' : 'No records found'}</span>
                  </div>
                </div>
                <Checkbox
                  checked={selectedAttachments.issuance}
                  onCheckedChange={(val) => setSelectedAttachments(prev => ({ ...prev, issuance: !!val }))}
                  disabled={!availability.issuance}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  {availability.menu ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                  <div className="flex flex-col">
                    <Label className="font-semibold">Daily Menu Planner</Label>
                    <span className="text-xs text-muted-foreground">{availability.menu ? 'Available' : 'No records found'}</span>
                  </div>
                </div>
                <Checkbox
                  checked={selectedAttachments.menu}
                  onCheckedChange={(val) => setSelectedAttachments(prev => ({ ...prev, menu: !!val }))}
                  disabled={!availability.menu}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  {availability.proformas ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                  <div className="flex flex-col">
                    <Label className="font-semibold">Daily Proforma Invoices</Label>
                    <span className="text-xs text-muted-foreground">{availability.proformas ? 'Available' : 'No records found'}</span>
                  </div>
                </div>
                <Checkbox
                  checked={selectedAttachments.proformas}
                  onCheckedChange={(val) => setSelectedAttachments(prev => ({ ...prev, proformas: !!val }))}
                  disabled={!availability.proformas}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  {availability.invoices ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                  <div className="flex flex-col">
                    <Label className="font-semibold">Daily Final Invoices</Label>
                    <span className="text-xs text-muted-foreground">{availability.invoices ? 'Available' : 'No records found'}</span>
                  </div>
                </div>
                <Checkbox
                  checked={selectedAttachments.invoices}
                  onCheckedChange={(val) => setSelectedAttachments(prev => ({ ...prev, invoices: !!val }))}
                  disabled={!availability.invoices}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  {availability.deliveryNotes ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                  <div className="flex flex-col">
                    <Label className="font-semibold">Daily Delivery Notes</Label>
                    <span className="text-xs text-muted-foreground">{availability.deliveryNotes ? 'Available' : 'No records found'}</span>
                  </div>
                </div>
                <Checkbox
                  checked={selectedAttachments.deliveryNotes}
                  onCheckedChange={(val) => setSelectedAttachments(prev => ({ ...prev, deliveryNotes: !!val }))}
                  disabled={!availability.deliveryNotes}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  {availability.costing ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                  <div className="flex flex-col">
                    <Label className="font-semibold">Daily Costing Reports</Label>
                    <span className="text-xs text-muted-foreground">{availability.costing ? 'Available' : 'No records found'}</span>
                  </div>
                </div>
                <Checkbox
                  checked={selectedAttachments.costing}
                  onCheckedChange={(val) => setSelectedAttachments(prev => ({ ...prev, costing: !!val }))}
                  disabled={!availability.costing}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsBundleDialogOpen(false)}>Cancel</Button>
              <Button onClick={generatePDFBundle}>Generate Bundle</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
