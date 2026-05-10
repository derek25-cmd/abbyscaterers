"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { useProformaInvoiceStorage } from "@/hooks/use-proforma-invoice-storage";
import { InvoiceTemplate } from "@/components/invoices/invoice-template";
import { ProformaInvoiceTemplate } from "@/components/proforma-invoices/proforma-invoice-template";
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
import { PaymentStatusDialog, PaymentStatusFormData } from "@/components/invoices/payment-status-dialog";
import { ExportDocumentDialog } from "@/components/proforma-invoices/export-document-dialog";
import { CheckCircle2 } from "lucide-react";

export function InvoiceViewPageComponent() {
  const params = useParams();
  const router = useRouter();
  const { getInvoiceById, deleteInvoice, isLoading: invoicesLoading } = useInvoiceStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const { getProformaById, isLoading: proformasLoading } = useProformaInvoiceStorage();
  const { updateInvoice } = useInvoiceStorage();
  const { toast } = useToast();
  const { settings } = useSettingsStorage();
  const printRef = useRef<HTMLDivElement>(null);


  const [invoice, setInvoice] = useState<Invoice | undefined>(undefined);
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showHeaders, setShowHeaders] = useState(true);
  const [preserveSpace, setPreserveSpace] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [proformaShowHeaders, setProformaShowHeaders] = useState(true);
  const [proformaPreserveSpace, setProformaPreserveSpace] = useState(false);

  const calculateTotal = () => {
      if (!invoice) return 0;
      const subtotal = invoice.items.reduce((sum, item) => sum + (item.total || 0), 0);
      const totalForDays = invoice.multiplyByDays ? subtotal * (invoice.numberOfDays || 1) : subtotal;
      const totalBeforeVAT = totalForDays + (invoice.serviceCharge || 0) + (invoice.transportCosts || 0);
      const vat = invoice.vatType === 'exclusive' ? totalBeforeVAT * 0.18 : 0;
      return totalBeforeVAT + vat;
  };

  const invoiceId = typeof params.id === 'string' ? params.id : undefined;
  const associatedProforma = invoice?.proformaId ? getProformaById(invoice.proformaId) : undefined;

  useEffect(() => {
    if (invoicesLoading || clientsLoading || proformasLoading) return;

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

  const handleExportAction = async (options: {
    proformaOptions: { showHeaders: boolean; preserveSpace: boolean };
    invoiceOptions: { showHeaders: boolean; preserveSpace: boolean };
    exportType: 'single' | 'bundle'
  }) => {
    const isBundle = options.exportType === 'bundle' && !!associatedProforma;
    // From the invoice view: proformaOptions = invoice layout, invoiceOptions = proforma layout
    const invoiceLayout = options.proformaOptions;
    const proformaLayout = options.invoiceOptions;

    const wasHeaders = showHeaders;
    const wasSpace = preserveSpace;
    const wasProformaHeaders = proformaShowHeaders;
    const wasProformaSpace = proformaPreserveSpace;

    setShowHeaders(invoiceLayout.showHeaders);
    setPreserveSpace(invoiceLayout.preserveSpace);
    if (isBundle) {
      setProformaShowHeaders(proformaLayout.showHeaders);
      setProformaPreserveSpace(proformaLayout.preserveSpace);
    }

    await new Promise(res => setTimeout(res, 50));
    setExporting(true);

    const pdfScale = settings.pdfScale || 2.0;
    // Fixed target canvas width ensures consistent font sizes across all screen sizes.
    // html2canvas uses the element's current rendered width, which varies with viewport.
    // Pinning canvas width to this constant makes text size in PDF screen-independent.
    const TARGET_CANVAS_WIDTH = 1000 * pdfScale;

    try {
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 30;
      const marginTop = 20;
      const marginBottom = 5;
      const usableWidth = pageWidth - (marginX * 2);

      const generatePageGroup = async (
        prefix: string,
        pageNumberOffset: number,
        layout: { showHeaders: boolean; preserveSpace: boolean }
      ) => {
        if (isBundle) {
          if (prefix === 'invoice') {
            setShowHeaders(layout.showHeaders);
            setPreserveSpace(layout.preserveSpace);
          } else {
            setProformaShowHeaders(layout.showHeaders);
            setProformaPreserveSpace(layout.preserveSpace);
          }
          await new Promise(res => setTimeout(res, 60));
        }

        const headerElement = document.getElementById(`${prefix}-header`);
        const contentElement = document.getElementById(`${prefix}-main-content`);
        const footerElement = document.getElementById(`${prefix}-footer`);

        if (!contentElement || !headerElement || !footerElement) {
          throw new Error(`Could not find required parts for ${prefix}`);
        }

        const scale = TARGET_CANVAS_WIDTH / contentElement.scrollWidth;
        const canvasOpts = { scale, useCORS: true, logging: false, allowTaint: true };

        const headerCanvas = await html2canvas(headerElement, canvasOpts);
        const contentCanvas = await html2canvas(contentElement, canvasOpts);
        const footerCanvas = await html2canvas(footerElement, canvasOpts);

        const headerHeight = (headerCanvas.height * usableWidth) / headerCanvas.width;
        const footerHeight = (footerCanvas.height * usableWidth) / footerCanvas.width;
        const usableContentHeight = pageHeight - headerHeight - footerHeight - marginTop - marginBottom;
        const contentImgHeight = (contentCanvas.height * usableWidth) / contentCanvas.width;

        const headerDataURL = headerCanvas.toDataURL('image/png', 1.0);
        const footerDataURL = footerCanvas.toDataURL('image/png', 1.0);

        let yOffset = 0;
        let pageNumber = pageNumberOffset;

        while (yOffset < contentImgHeight) {
          if (pageNumber > 1) pdf.addPage();

          if (layout.showHeaders) {
            pdf.addImage(headerDataURL, 'PNG', marginX, marginTop, usableWidth, headerHeight);
          }

          const sliceHeight = Math.min(usableContentHeight, contentImgHeight - yOffset);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = contentCanvas.width;
          sliceCanvas.height = (sliceHeight / usableWidth) * contentCanvas.width;
          const sliceCtx = sliceCanvas.getContext('2d');

          if (sliceCtx) {
            sliceCtx.drawImage(
              contentCanvas,
              0, (yOffset / usableWidth) * contentCanvas.width,
              contentCanvas.width, sliceCanvas.height,
              0, 0,
              sliceCanvas.width, sliceCanvas.height
            );
            pdf.addImage(
              sliceCanvas.toDataURL('image/png', 1.0),
              'PNG',
              marginX,
              marginTop + ((layout.showHeaders || layout.preserveSpace) ? headerHeight : 0),
              usableWidth,
              sliceHeight
            );
          }

          if (layout.showHeaders) {
            pdf.addImage(footerDataURL, 'PNG', marginX, pageHeight - footerHeight - marginBottom, usableWidth, footerHeight);
          }

          yOffset += sliceHeight;
          pageNumber++;
        }
        return pageNumber;
      };

      let nextPage = await generatePageGroup('invoice', 1, invoiceLayout);
      if (isBundle) {
        await generatePageGroup('proforma', nextPage, proformaLayout);
      }

      const safeClientName = client?.companyName || 'Client';
      if (isBundle) {
        pdf.save(`BUNDLE - INV-${invoice?.id} and PI-${associatedProforma.id} - ${safeClientName}.pdf`);
      } else {
        pdf.save(`INV-${invoice?.id} - ${safeClientName} - at ${invoice?.invoiceDate}.pdf`);
      }
      toast({ title: 'Success', description: 'Invoice exported as PDF.' });
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to export PDF.' });
    } finally {
      setExporting(false);
      setIsExportDialogOpen(false);
      setShowHeaders(wasHeaders);
      setPreserveSpace(wasSpace);
      setProformaShowHeaders(wasProformaHeaders);
      setProformaPreserveSpace(wasProformaSpace);
    }
  };

  const handleUpdatePaymentStatus = async (data: PaymentStatusFormData) => {
      if (!invoice) return;
      setIsUpdatingPayment(true);
      try {
          const success = await updateInvoice(invoice.id, {
              status: data.status,
              amountPaid: data.amountPaid,
              paymentDate: data.paymentDate
          });
          if (success) {
              toast({ title: "Status Updated", description: "Invoice payment status has been updated." });
              setIsPaymentDialogOpen(false);
              setInvoice({ ...invoice, ...data });
          } else {
              toast({ variant: "destructive", title: "Update Failed", description: "Could not update payment status." });
          }
      } catch(e) {
          toast({ variant: "destructive", title: "Error", description: "An error occurred." });
      } finally {
          setIsUpdatingPayment(false);
      }
  };

  const handleDelete = () => {
    if(invoiceId) {
        deleteInvoice(invoiceId);
        toast({ title: "Invoice Deleted", description: "The invoice has been successfully deleted." });
        router.push('/invoices');
    }
  }

  if (invoicesLoading || clientsLoading || proformasLoading) {
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
                {!showHeaders && (
                  <div className="flex items-center space-x-2 border-l pl-4 ml-4">
                      <Switch id="preserve-space" checked={preserveSpace} onCheckedChange={setPreserveSpace} />
                      <Label htmlFor="preserve-space" className="text-sm text-muted-foreground">
                          Preserve Space (for Letterhead)
                      </Label>
                  </div>
                )}
            </div>
          </div>
          <div className="space-x-2 flex flex-wrap">
            <Button variant="secondary" onClick={() => setIsPaymentDialogOpen(true)}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Update Status
            </Button>
            <Button variant="outline" onClick={() => router.push(`/invoices/${invoiceId}/edit`)}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(true)} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin mr-2"/> : <Download className="w-4 h-4 mr-2" />}
              {exporting ? "Exporting..." : "Export PDF"}
            </Button>
          </div>
        </div>
        
        {invoice && (
            <PaymentStatusDialog
                 isOpen={isPaymentDialogOpen}
                 setIsOpen={setIsPaymentDialogOpen}
                 onSubmit={handleUpdatePaymentStatus}
                 isUpdating={isUpdatingPayment}
                 currentStatus={invoice.status}
                 currentAmountPaid={invoice.amountPaid || 0}
                 totalAmount={calculateTotal()}
            />
        )}
        
        <div ref={printRef}>
            <InvoiceTemplate invoiceData={invoice} client={client} showHeaders={showHeaders} preserveSpace={preserveSpace} />
        </div>

        {associatedProforma && (
          <div className="absolute opacity-0 pointer-events-none" style={{ zIndex: -50, top: -10000, width: '1000px' }}>
            <ProformaInvoiceTemplate invoiceData={associatedProforma} client={client} showHeaders={proformaShowHeaders} preserveSpace={proformaPreserveSpace} />
          </div>
        )}

        <ExportDocumentDialog
           isOpen={isExportDialogOpen}
           setIsOpen={setIsExportDialogOpen}
           onExport={handleExportAction}
           isExporting={exporting}
           hasAssociatedInvoice={!!associatedProforma}
           docType="invoice"
        />
    </>
  );
}
