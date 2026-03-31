"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Users,
  Loader2,
  Trash2,
  FileText,
  Download
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { getOrders } from "@/services/orderService";
import { getFeedbackByDate, addFeedback, deleteFeedback } from "@/services/feedbackService";
import type { Order, ServiceFeedback } from "@/types";
import { cn } from "@/lib/utils";

export default function CustomerFeedbackPage() {
  const { toast } = useToast();
  const [date, setDate] = useState<Date>(new Date());
  const [orders, setOrders] = useState<Order[]>([]);
  const [feedbackList, setFeedbackList] = useState<ServiceFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [selectedOrderId, setSelectedOrderId] = useState<string>("general");
  const [form, setForm] = useState({
    overall_summary: "",
    positive_feedback: "",
    complaints: "",
    waiter_challenges: ""
  });

  const formattedDate = format(date, "yyyy-MM-dd");

  useEffect(() => {
    fetchData();
  }, [formattedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allOrders, dayFeedback] = await Promise.all([
        getOrders(),
        getFeedbackByDate(formattedDate)
      ]);
      
      // Filter orders that overlap with this date
      const activeOrders = allOrders.filter(o => 
        o.startDate <= formattedDate && o.endDate >= formattedDate
      );
      
      setOrders(activeOrders);
      setFeedbackList(dayFeedback);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch data"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.overall_summary) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please provide at least an overall summary"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addFeedback({
        report_date: formattedDate,
        order_id: selectedOrderId === "general" ? null : selectedOrderId,
        ...form
      });

      if (result) {
        toast({
          title: "Feedback Saved",
          description: "Feedback report saved successfully"
        });
        setIsAddDialogOpen(false);
        setForm({
          overall_summary: "",
          positive_feedback: "",
          complaints: "",
          waiter_challenges: ""
        });
        setSelectedOrderId("general");
        fetchData();
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save feedback"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this report?")) return;
    
    try {
      const ok = await deleteFeedback(id);
      if (ok) {
        toast({
          title: "Report Deleted",
          description: "Report deleted successfully"
        });
        fetchData();
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete report"
      });
    }
  };

  const handleExportPDF = (feedback: ServiceFeedback) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(60, 40, 30); // Deep Brown
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("CUSTOMER SERVICE FEEDBACK FORM", pageWidth / 2, 25, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Report ID: ${feedback.id.substring(0, 8).toUpperCase()}`, pageWidth - 20, 35, { align: "right" });

    // Metadata
    let currentY = 50;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Date of Service:`, 14, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(format(new Date(feedback.report_date), "MMMM do, yyyy"), 50, currentY);
    
    currentY += 8;
    doc.setFont("helvetica", "bold");
    doc.text(`Related Order:`, 14, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(feedback.order_id || "General Operations", 50, currentY);

    currentY += 15;

    // Sections
    const addSection = (title: string, content: string, color: [number, number, number]) => {
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(14, currentY, pageWidth - 28, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(title.toUpperCase(), 18, currentY + 5.5);
      
      currentY += 12;
      doc.setTextColor(60, 60, 60);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      
      const splitText = doc.splitTextToSize(content || "No details provided.", pageWidth - 32);
      doc.text(splitText, 16, currentY);
      currentY += (splitText.length * 6) + 10;
    };

    addSection("1. Overall Service Summary", feedback.overall_summary, [75, 75, 75]);
    addSection("2. Positive Site Highlights", feedback.positive_feedback, [39, 174, 96]); // Emerald
    addSection("3. Customer Complaints / Issues", feedback.complaints, [192, 57, 43]); // Alizarin
    addSection("4. Waiter & Staff Challenges", feedback.waiter_challenges, [41, 128, 185]); // Blue

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("ABBY'S LEGENDARY CATERERS LIMITED - Internal Operational Document", pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });

    doc.save(`Feedback_${feedback.order_id || 'General'}_${feedback.report_date}.pdf`);
    toast({
      title: "Export Successful",
      description: "PDF exported successfully"
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="h-8 w-8 text-primary" />
            Customer Feedback Reports
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Monitor service quality and staff challenges on site.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> New Report
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Feedback Report</DialogTitle>
                <DialogDescription>
                  Record service performance and feedback for {format(date, "MMMM do, yyyy")}.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Related Order</Label>
                  <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General / No Specific Order</SelectItem>
                      {orders.map(order => (
                        <SelectItem key={order.id} value={order.id}>
                          [{order.id}] {order.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary">Overall Service Summary</Label>
                  <Textarea 
                    id="summary" 
                    placeholder="Briefly describe how the service went..." 
                    value={form.overall_summary}
                    onChange={e => setForm(f => ({ ...f, overall_summary: e.target.value }))}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 text-green-700">
                    <Label className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> Positive Highlights</Label>
                    <Textarea 
                      placeholder="What went well?" 
                      value={form.positive_feedback}
                      onChange={e => setForm(f => ({ ...f, positive_feedback: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 text-red-700">
                    <Label className="flex items-center gap-1"><ThumbsDown className="h-3 w-3" /> Complaints / Issues</Label>
                    <Textarea 
                      placeholder="Any customer complaints?" 
                      value={form.complaints}
                      onChange={e => setForm(f => ({ ...f, complaints: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Users className="h-3 w-3" /> Waiter / Staff Challenges</Label>
                  <Textarea 
                    placeholder="What problems did the staff face on site?" 
                    value={form.waiter_challenges}
                    onChange={e => setForm(f => ({ ...f, waiter_challenges: e.target.value }))}
                  />
                </div>

                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Feedback Report
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-accent/10 rounded-xl border border-dashed">
            <Loader2 className="h-10 w-10 animate-spin mb-4" />
            <p className="text-lg">Fetching feedback records...</p>
          </div>
        ) : feedbackList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-accent/5 rounded-xl border border-dashed">
            <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-xl font-medium">No feedback reports found for this date.</p>
            <p className="text-sm">Create a new report to start tracking performance.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {feedbackList.map((feedback) => (
              <Card key={feedback.id} className="group relative border-2 hover:border-primary/20 transition-all duration-300 overflow-hidden">
                <CardHeader className="bg-muted/30 pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {feedback.order_id ? `Order: ${feedback.order_id}` : "General Report"}
                      </CardTitle>
                      <CardDescription>
                        Submitted at {feedback.created_at ? format(new Date(feedback.created_at), "HH:mm") : "-"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => handleExportPDF(feedback)}
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(feedback.id)}
                        title="Delete Report"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall Summary</Label>
                    <p className="text-sm line-clamp-3 italic">"{feedback.overall_summary}"</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-green-50 border border-green-100">
                      <Label className="text-[10px] uppercase text-green-700 font-bold mb-1 block">Highlights</Label>
                      <p className="text-xs line-clamp-2 text-green-900">{feedback.positive_feedback || "None"}</p>
                    </div>
                    <div className="p-2 rounded bg-red-50 border border-red-100">
                      <Label className="text-[10px] uppercase text-red-700 font-bold mb-1 block">Complaints</Label>
                      <p className="text-xs line-clamp-2 text-red-900">{feedback.complaints || "None"}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-dashed">
                    <Label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      <Users className="h-3 w-3" /> Waiter Challenges
                    </Label>
                    <p className="text-xs line-clamp-2">{feedback.waiter_challenges || "No challenges reported"}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
