
"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { InvoiceTemplate } from "@/components/invoices/invoice-template";
import type { Invoice, Client } from "@/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, Edit, Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSettingsStorage } from "@/hooks/use-settings-storage";

export function InvoiceViewPageComponent() {
  const params = useParams();
  const router = useRouter();
  const { getInvoiceById, deleteInvoice, isLoading: invoicesLoading } = useInvoiceStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const { toast } = useToast();
  const { settings } = useSettingsStorage();
  const printRef = useRef<HTMLDivElement>(null);


  const [invoice, setInvoice] = useState<Invoice | undefined>(undefined);
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const invoiceId = typeof params.id === 'string' ? params.id : undefined;

  useEffect(() => {
    if (invoicesLoading || clientsLoading) return;

    if (!invoiceId) {
        setError("Invalid invoice ID.");
        return;
    }

    const foundInvoice = getInvoiceById(invoiceId);
    if (foundInvoice) {
        setInvoice(foundInvoice);
        if (foundInvoice.clientId) {
            const foundClient = getClientById(foundInvoice.clientId);
            setClient(foundClient);
        }
    } else {
        setError("Invoice not found.");
    }
  }, [invoiceId, getInvoiceById, getClientById, invoicesLoading, clientsLoading]);

  const handleExportPDF = async () => {
      if (!printRef.current) {
          toast({ variant: 'destructive', title: 'Error', description: 'Invoice template not loaded yet.' });
          return;
      }
      setExporting(true);

      try {
          const { default: jsPDF } = await import('jspdf');
          const { default: html2canvas } = await import('html2canvas');
          
          const canvas = await html2canvas(printRef.current, {
            scale: 2, // Increase resolution
            useCORS: true,
          });

          const imgData = canvas.toDataURL('image/png');
          
          const pdf = new jsPDF({
              orientation: 'p',
              unit: 'mm',
              format: 'a4'
          });

          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const imgProps = pdf.getImageProperties(imgData);
          const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          let heightLeft = imgHeight;
          let position = 0;

          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfHeight;

          while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
          }

          pdf.save(`invoice_${invoice.id}.pdf`);
          toast({ title: 'Success', description: 'Invoice exported as PDF.' });

      } catch (error) {
          console.error("PDF Export Error:", error);
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to export PDF.' });
      }
      setExporting(false);
  };
  
  const handleDelete = () => {
    if(invoiceId) {
        deleteInvoice(invoiceId);
        toast({ title: "Invoice Deleted", description: "The invoice has been successfully deleted." });
        router.push('/invoices');
    }
  }

  if (invoicesLoading || clientsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading invoice data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href="/invoices">Go to Invoices</Link>
        </Button>
      </div>
    );
  }

  if (!invoice || !client) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Invoice Not Found</h2>
        <p className="text-muted-foreground mb-6">The requested invoice could not be found.</p>
        <Button asChild>
          <Link href="/invoices">Go to Invoices</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-primary">Invoice Preview</h1>
          <div className="space-x-2 flex flex-wrap">
            <Button variant="outline" onClick={() => router.push(`/invoices/${invoiceId}/edit`)}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin mr-2"/> : <Download className="w-4 h-4 mr-2" />}
              {exporting ? "Exporting..." : "Export PDF"}
            </Button>
          </div>
        </div>
        <div ref={printRef}>
            <InvoiceTemplate invoiceData={invoice} client={client}/>
        </div>
    </>
  );
}
