"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { InvoiceTemplate } from "@/components/invoices/invoice-template";
import type { Invoice, Client } from "@/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, Edit, Download, Trash2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSettingsStorage } from "@/hooks/use-settings-storage";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
  const [showHeaders, setShowHeaders] = useState(true);

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
    const headerElement = document.getElementById('invoice-header');
    const contentElement = document.getElementById('invoice-main-content');
    const footerElement = document.getElementById('invoice-footer');

    if (!contentElement || !headerElement || !footerElement) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not find all required parts of the invoice to export.',
      });
      return;
    }
    setExporting(true);

    const pdfScale = settings.pdfScale || 2.0;

    try {
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 30;
      const marginTop = 20;
      const marginBottom = 5;
      const usableWidth = pageWidth - (marginX * 2);

      const canvasOpts = { 
          scale: pdfScale, 
          useCORS: true,
          logging: false,
          allowTaint: true
      };

      const headerCanvas = await html2canvas(headerElement, canvasOpts);
      const contentCanvas = await html2canvas(contentElement, canvasOpts);
      const footerCanvas = await html2canvas(footerElement, canvasOpts);
      
      const headerHeight = (headerCanvas.height * usableWidth) / headerCanvas.width;
      const footerHeight = (footerCanvas.height * usableWidth) / footerCanvas.width;
      const usableContentHeight = pageHeight - headerHeight - footerHeight - marginTop - marginBottom;

      const contentImgHeight = (contentCanvas.height * usableWidth) / contentCanvas.width;
      
      const contentDataURL = contentCanvas.toDataURL('image/png', 1.0);
      const headerDataURL = headerCanvas.toDataURL('image/png', 1.0);
      const footerDataURL = footerCanvas.toDataURL('image/png', 1.0);

      let yOffset = 0;
      let pageNumber = 1;

      while (yOffset < contentImgHeight) {
        if (pageNumber > 1) {
          pdf.addPage();
        }

        if (showHeaders) {
            pdf.addImage(headerDataURL, 'PNG', marginX, marginTop, usableWidth, headerHeight);
        }

        const sliceHeight = Math.min(usableContentHeight, contentImgHeight - yOffset);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = contentCanvas.width;
        tempCanvas.height = (sliceHeight / usableWidth) * contentCanvas.width;
        const tempCtx = tempCanvas.getContext('2d');

        if (tempCtx) {
          tempCtx.drawImage(
            contentCanvas,
            0,
            (yOffset / usableWidth) * contentCanvas.width, // sourceY
            contentCanvas.width,
            tempCanvas.height,
            0,
            0,
            tempCanvas.width,
            tempCanvas.height
          );
          pdf.addImage(
            tempCanvas.toDataURL('image/png', 1.0),
            'PNG',
            marginX,
            marginTop + (showHeaders ? headerHeight : 0),
            usableWidth,
            sliceHeight
          );
        }
        
        if (showHeaders) {
             pdf.addImage(footerDataURL, 'PNG', marginX, pageHeight - footerHeight - marginBottom, usableWidth, footerHeight);
        }
        
        yOffset += sliceHeight;
        pageNumber++;
      }

      pdf.save(`invoice_${invoice?.id}.pdf`);
      toast({ title: 'Success', description: 'Invoice exported as PDF.' });
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to export PDF.',
      });
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
          <div>
            <h1 className="text-2xl font-bold text-primary">Invoice Preview</h1>
            <div className="flex items-center space-x-2 mt-2">
                <Switch id="show-headers" checked={showHeaders} onCheckedChange={setShowHeaders} />
                <Label htmlFor="show-headers" className="text-sm text-muted-foreground flex items-center">
                    {showHeaders ? <Eye className="w-4 h-4 mr-1"/> : <EyeOff className="w-4 h-4 mr-1"/>}
                    Show Header &amp; Footer
                </Label>
            </div>
          </div>
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
            <InvoiceTemplate invoiceData={invoice} client={client} showHeaders={showHeaders} />
        </div>
    </>
  );
}
