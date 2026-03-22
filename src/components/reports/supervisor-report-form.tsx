'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Save, Send, AlertTriangle, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO } from "date-fns";
import { addSupervisorReport, getSupervisorReportById, updateSupervisorReport } from "@/services/supervisorReportService";
import type { SupervisorReport, ReportCriterion, ReportRating } from "@/types";
import jsPDF from "jspdf";
import "jspdf-autotable";

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
  
  const [reportData, setReportData] = useState<Partial<SupervisorReport>>({
    report_date: format(new Date(), 'yyyy-MM-dd'),
    status: 'Draft',
    criteria: CRITERIA_DESCRIPTIONS.map(desc => ({
      description: desc,
      rating: 'Good' as ReportRating,
      isIssue: false,
      reason: ''
    })),
    prepared_by: user?.user_metadata.name || user?.email || '',
    general_comments: '',
    checked_by: ''
  });

  useEffect(() => {
    if (reportId) {
      const fetchReport = async () => {
        const data = await getSupervisorReportById(reportId);
        if (data) {
          setReportData(data);
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Report not found.' });
          router.push('/reports/supervisor-daily');
        }
        setLoading(false);
      };
      fetchReport();
    }
  }, [reportId, toast, router]);

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
        supervisor_name: user?.user_metadata.name || user?.email || 'Supervisor',
        prepared_by: reportData.prepared_by || user?.user_metadata.name || 'Supervisor'
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
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save report. You might already have a report for today.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(10);
      doc.text("Abby's Legendary Caterers Limited", 105, 10, { align: "center" });
      doc.setFontSize(8);
      doc.text("Form Code: ALC-KIT-FRM-01", 105, 15, { align: "center" });
      doc.setFontSize(14);
      doc.text("Supervisor Daily Report", 105, 25, { align: "center" });
      
      doc.setFontSize(10);
      doc.text(`Date: ${format(parseISO(reportData.report_date!), 'PPP')}`, 14, 35);
      doc.text(`Supervisor: ${reportData.supervisor_name || user?.user_metadata.name}`, 14, 40);
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
        headStyles: { fillColor: [128, 0, 32] }, // Burgundy
        styles: { fontSize: 8 },
        columnStyles: {
            2: { halign: 'center' },
            0: { cellWidth: 10 }
        },
        didParseCell: (data: any) => {
            if (data.cell.text[0].includes('X (ISSUE)')) {
                data.cell.styles.textColor = [220, 38, 38];
                data.cell.styles.fontStyle = 'bold';
            }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY;
      doc.text("General Comments:", 14, finalY + 10);
      doc.text(reportData.general_comments || "None", 14, finalY + 15, { maxWidth: 180 });

      doc.text(`Prepared By: ${reportData.prepared_by}`, 14, finalY + 30);
      doc.text(`Checked By: ${reportData.checked_by || '___________________'}`, 120, finalY + 30);

      doc.save(`Supervisor_Report_${reportData.report_date}.pdf`);
      toast({ title: 'PDF Generated', description: 'The report has been exported successfully.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Export Failed', description: 'An error occurred during PDF generation.' });
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
                <Button variant="outline" onClick={handleExportPDF} disabled={isExporting}>
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                    Export PDF
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
                onChange={(e) => setReportData(prev => ({ ...prev, report_date: e.target.value }))}
                disabled={isLocked}
              />
            </div>
            <div className="space-y-2">
              <Label>Supervisor Name</Label>
              <Input value={reportData.supervisor_name || user?.user_metadata.name || ''} disabled />
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
                            <Label htmlFor={`issue-${index}`} className={cn("text-xs", c.isIssue && "text-destructive font-bold")}>Mark as Issue (X)</Label>
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
    </div>
  );
}
