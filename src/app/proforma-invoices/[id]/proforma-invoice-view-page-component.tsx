
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
    const mainContent = document.getElementById('proforma-main-content');
    const headerContent = document.getElementById('proforma-header');
    const footerContent = document.getElementById('proforma-footer');
    
    if (!mainContent || !headerContent || !footerContent) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not find all required parts of the proforma to export.' });
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
        
        let position = 0;
        let contentHeightLeft = contentImgHeight;
        let pageCount = 0;

        const addPageElements = () => {
            pdf.addImage(headerImgData, 'PNG', margin, margin, pageContentWidth, headerImgHeight);
            pdf.addImage(footerImgData, 'PNG', margin, pdfHeight - footerImgHeight - margin, pageContentWidth, footerImgHeight);
        }

        pdf.addPage();
        pageCount++;
        addPageElements();
        
        const contentAreaHeight = pdfHeight - (margin * 2) - headerImgHeight - footerImgHeight;
        
        pdf.addImage(contentImgData, 'PNG', margin, margin + headerImgHeight, pageContentWidth, contentImgHeight);
        contentHeightLeft -= contentAreaHeight;

        while (contentHeightLeft > 0) {
            position -= contentAreaHeight;
            pdf.addPage();
            pageCount++;
            addPageElements();
            pdf.addImage(contentImgData, 'PNG', margin, margin + headerImgHeight + position, pageContentWidth, contentImgHeight);
            contentHeightLeft -= contentAreaHeight;
        }
        
        // Remove the initial blank page
        if(pageCount > 0){
          pdf.deletePage(1);
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
        const newInvoice = addInvoice(newInvoiceData);
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
