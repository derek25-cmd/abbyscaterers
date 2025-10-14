
"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProformaInvoiceStorage } from "@/hooks/use-proforma-invoice-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { ProformaInvoiceTemplate } from "@/components/proforma-invoices/proforma-invoice-template";
import type { ProformaInvoice, Client } from "@/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, Edit, Download, Trash2, FileCheck, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useSettingsStorage } from "@/hooks/use-settings-storage";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export function ProformaInvoiceViewPageComponent() {
  const params = useParams();
  const router = useRouter();
  const { getProformaById, deleteProformaInvoice, isLoading: proformasLoading } = useProformaInvoiceStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const { addInvoice } = useInvoiceStorage();
  const { toast } = useToast();
  const { settings } = useSettingsStorage();
  const printRef = useRef<HTMLDivElement>(null);

  const [invoice, setInvoice] = useState<ProformaInvoice | undefined>(undefined);
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  const invoiceId = typeof params.id === 'string' ? params.id : undefined;
  
  const isLocked = invoice?.isInvoiced && !isUnlocked;

  useEffect(() => {
    if (proformasLoading || clientsLoading) return;

    if (!invoiceId) {
        setError("Invalid proforma invoice ID.");
        return;
    }

    const foundInvoice = getProformaById(invoiceId);
    if (foundInvoice) {
        setInvoice(foundInvoice);
        if (foundInvoice.clientId) {
            const foundClient = getClientById(foundInvoice.clientId);
            setClient(foundClient);
        }
    } else {
        setError("Proforma invoice not found.");
    }
  }, [invoiceId, getProformaById, getClientById, proformasLoading, clientsLoading]);
  
  const handleUnlock = () => {
      if (passcode === "Abbys") {
          setIsUnlocked(true);
          toast({ title: "Unlocked", description: "Proforma invoice is now available for editing." });
      } else {
          toast({ variant: "destructive", title: "Incorrect Passcode", description: "The passcode you entered is incorrect." });
      }
      setPasscode("");
  };


  const handleExportPDF = async () => {
    const headerElement = document.getElementById('proforma-header');
    const contentElement = document.getElementById('proforma-main-content');
    const footerElement = document.getElementById('proforma-footer');
    
    if (!contentElement || !headerElement || !footerElement) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not find all required parts of the proforma to export.' });
        return;
    }
    setExporting(true);

    try {
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const marginX = 30;
        const marginTop = 20;
        const marginBottom = 5;
        const usableWidth = pageWidth - (marginX * 2);

        // Capture header, content, and footer
        const headerCanvas = await html2canvas(headerElement, { scale: 2 });
        const contentCanvas = await html2canvas(contentElement, { scale: 2 });
        const footerCanvas = await html2canvas(footerElement, { scale: 2 });

        const headerHeight = (headerCanvas.height * usableWidth) / headerCanvas.width;
        const footerHeight = (footerCanvas.height * usableWidth) / footerCanvas.width;
        const usableContentHeight = pageHeight - headerHeight - footerHeight - marginTop - marginBottom;

        const contentImgHeight = (contentCanvas.height * usableWidth) / contentCanvas.width;

        const contentDataURL = contentCanvas.toDataURL('image/png');
        const headerDataURL = headerCanvas.toDataURL('image/png');
        const footerDataURL = footerCanvas.toDataURL('image/png');

        let yOffset = 0;
        let pageNumber = 1;

        while (yOffset < contentImgHeight) {
            if (pageNumber > 1) {
                pdf.addPage();
            }

            // Add header
            pdf.addImage(headerDataURL, 'PNG', marginX, marginTop, usableWidth, headerHeight);
            
            // Add footer
            pdf.addImage(footerDataURL, 'PNG', marginX, pageHeight - footerHeight - marginBottom, usableWidth, footerHeight);

            // Calculate the height of the slice for the current page
            const sliceCanvas = document.createElement('canvas');
            const sliceHeight = Math.min(usableContentHeight, contentImgHeight - yOffset);
            sliceCanvas.width = contentCanvas.width;
            sliceCanvas.height = (sliceHeight / usableWidth) * contentCanvas.width;

            const sliceCtx = sliceCanvas.getContext('2d');
            if (sliceCtx) {
                sliceCtx.drawImage(
                    contentCanvas,
                    0, // sourceX
                    (yOffset / usableWidth) * contentCanvas.width, // sourceY
                    contentCanvas.width, // sourceWidth
                    sliceCanvas.height, // sourceHeight
                    0, // destX
                    0, // destY
                    sliceCanvas.width, // destWidth
                    sliceCanvas.height // destHeight
                );
            }

            pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', marginX, marginTop + headerHeight, usableWidth, sliceHeight);

            yOffset += sliceHeight;
            pageNumber++;
        }
      
        pdf.save(`proforma_${invoice?.id}.pdf`);
        toast({ title: 'Success', description: 'Proforma invoice exported as PDF.' });

    } catch (error) {
        console.error("PDF Export Error:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to export PDF.' });
    }
    setExporting(false);
  };
  
  const handleDelete = () => {
    if(invoiceId) {
        deleteProformaInvoice(invoiceId);
        toast({ title: "Proforma Invoice Deleted", description: "The proforma invoice has been successfully deleted." });
        router.push('/invoicing/proforma-invoices');
    }
  }

  const handleCreateFinalInvoice = () => {
    if (!invoice) return;
    setIsCreatingInvoice(true);
    try {
        const newInvoiceData = {
            id: `INV-${Date.now()}`,
            proformaId: invoice.id,
            status: 'outstanding' as const,
            invoiceDate: new Date().toISOString(),
            clientId: invoice.clientId,
            receiverName: invoice.receiverName,
            receiverPosition: invoice.receiverPosition,
            lpoNumber: invoice.lpoNumber,
            location: invoice.location,
            numberOfDays: invoice.numberOfDays,
            multiplyByDays: invoice.multiplyByDays,
            serviceCharge: invoice.serviceCharge,
            transportCosts: invoice.transportCosts,
            vatType: invoice.vatType,
            selectedEventType: invoice.selectedEventType,
            customEventType: invoice.customEventType,
            startDate: invoice.startDate,
            endDate: invoice.endDate,
            serviceFields: invoice.serviceFields,
            serviceDesc: invoice.serviceDesc,
            items: invoice.items.map(item => ({ ...item })),
            signedAtDate: new Date().toISOString(),
            signedAtLocation: 'Dar es Salaam'
        };
        const newInvoice = addProformaInvoice(newInvoiceData);
        toast({
            title: "Final Invoice Created",
            description: `Invoice ${newInvoice.id} has been generated successfully.`
        });
        router.push(`/invoices/${newInvoice.id}`);
    } catch(error) {
        console.error("Failed to create final invoice:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "An error occurred while creating the final invoice."
        });
        setIsCreatingInvoice(false);
    }
  }

  if (proformasLoading || clientsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading proforma invoice data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href="/invoicing/proforma-invoices">Go to Proforma Invoices</Link>
        </Button>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Proforma Invoice Not Found</h2>
        <p className="text-muted-foreground mb-6">The requested proforma invoice could not be found.</p>
        <Button asChild>
          <Link href="/invoicing/proforma-invoices">Go to Proforma Invoices</Link>
        </Button>
      </div>
    );
  }


  return (
    <>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-primary">Proforma Invoice Preview</h1>
          <div className="space-x-2 flex flex-wrap">
            
            {isLocked && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-700">
                           <Lock className="w-4 h-4 mr-2" /> Unlock for Editing
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Enter Passcode to Edit</AlertDialogTitle>
                            <AlertDialogDescription>
                               This proforma has been invoiced and is locked. Please enter the admin passcode to make changes.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Input 
                            type="password" 
                            placeholder="Enter passcode..."
                            value={passcode}
                            onChange={(e) => setPasscode(e.target.value)}
                         />
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setPasscode('')}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleUnlock}>Unlock</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
            
            <Button variant="outline" onClick={() => router.push(`/proforma-invoices/${invoiceId}/edit`)} disabled={isLocked}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin mr-2"/> : <Download className="w-4 h-4 mr-2" />}
              {exporting ? "Exporting..." : "Export PDF"}
            </Button>
             <Button onClick={handleCreateFinalInvoice} disabled={!!invoice.isInvoiced || isCreatingInvoice}>
                {isCreatingInvoice ? <Loader2 className="animate-spin mr-2"/> : <FileCheck className="w-4 h-4 mr-2" />}
                {isCreatingInvoice ? "Creating..." : invoice.isInvoiced ? "Already Invoiced" : "Create Final Invoice"}
            </Button>
          </div>
        </div>
        <div ref={printRef}>
          <ProformaInvoiceTemplate invoiceData={invoice} client={client}/>
        </div>
    </>
  );
}
