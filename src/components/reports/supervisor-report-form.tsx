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
import { Loader2, ArrowLeft, Save, Send, AlertTriangle, FileText, Download, Lock, Unlock, FileCheck, CheckCircle2, XCircle, MessageSquareText, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO } from "date-fns";
import { addSupervisorReport, getSupervisorReportById, updateSupervisorReport } from "@/services/supervisorReportService";
import { getOrders } from "@/services/orderService";
import { getStockLogs } from "@/services/stockLogService";
import { getIssuances } from "@/services/issuanceService";
import { getMenusByDate } from "@/services/dailyMenuService";
import { getDeliveryNotes, getDeliveryNotesByDate } from "@/services/deliveryNoteService";
import { getAttendanceByDate } from "@/services/attendanceService";
import { getTrainingSessions, getEvaluationsByDate } from "@/services/trainingService";
import { getFeedbackByDate } from "@/services/feedbackService";
import { getClients } from "@/services/clientService";
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
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

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
    proformas: false,
    invoices: false,
    deliveryNotes: false,
    costing: false,
    trainings: false,
    attendance: false,
    evaluations: false,
    feedback: false
  });
  const [selectedAttachments, setSelectedAttachments] = useState({
    orders: true,
    stock: true,
    issuance: true,
    proformas: true,
    invoices: true,
    deliveryNotes: true,
    costing: true,
    trainings: true,
    attendance: true,
    evaluations: true,
    feedback: true
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
    const [
      ordersData, 
      stockData, 
      issuanceData, 
      menusData, 
      deliveryNotesData, 
      { data: allProformas }, 
      { data: allInvoices }, 
      { data: allCosting }, 
      attendanceData,
      evaluationsData,
      feedbackData
    ] = await Promise.all([
      getOrders(),
      getStockLogs(),
      getIssuances(),
      getMenusByDate(date),
      getDeliveryNotesByDate(date),
      supabase.from('proforma_invoices').select('*'),
      supabase.from('invoices').select('*'),
      supabase.from('costing_reports').select('*'),
      getAttendanceByDate(date),
      getEvaluationsByDate(date),
      getFeedbackByDate(date)
    ]);

    const dateProformas = (allProformas || []).filter(p => p.invoiceDate === date || p.createdAt?.startsWith(date));
    const dateInvoices = (allInvoices || []).filter(i => i.invoiceDate === date || i.createdAt?.startsWith(date));
    const dateCosting = (allCosting || []).filter(c => c.report_date === date || c.created_at?.startsWith(date));

    const trainingsData = await getTrainingSessions();
    const dateTrainings = (trainingsData || []).filter(t => t.training_date === date || t.createdAt?.startsWith(date));

    setAvailability({
      orders: ordersData.some(o => o.startDate <= date && o.endDate >= date),
      stock: stockData.some(l => l.date === date),
      issuance: issuanceData.some(i => i.date === date),
      proformas: dateProformas.length > 0,
      invoices: dateInvoices.length > 0,
      deliveryNotes: deliveryNotesData.length > 0,
      costing: dateCosting.length > 0,
      trainings: dateTrainings.length > 0,
      attendance: attendanceData.length > 0,
      evaluations: evaluationsData.length > 0,
      feedback: feedbackData.length > 0
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

  const calculateTotal = (data: any) => {
    const items = data.items || [];
    const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
    const totalForDays = data.multiplyByDays ? subtotal * (Number(data.numberOfDays) || 1) : subtotal;
    const totalBeforeVat = totalForDays + (Number(data.serviceCharge) || 0) + (Number(data.transportCosts) || 0);
    const vat = data.vatType === 'exclusive' ? totalBeforeVat * 0.18 : 0;
    return totalBeforeVat + vat;
  };

  const generatePDFBundle = async () => {
    setIsExporting(true);
    setIsBundleDialogOpen(false);

    try {
      const doc = new jsPDF();
      const reportDate = reportData.report_date!;
      let currentY = 10;

      const checkPageSpace = (height: number) => {
        if (currentY + height > 280) {
          doc.addPage();
          currentY = 15;
          return true;
        }
        return false;
      };

      const addSectionTitle = (title: string, color = [0, 0, 0]) => {
        checkPageSpace(15);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(title, 14, currentY + 10);
        doc.line(14, currentY + 12, 196, currentY + 12);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        currentY += 15;
      };

      // --- SECTION 1: SUPERVISOR REPORT ---
      doc.setFontSize(10);
      doc.text("Abby's Legendary Caterers Limited", 105, currentY, { align: "center" });
      currentY += 5;
      doc.setFontSize(8);
      doc.text("Form Code: ALC-KIT-FRM-01", 105, currentY, { align: "center" });
      currentY += 10;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Supervisor Daily Report", 105, currentY, { align: "center" });
      currentY += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${format(parseISO(reportDate), 'PPP')}`, 14, currentY);
      doc.text(`Supervisor: ${reportData.supervisor_name || user?.user_metadata?.name || 'N/A'}`, 14, currentY + 5);
      doc.text(`Status: ${reportData.status}`, 150, currentY);
      currentY += 12;

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
        startY: currentY,
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

      currentY = (doc as any).lastAutoTable.finalY + 10;
      
      // --- SECTION: GENERAL COMMENTS (Multi-page support) ---
      checkPageSpace(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("General Comments / Day Overview:", 14, currentY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      
      const comments = reportData.general_comments || "No general comments provided for this session.";
      const splitComments = doc.splitTextToSize(comments, 180);
      const lineHeight = 5;
      const commentHeight = splitComments.length * lineHeight;
      
      // If the entire comment block doesn't fit, we use autoTable for automatic page breaking
      (doc as any).autoTable({
        startY: currentY + 4,
        body: [[comments]],
        theme: 'plain',
        styles: { 
          fontSize: 9, 
          fontStyle: 'italic', 
          cellPadding: 0,
          overflow: 'linebreak'
        },
        columnStyles: { 0: { cellWidth: 182 } }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;

      checkPageSpace(15);
      doc.text(`Prepared By: ${reportData.prepared_by}`, 14, currentY);
      doc.text(`Checked By: ${reportData.checked_by || '___________________'}`, 120, currentY);
      currentY += 15;

      // --- SECTION: DAILY ORDERS ---
      if (selectedAttachments.orders && availability.orders) {
        const orders = await getOrders();
        const dailyEvents = orders.flatMap(order =>
          order.clientEvents
            .filter(e => e.date === reportDate)
            .map(e => ({ ...e, orderId: order.id, customer: order.name }))
        );

        if (dailyEvents.length > 0) {
          addSectionTitle("1. Daily Order Report", [0, 71, 171]);
          (doc as any).autoTable({
            head: [['Order ID', 'Customer', 'Meal Type', 'Pax', 'Total']],
            body: dailyEvents.map(e => [e.orderId, e.customer, e.mealType, e.numberOfPeople, `${(e.unitPrice * e.numberOfPeople).toLocaleString()} TZS`]),
            startY: currentY,
            headStyles: { fillColor: [0, 71, 171] },
            styles: { fontSize: 8 }
          });
          currentY = (doc as any).lastAutoTable.finalY + 10;
        }
      }

      // --- SECTION: DAILY ISSUANCE ---
      if (selectedAttachments.issuance && availability.issuance) {
        const issuances = await getIssuances();
        const dailyIssuances = issuances.filter(i => i.date === reportDate);

        if (dailyIssuances.length > 0) {
          addSectionTitle("2. Daily Issuance Report", [255, 140, 0]);
          (doc as any).autoTable({
            head: [['ID', 'Issued To', 'Order', 'Status', 'Value']],
            body: dailyIssuances.map(i => [i.id, i.issuedTo, i.orderId, i.status, `${i.totalValue.toLocaleString()} TZS`]),
            startY: currentY,
            headStyles: { fillColor: [255, 140, 0] },
            styles: { fontSize: 8 }
          });
          currentY = (doc as any).lastAutoTable.finalY + 10;
        }
      }

      // --- SECTION: DAILY STOCK MOVEMENT (LEDGER) ---
      if (selectedAttachments.stock && availability.stock) {
        const stockLogs = await getStockLogs();
        const dailyLogs = stockLogs.filter(l => l.date === reportDate);

        if (dailyLogs.length > 0) {
          addSectionTitle("3. Daily Stock Movement", [0, 128, 128]);
          (doc as any).autoTable({
            head: [['Time', 'Product', 'Type', 'Qty', 'Balance', 'Reason']],
            body: dailyLogs.map(l => [
                l.createdAt ? format(parseISO(l.createdAt), 'HH:mm') : '-',
                l.productName, 
                l.type, 
                l.quantity, 
                `${l.price.toLocaleString()} TZS`, 
                l.reason
            ]),
            startY: currentY,
            headStyles: { fillColor: [0, 128, 128] },
            styles: { fontSize: 8 }
          });
          currentY = (doc as any).lastAutoTable.finalY + 10;
        }
      }

      // --- SECTION: PROFORMA INVOICES ---
      if (selectedAttachments.proformas && availability.proformas) {
        const { data: allProformas } = await supabase.from('proforma_invoices').select('*');
        const allClients = await getClients();
        const dailyProformas = (allProformas || []).filter(p => p.invoiceDate === reportDate || p.createdAt?.startsWith(reportDate));
        
        if (dailyProformas.length > 0) {
          addSectionTitle("4. Proforma Invoices Issued", [0, 102, 204]);
          (doc as any).autoTable({
            head: [['Proforma ID', 'Client Name', 'Date', 'Amount', 'Status']],
            body: dailyProformas.map(p => {
                const client = allClients.find(c => c.id === p.clientId);
                const clientName = p.receiverName || client?.companyName || p.clientId || 'Unknown Client';
                const grandTotal = calculateTotal(p);
                return [
                  p.id, 
                  clientName, 
                  p.invoiceDate || p.createdAt?.split('T')[0], 
                  `${grandTotal.toLocaleString()} TZS`, 
                  p.isInvoiced ? 'Finalized' : 'Pending'
                ];
            }),
            startY: currentY,
            headStyles: { fillColor: [0, 102, 204] },
            styles: { fontSize: 8 }
          });
          currentY = (doc as any).lastAutoTable.finalY + 10;
        }
      }

      // --- SECTION: FINAL INVOICES ---
      if (selectedAttachments.invoices && availability.invoices) {
        const { data: allInvoices } = await supabase.from('invoices').select('*');
        const allClients = await getClients();
        const dailyInvoices = (allInvoices || []).filter(i => i.invoiceDate === reportDate || i.createdAt?.startsWith(reportDate));
        
        if (dailyInvoices.length > 0) {
          addSectionTitle("5. Final Invoices Issued", [0, 153, 76]);
          (doc as any).autoTable({
            head: [['Invoice ID', 'Client Name', 'Date', 'Amount', 'Status']],
            body: dailyInvoices.map(i => {
                const client = allClients.find(c => c.id === i.clientId);
                const clientName = i.receiverName || client?.companyName || i.clientId || 'Unknown Client';
                const grandTotal = calculateTotal(i);
                return [
                  i.id, 
                  clientName, 
                  i.invoiceDate || i.createdAt?.split('T')[0], 
                  `${grandTotal.toLocaleString()} TZS`, 
                  i.status
                ];
            }),
            startY: currentY,
            headStyles: { fillColor: [0, 153, 76] },
            styles: { fontSize: 8 }
          });
          currentY = (doc as any).lastAutoTable.finalY + 10;
        }
      }

       // --- SECTION: TRAININGS ---
       if (selectedAttachments.trainings && availability.trainings) {
        const { data: trainingsData } = await supabase.from('positions').select('*');
        const dailyTrainings = (trainingsData || []).filter(t => t.training_date === reportDate || t.createdAt?.startsWith(reportDate));
        
        if (dailyTrainings.length > 0) {
          addSectionTitle("6. Staff Training Sessions", [128, 0, 128]);
          (doc as any).autoTable({
            head: [['Topic', 'Module', 'Dept', 'Participants', 'Location']],
            body: dailyTrainings.map(t => [t.title, t.type, t.department, t.applicants, t.location]),
            startY: currentY,
            headStyles: { fillColor: [128, 0, 128] },
            styles: { fontSize: 8 }
          });
          currentY = (doc as any).lastAutoTable.finalY + 10;
        }
      }

      // --- SECTION: ATTENDANCE ---
      if (selectedAttachments.attendance && availability.attendance) {
        const attendanceData = await getAttendanceByDate(reportDate);
        
        if (attendanceData.length > 0) {
          addSectionTitle("7. Daily Attendance Report", [0, 128, 0]);
          (doc as any).autoTable({
            head: [['Employee Name', 'Status', 'Notes']],
            body: attendanceData.map(a => [a.employee, a.status, a.notes || '-']),
            startY: currentY,
            headStyles: { fillColor: [0, 128, 0] },
            styles: { fontSize: 8 }
          });
          currentY = (doc as any).lastAutoTable.finalY + 10;
        }
      }

      // --- SECTION: DAILY TRAINING EVALUATIONS ---
      if (selectedAttachments.evaluations && availability.evaluations) {
        const evaluations = await getEvaluationsByDate(reportDate);
        if (evaluations.length > 0) {
          addSectionTitle("8. Training Evaluation Progress", [234, 88, 12]);
          (doc as any).autoTable({
            head: [['Trainee', 'Training Module', 'Score', 'Key Skills Observed', 'Trainer']],
            body: evaluations.map(e => [
                e.trainee_name, 
                e.training_title, 
                `${e.total_score}%`, 
                (e.skills_demonstrated || []).join(', '),
                e.evaluator_name || 'Supervisor'
            ]),
            startY: currentY,
            headStyles: { fillColor: [234, 88, 12] },
            styles: { fontSize: 8 }
          });
          currentY = (doc as any).lastAutoTable.finalY + 10;
        }
      }

      // --- SECTION: CUSTOMER FEEDBACK ---
      if (selectedAttachments.feedback && availability.feedback) {
        const feedback = await getFeedbackByDate(reportDate);
        if (feedback.length > 0) {
          addSectionTitle("9. Customer Feedback Summary", [190, 24, 93]);
          (doc as any).autoTable({
            head: [['Order', 'Overall Summary', 'Positive Feedback', 'Complaints']],
            body: feedback.map(f => [
                f.order_id || 'General', 
                f.overall_summary || '-', 
                f.positive_feedback || '-', 
                f.complaints || '-'
            ]),
            startY: currentY,
            headStyles: { fillColor: [190, 24, 93] },
            styles: { fontSize: 8 }
          });
          currentY = (doc as any).lastAutoTable.finalY + 10;
        }
      }

      // --- SECTION: DELIVERY NOTES ISSUED ---
      if (selectedAttachments.deliveryNotes && availability.deliveryNotes) {
        const notes = await getDeliveryNotesByDate(reportDate);
        if (notes.length > 0) {
          addSectionTitle("10. Delivery Notes Issued Today", [71, 85, 105]);
          (doc as any).autoTable({
            head: [['Note ID', 'Client', 'Destination', 'Vehicle', 'Delivered By']],
            body: notes.map(n => [
                n.id, 
                n.client_name, 
                n.delivery_location, 
                n.vehicle_reg_no || '-', 
                n.delivered_by
            ]),
            startY: currentY,
            headStyles: { fillColor: [71, 85, 105] },
            styles: { fontSize: 8 }
          });
          currentY = (doc as any).lastAutoTable.finalY + 10;
        }
      }

      doc.save(`Supervisor_Daily_Report_Package_${reportDate}.pdf`);
      toast({ title: 'Export Successful', description: 'All selected reports have been bundled into a continuous PDF.' });
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

          {/* ── GENERAL COMMENTS & DAY OVERVIEW ── */}
          <div className="relative my-2 group">
            {/* Gradient accent border */}
            <div className="absolute -inset-px rounded-xl bg-gradient-to-br from-primary/30 via-primary/10 to-amber-500/20 pointer-events-none transition-all group-hover:from-primary/50 group-hover:to-amber-500/40" />
            <div className="relative rounded-xl bg-amber-50/40 dark:bg-amber-950/10 border border-primary/10 p-6 space-y-4 shadow-inner">
              {/* Header Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary shadow-lg text-primary-foreground">
                    <MessageSquareText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black tracking-tight">General Comments & Day Overview</h3>
                    <p className="text-[11px] text-muted-foreground font-semibold">Operational highlights, logistical hurdles, and staffing metrics</p>
                  </div>
                </div>
                {!isLocked && (
                  <div className="flex items-center gap-2">
                    {reportData.general_comments && (
                      <Badge variant="outline" className="bg-background text-[10px] font-black tabular-nums border-primary/20 h-6">
                        {reportData.general_comments.trim().split(/\s+/).filter(Boolean).length} words
                      </Badge>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsWorkspaceOpen(true)}
                      className="h-7 text-[10px] font-black uppercase tracking-widest gap-1.5 border-primary/20 hover:bg-primary hover:text-white transition-all shadow-sm"
                    >
                      <Sparkles className="h-3 w-3" /> Expand Workspace
                    </Button>
                  </div>
                )}
              </div>

              {/* Body */}
              {isLocked ? (
                /* ── READ-ONLY: Styled blockquote view ── */
                <div className="relative pl-6 py-6 border-l-4 border-primary bg-background/80 rounded-r-xl shadow-sm overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <MessageSquareText className="h-24 w-24" />
                  </div>
                  <span className="absolute -top-1 left-3 text-6xl text-primary/10 font-serif leading-none select-none">“</span>
                  <p className="text-sm leading-relaxed text-foreground/90 italic font-medium whitespace-pre-wrap relative z-10">
                    {reportData.general_comments || 'No operational overview was provided for this report period.'}
                  </p>
                  <span className="absolute -bottom-6 right-6 text-6xl text-primary/10 font-serif leading-none select-none">”</span>
                </div>
              ) : (
                /* ── EDITABLE: Summary view with action ── */
                <div className="space-y-4">
                  <div 
                    className="group/text cursor-pointer relative"
                    onClick={() => setIsWorkspaceOpen(true)}
                  >
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-amber-50/80 dark:from-amber-950/40 to-transparent pointer-events-none z-10" />
                    <Textarea
                      placeholder="Summarize the day’s operations — key wins, challenges, staffing notes, and anything management should be aware of..."
                      rows={4}
                      readOnly
                      className="bg-background/60 border-primary/10 text-sm leading-relaxed cursor-pointer group-hover/text:border-primary/30 transition-all border-dashed"
                      value={reportData.general_comments}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover/text:opacity-100 transition-all z-20">
                      <Button variant="secondary" className="font-black text-xs h-8 shadow-xl border border-primary/20">
                        OPEN ANALYTICAL WORKSPACE
                      </Button>
                    </div>
                  </div>
                  
                  {/* Metrics status bar */}
                  <div className="flex items-center gap-4 px-1">
                    <Progress
                      value={((reportData.general_comments?.length || 0) / 1000) * 100}
                      className="flex-1 h-2 bg-primary/5 shadow-inner"
                    />
                    <span className={cn(
                      "text-[10px] font-black tabular-nums tracking-widest",
                      (reportData.general_comments?.length || 0) > 900 ? "text-destructive" : "text-primary/60"
                    )}>
                      {reportData.general_comments?.length || 0} / 1,000 CHARS
                    </span>
                  </div>
                </div>
              )}
            </div>
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

              <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  {availability.trainings ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                  <div className="flex flex-col">
                    <Label className="font-semibold">Daily Training Sessions</Label>
                    <span className="text-xs text-muted-foreground">{availability.trainings ? 'Available' : 'No records found'}</span>
                  </div>
                </div>
                <Checkbox
                  checked={selectedAttachments.trainings}
                  onCheckedChange={(val) => setSelectedAttachments(prev => ({ ...prev, trainings: !!val }))}
                  disabled={!availability.trainings}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  {availability.attendance ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                  <div className="flex flex-col">
                    <Label className="font-semibold">Daily Attendance Report</Label>
                    <span className="text-xs text-muted-foreground">{availability.attendance ? 'Available' : 'No records found'}</span>
                  </div>
                </div>
                <Checkbox
                  checked={selectedAttachments.attendance}
                  onCheckedChange={(val) => setSelectedAttachments(prev => ({ ...prev, attendance: !!val }))}
                  disabled={!availability.attendance}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  {availability.evaluations ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                  <div className="flex flex-col">
                    <Label className="font-semibold">Daily Training Evaluations</Label>
                    <span className="text-xs text-muted-foreground">{availability.evaluations ? 'Available' : 'No records found'}</span>
                  </div>
                </div>
                <Checkbox
                  checked={selectedAttachments.evaluations}
                  onCheckedChange={(val) => setSelectedAttachments(prev => ({ ...prev, evaluations: !!val }))}
                  disabled={!availability.evaluations}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  {availability.feedback ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <XCircle className="text-muted-foreground h-5 w-5" />}
                  <div className="flex flex-col">
                    <Label className="font-semibold">Daily Customer Feedback</Label>
                    <span className="text-xs text-muted-foreground">{availability.feedback ? 'Available' : 'No records found'}</span>
                  </div>
                </div>
                <Checkbox
                  checked={selectedAttachments.feedback}
                  onCheckedChange={(val) => setSelectedAttachments(prev => ({ ...prev, feedback: !!val }))}
                  disabled={!availability.feedback}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBundleDialogOpen(false)}>Cancel</Button>
            <Button onClick={generatePDFBundle}>Generate Bundle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWorkspaceOpen} onOpenChange={setIsWorkspaceOpen}>
        <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <MessageSquareText className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tight">Expanded Analytical Workspace</DialogTitle>
                  <DialogDescription className="text-white/60 font-bold uppercase tracking-widest text-xs">
                    Drafting elite operational overviews
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <div className="flex-1 p-8 flex flex-col space-y-6 bg-background relative overflow-hidden">
             {/* Decorative watermark */}
             <div className="absolute bottom-4 right-4 opacity-[0.03] select-none pointer-events-none">
                <FileText className="h-64 w-64 rotate-12" />
             </div>

             <div className="flex-1 space-y-4 relative z-10">
                <div className="flex items-center justify-between px-1">
                   <Label className="text-xs font-black uppercase tracking-widest text-primary/60">Professional Observations & Commentary</Label>
                   <div className="flex items-center gap-3">
                      <Badge variant="outline" className="h-6 font-black text-[10px] border-primary/20 px-3">
                        {reportData.general_comments?.trim().split(/\s+/).filter(Boolean).length || 0} WORDS
                      </Badge>
                      <Badge className={cn(
                        "h-6 font-black text-[10px] px-3",
                        (reportData.general_comments?.length || 0) > 900 ? "bg-destructive shadow-lg shadow-destructive/20" : "bg-primary"
                      )}>
                        {reportData.general_comments?.length || 0} / 1,000 CHARS
                      </Badge>
                   </div>
                </div>
                <Textarea
                  placeholder="Record precise operational data, staffing performance, client feedback, and strategic notes for this session..."
                  className="flex-1 min-h-[350px] text-lg font-medium leading-relaxed resize-none border-primary/10 focus-visible:ring-primary/20 bg-muted/5 p-6 rounded-2xl shadow-inner scrollbar-thin"
                  value={reportData.general_comments}
                  maxLength={1000}
                  onChange={(e) => setReportData(prev => ({ ...prev, general_comments: e.target.value }))}
                />
             </div>
          </div>

          <DialogFooter className="p-6 bg-muted/20 border-t flex items-center justify-between">
            <p className="text-[10px] font-bold text-muted-foreground italic max-w-xs leading-tight">
              NOTE: This commentary is exported directly into the daily report package and is visible to management auditing.
            </p>
            <Button onClick={() => setIsWorkspaceOpen(false)} className="bg-primary font-black px-10 shadow-xl shadow-primary/20">
              SAVE & SYNC WORKSPACE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
