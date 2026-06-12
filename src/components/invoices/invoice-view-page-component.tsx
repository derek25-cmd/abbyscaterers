
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
  const [preserveSpace, setPreserveSpace] = useState(false);
  const [showFooterOnly, setShowFooterOnly] = useState(false);

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
    const cardElement = document.getElementById('invoice-pdf-content');
    if (!cardElement) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not find invoice content to export.' });
      return;
    }
    setExporting(true);

    const CARD_RENDER_WIDTH = 910;
    const pdfScale = settings.pdfScale || 2.0;
    const TARGET_CANVAS_WIDTH = CARD_RENDER_WIDTH * pdfScale;

    const savedStyle = cardElement.style.cssText;
    cardElement.style.width = `${CARD_RENDER_WIDTH}px`;
    cardElement.style.minWidth = `${CARD_RENDER_WIDTH}px`;
    cardElement.style.maxWidth = `${CARD_RENDER_WIDTH}px`;
    cardElement.style.boxSizing = 'border-box';
    await new Promise(res => setTimeout(res, 50));

    try {
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 30;
      const marginTop = (showHeaders || preserveSpace) ? 20 : 11;
      const marginBottom = 5;
      const usableWidth = pageWidth - (marginX * 2);
      const usablePageHeight = pageHeight - marginTop - marginBottom;

      // Measure break positions relative to the card after resize
      const cardTop = cardElement.getBoundingClientRect().top;
      const cardScrollH = cardElement.scrollHeight;
      const rawDomPositions: Array<{ top: number; bottom: number }> = [];
      cardElement.querySelectorAll('tr, [data-pdf-no-break]').forEach(el => {
        const rect = el.getBoundingClientRect();
        const relTop    = rect.top    - cardTop;
        const relBottom = rect.bottom - cardTop;
        if (relBottom > relTop && relTop >= -5) {
          rawDomPositions.push({ top: Math.max(0, relTop), bottom: relBottom });
        }
      });

      const scale = TARGET_CANVAS_WIDTH / Math.max(cardElement.scrollWidth, 1);
      const canvas = await html2canvas(cardElement, { scale, useCORS: true, logging: false, allowTaint: true });
      cardElement.style.cssText = savedStyle;

      const cardImgHeight = (canvas.height * usableWidth) / canvas.width;
      const pxPerPt = canvas.width / usableWidth;
      const actualVerticalScale = canvas.height / cardScrollH;

      const breakIntervals = rawDomPositions.map(({ top, bottom }) => ({
        top:    (top    * actualVerticalScale) / pxPerPt,
        bottom: (bottom * actualVerticalScale) / pxPerPt,
      }));

      let yOffset = 0;
      let pageNumber = 1;

      while (yOffset < cardImgHeight) {
        if (pageNumber > 1) pdf.addPage();

        const remaining = cardImgHeight - yOffset;
        let sliceHeight = Math.min(usablePageHeight, remaining);

        if (remaining > usablePageHeight) {
          const rawCutY = yOffset + usablePageHeight;
          let adjustedCutY = rawCutY;

          for (const { top, bottom } of breakIntervals) {
            if (top > yOffset && top < rawCutY && bottom > rawCutY) {
              adjustedCutY = Math.min(adjustedCutY, top);
            }
          }

          const adjusted = adjustedCutY - yOffset;
          if (adjusted >= 1) sliceHeight = adjusted;
        }

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width  = canvas.width;
        sliceCanvas.height = Math.ceil(sliceHeight * pxPerPt);
        const sliceCtx = sliceCanvas.getContext('2d');
        if (sliceCtx) {
          sliceCtx.drawImage(
            canvas,
            0, Math.floor(yOffset * pxPerPt),
            canvas.width, sliceCanvas.height,
            0, 0,
            sliceCanvas.width, sliceCanvas.height,
          );
          pdf.addImage(sliceCanvas.toDataURL('image/png', 1.0), 'PNG', marginX, marginTop, usableWidth, sliceHeight);
        }

        yOffset += sliceHeight;
        pageNumber++;
      }

      pdf.save(`invoice_${invoice?.id}.pdf`);
      toast({ title: 'Success', description: 'Invoice exported as PDF.' });
    } catch (error) {
      cardElement.style.cssText = savedStyle;
      console.error('PDF Export Error:', error);
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
          <div>
            <h1 className="text-2xl font-bold text-primary">Invoice Preview</h1>
            <div className="mt-2 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document Layout</p>
                <div className="flex items-start gap-2">
                    <Switch id="show-headers" checked={showHeaders} onCheckedChange={(v) => { setShowHeaders(v); if (v) { setPreserveSpace(false); setShowFooterOnly(false); } }} className="mt-0.5" />
                    <div>
                        <Label htmlFor="show-headers" className="text-sm font-medium leading-none flex items-center gap-1">
                            {showHeaders ? <Eye className="w-3.5 h-3.5"/> : <EyeOff className="w-3.5 h-3.5"/>} Header &amp; Footer
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Include the standard company header and footer images</p>
                    </div>
                </div>
                {!showHeaders && (
                    <div className="ml-6 space-y-2 border-l-2 border-muted pl-3">
                        <div className="flex items-start gap-2">
                            <Switch id="preserve-space" checked={preserveSpace} onCheckedChange={(v) => { setPreserveSpace(v); if (v) setShowFooterOnly(false); }} className="mt-0.5" />
                            <div>
                                <Label htmlFor="preserve-space" className="text-sm font-medium leading-none">Preserve Space</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">Leave blank space for printing on official letterhead</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Switch id="show-footer-only" checked={showFooterOnly} onCheckedChange={(v) => { setShowFooterOnly(v); if (v) setPreserveSpace(false); }} className="mt-0.5" />
                            <div>
                                <Label htmlFor="show-footer-only" className="text-sm font-medium leading-none">Footer Only</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">Include only the footer image, no header space</p>
                            </div>
                        </div>
                    </div>
                )}
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
            <InvoiceTemplate invoiceData={invoice} client={client} showHeaders={showHeaders} preserveSpace={preserveSpace} showFooterOnly={showFooterOnly} />
        </div>
    </>
  );
}
