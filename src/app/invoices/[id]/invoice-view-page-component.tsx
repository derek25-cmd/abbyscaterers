
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
    const mainContent = document.getElementById('invoice-main-content');
    const headerContent = document.getElementById('invoice-header');
    const footerContent = document.getElementById('invoice-footer');

    if (!mainContent || !headerContent || !footerContent) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not find all required parts of the invoice to export.' });
        return;
    }
    setExporting(true);

    try {
        const { default: jsPDF } = await import('jspdf');
        const { default: html2canvas } = await import('html2canvas');

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const pageContentWidth = pdfWidth - (margin * 2);

        // --- Render Header ---
        const headerCanvas = await html2canvas(headerContent, { scale: 2, useCORS: true });
        const headerImgData = headerCanvas.toDataURL('image/png');
        const headerImgProps = pdf.getImageProperties(headerImgData);
        const headerImgHeight = (headerImgProps.height * pageContentWidth) / headerImgProps.width;
        
        // --- Render Footer ---
        const footerCanvas = await html2canvas(footerContent, { scale: 2, useCORS: true });
        const footerImgData = footerCanvas.toDataURL('image/png');
        const footerImgProps = pdf.getImageProperties(footerImgData);
        const footerImgHeight = (footerImgProps.height * pageContentWidth) / footerImgProps.width;

        // --- Render Main Content ---
        const contentCanvas = await html2canvas(mainContent, { scale: 2, useCORS: true });
        const contentImgData = contentCanvas.toDataURL('image/png');
        const contentImgProps = pdf.getImageProperties(contentImgData);
        const contentImgHeight = (contentImgProps.height * pageContentWidth) / contentImgProps.width;
        
        let contentHeightLeft = contentImgHeight;
        let position = 0;
        let pageCount = 0;

        const contentAreaHeight = pdfHeight - headerImgHeight - footerImgHeight - (margin * 2);

        while (contentHeightLeft > 0) {
            pageCount++;
            pdf.addPage();
            pdf.setPage(pageCount);

            // Add Header
            pdf.addImage(headerImgData, 'PNG', margin, margin, pageContentWidth, headerImgHeight);

            // Add Content Slice
            pdf.addImage(contentImgData, 'PNG', margin, margin + headerImgHeight, pageContentWidth, contentImgHeight, undefined, 'NONE', 0, position);

            // Add Footer
            pdf.addImage(footerImgData, 'PNG', margin, pdfHeight - footerImgHeight - margin, pageContentWidth, footerImgHeight);

            contentHeightLeft -= contentAreaHeight;
            position += contentAreaHeight;
        }

        // Remove the initial blank page that jsPDF creates
        if (pageCount > 0) {
          pdf.deletePage(1);
        }

        pdf.save(`invoice_${invoice?.id}.pdf`);
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
