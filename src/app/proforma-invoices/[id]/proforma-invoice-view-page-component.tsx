
"use client";

import { useEffect, useState } from "react";
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
import type { UserOptions } from 'jspdf-autotable';
import { useSettingsStorage } from "@/hooks/use-settings-storage";
import { format, parseISO } from 'date-fns';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}

const convertToWords = (amount: number): string => {
    if (amount < 0) return 'Negative amounts are not supported';
    if (amount === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const thousands = ['', 'Thousand', 'Million', 'Billion'];
    function convertChunk(num: number): string {
        let result = '';
        if (num >= 100) {
            result += ones[Math.floor(num / 100)] + ' Hundred ';
            num %= 100;
        }
        if (num >= 20) {
            result += tens[Math.floor(num / 10)] + ' ';
            num %= 10;
        } else if (num >= 10) {
            result += teens[num - 10] + ' ';
            return result.trim();
        }
        if (num > 0) {
            result += ones[num] + ' ';
        }
        return result.trim();
    }
    let numStr = Math.floor(amount).toString();
    let chunkCount = 0;
    let result = '';
    while (numStr.length > 0) {
        const chunk = numStr.slice(-3);
        numStr = numStr.slice(0, -3);
        const chunkNum = parseInt(chunk);
        if (chunkNum !== 0) {
            let chunkWords = convertChunk(chunkNum);
            if (chunkCount > 0) {
                chunkWords += ' ' + thousands[chunkCount];
            }
            result = chunkWords + ' ' + result;
        }
        chunkCount++;
    }
    return result.trim();
};


export function ProformaInvoiceViewPageComponent() {
  const params = useParams();
  const router = useRouter();
  const { getProformaById, deleteProformaInvoice, isLoading: proformasLoading } = useProformaInvoiceStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const { addInvoice } = useInvoiceStorage();
  const { toast } = useToast();
  const { settings } = useSettingsStorage();

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
    if (!invoice || !client) {
        toast({ variant: 'destructive', title: 'Error', description: 'Invoice data not loaded yet.' });
        return;
    }
    setExporting(true);

    const formatCurrency = (amount: number) => {
        if (typeof amount !== 'number') return 'N/A';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
    }

    try {
        const { default: jsPDF } = await import('jspdf');
        await import('jspdf-autotable');

        const doc = new jsPDF() as jsPDFWithAutoTable;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;

        const addHeaderAndFooter = () => {
            if (settings.headerUrl) {
                doc.addImage(settings.headerUrl, 'PNG', margin, 10, pageWidth - margin * 2, 20);
            }
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('PROFORMA INVOICE', pageWidth - margin, 45, { align: 'right' });
            if (settings.footerUrl) {
                doc.addImage(settings.footerUrl, 'PNG', margin, pageHeight - 30, pageWidth - margin * 2, 20);
            }
        };

        addHeaderAndFooter();

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Date: ${format(parseISO(invoice.invoiceDate), 'do MMMM yyyy')}`, pageWidth - margin, 50, { align: 'right' });
        doc.text(`Invoice No.: ${invoice.id}`, pageWidth - margin, 55, { align: 'right' });

        doc.text(`To:`, margin, 65);
        let toY = 70;
        [invoice.receiverName, invoice.receiverPosition, client.companyName, client.address1, client.address2, invoice.lpoNumber ? `LPO No.: ${invoice.lpoNumber}` : ''].filter(Boolean).forEach(line => {
            if (line) {
              doc.text(line, margin, toY);
              toY += 5;
            }
        });

        if (invoice.serviceDesc) {
            doc.setFont('helvetica', 'italic');
            doc.text(invoice.serviceDesc, pageWidth / 2, toY + 10, { align: 'center', maxWidth: pageWidth - margin * 2 });
            doc.setFont('helvetica', 'normal');
        }

        const subtotal = invoice.items.reduce((sum, item) => sum + (item.total || 0), 0);
        const totalForDays = invoice.multiplyByDays ? subtotal * (invoice.numberOfDays || 1) : subtotal;
        const totalBeforeVat = totalForDays + (invoice.serviceCharge || 0) + (invoice.transportCosts || 0);
        const vat = invoice.vatType === 'exclusive' ? totalBeforeVat * 0.18 : 0;
        const grandTotal = totalBeforeVat + vat;

        const tableBody = invoice.items.map((item, index) => [
            index + 1,
            item.pax,
            item.id,
            item.particularDescription || 'N/A',
            formatCurrency(item.unitPrice),
            formatCurrency(item.total)
        ]);

        let finalY = 0;
        doc.autoTable({
            startY: toY + 20,
            head: [['S/No.', 'QTY', 'Order ID', 'PARTICULARS', 'UNIT PRICE (TSHS)', 'TOTAL (TSHS)']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [221, 221, 221], textColor: 20 },
            didDrawPage: addHeaderAndFooter,
            didParseCell: data => {
                if (data.section === 'head' || data.section === 'body') {
                    if (data.column.index > 3) data.cell.styles.halign = 'right';
                    if (data.column.index === 0 || data.column.index === 1) data.cell.styles.halign = 'center';
                }
            },
            willDrawCell: data => {
              if (data.section === 'body' && data.column.index === 3) data.cell.styles.halign = 'left';
            }
        });

        finalY = (doc as any).lastAutoTable.finalY;
        
        doc.autoTable({
            startY: finalY + 1,
            body: [
                ['Sub-Total (TSHS)', formatCurrency(subtotal)],
                ...(invoice.multiplyByDays ? [['No of days', invoice.numberOfDays], ['TOTAL (TSHS)', formatCurrency(totalForDays)]] : []),
                ['Add Service Charge (TSHS)', formatCurrency(invoice.serviceCharge || 0)],
                ['Add Transportation Costs (TSHS)', formatCurrency(invoice.transportCosts || 0)],
                ['Total Before VAT (TSHS)', formatCurrency(totalBeforeVat)],
                ['Add VAT 18% (TSHS)', vat > 0 ? formatCurrency(vat) : 'Inclusive'],
                [{ content: 'GRAND TOTAL (TSHS)', styles: { fontStyle: 'bold' } }, { content: formatCurrency(grandTotal), styles: { fontStyle: 'bold' } }]
            ],
            theme: 'grid',
            columnStyles: { 0: { halign: 'right' }, 1: { halign: 'right' } },
            margin: { left: pageWidth - margin - 80 },
        });

        finalY = (doc as any).lastAutoTable.finalY;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Amount in Words:', margin, finalY + 10);
        doc.setFont('helvetica', 'italic');
        doc.text(`Tanzania Shillings ${convertToWords(grandTotal)} only.`, margin + 35, finalY + 10);

        doc.save(`proforma_${invoice.id}.pdf`);
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
        <ProformaInvoiceTemplate invoiceData={invoice} client={client}/>
    </>
  );
}
