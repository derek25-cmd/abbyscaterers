
"use client";

import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileText, Loader2, Download } from "lucide-react";
import DateSelector from "@/components/costing/DateSelector";
import { useToast } from "@/hooks/use-toast";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { ClientEvent, Order } from "@/types";

interface DailyEventInfo extends ClientEvent {
  orderId: string;
  proformaId?: string;
}

export const DailyOrderReport = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const { orders, isLoading: ordersLoading } = useOrderStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const dailyEvents: DailyEventInfo[] = useMemo(() => {
    const targetDateStr = selectedDate.toISOString().split('T')[0];
    return orders.flatMap((order: Order) => 
        order.clientEvents
            .filter(event => event.date.startsWith(targetDateStr))
            .map(event => ({
                ...event,
                orderId: order.id,
                proformaId: order.proformaId,
            }))
    );
  }, [selectedDate, orders]);

  const calculateGrandTotal = (event: ClientEvent) => {
    const total = event.unitPrice * event.numberOfPeople;
    return total;
  };
  
  const totalSales = useMemo(() => {
    return dailyEvents.reduce((sum, event) => sum + calculateGrandTotal(event), 0);
  }, [dailyEvents]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  const handlePdfExport = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2, 
        useCORS: true,
        backgroundColor: null
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`Daily_Order_Report_${selectedDate.toISOString().split('T')[0]}.pdf`);
      toast({ title: "Export Successful", description: "Report exported to PDF." });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({ variant: "destructive", title: "Export Failed", description: "An error occurred while generating the PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCsvExport = () => {
    const headers = ["S/No", "Order ID", "Customer Name", "Proforma No.", "Type of Meal", "No. of People", "Unit Price", "VAT", "Grand Total"];
    const csvRows = [headers.join(',')];

    dailyEvents.forEach((event, index) => {
      const client = getClientById(event.clientId);
      const row = [
        index + 1,
        event.orderId,
        `"${client?.companyName.replace(/"/g, '""') || 'N/A'}"`,
        event.proformaId || 'N/A',
        event.mealType,
        event.numberOfPeople,
        event.unitPrice,
        event.vatType,
        calculateGrandTotal(event),
      ];
      csvRows.push(row.join(','));
    });
    
    csvRows.push(['', '', '', '', '', '', '', 'Total Sales', totalSales].join(','));

    const csvString = csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Daily_Order_Report_${selectedDate.toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Export Successful", description: "Report exported to CSV." });
    } else {
       toast({ variant: "destructive", title: "Export Failed", description: "Your browser doesn't support this feature." });
    }
  };

  const isLoading = ordersLoading || clientsLoading;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Daily Order Report</h1>
          <p className="text-muted-foreground">Review all order events for a specific day.</p>
        </div>
        <div className="flex items-center space-x-3">
          <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
          <Button onClick={handleCsvExport} variant="outline" size="sm" disabled={isExporting}>
             <Download className="mr-2 h-4 w-4" />
             Export CSV
          </Button>
          <Button onClick={handlePdfExport} variant="outline" size="sm" disabled={isExporting}>
             {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
             {isExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
        </div>
      </div>

        <Card ref={printRef} className="bg-card p-4 rounded-lg">
            <div className="text-center hidden print:block pt-8 mb-4">
                <h1 className="text-2xl font-bold">Daily Order Report</h1>
                <p className="text-lg">{selectedDate.toLocaleDateString()}</p>
            </div>
          <CardHeader>
            <CardTitle>Orders for: {selectedDate.toLocaleDateString()}</CardTitle>
          </CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">S/No</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Proforma No.</TableHead>
                  <TableHead>Type of Meal</TableHead>
                  <TableHead className="text-center">No. of People</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead>VAT</TableHead>
                  <TableHead className="text-right">Grand Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center h-24">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : dailyEvents.length > 0 ? dailyEvents.map((event, index) => {
                  const client = getClientById(event.clientId);
                  const grandTotal = calculateGrandTotal(event);
                  return (
                    <TableRow key={`${event.orderId}-${index}`}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{event.orderId}</TableCell>
                      <TableCell className="font-medium">{client?.companyName || "N/A"}</TableCell>
                      <TableCell className="font-mono text-xs">{event.proformaId || "N/A"}</TableCell>
                      <TableCell>{event.mealType}</TableCell>
                      <TableCell className="text-center">{event.numberOfPeople}</TableCell>
                      <TableCell className="text-right">{formatCurrency(event.unitPrice)}</TableCell>
                      <TableCell className="capitalize">{event.vatType}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(grandTotal)}</TableCell>
                    </TableRow>
                  )
                }) : (
                  <TableRow>
                      <TableCell colSpan={9} className="text-center h-24">No orders found for this date.</TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={8} className="text-right font-bold text-lg">Total Sales for the Day</TableCell>
                  <TableCell className="text-right font-bold text-lg text-primary">{formatCurrency(totalSales)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
    </div>
  );
};
