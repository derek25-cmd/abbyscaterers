
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProformaInvoiceStorage } from "@/hooks/use-proforma-invoice-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { ProformaInvoiceTemplate } from "@/components/proforma-invoices/proforma-invoice-template";
import type { ProformaInvoice, Client } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, Edit, Download, Trash2, FileCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export function ProformaInvoiceViewPageComponent() {
  const params = useParams();
  const router = useRouter();
  const { getProformaById, deleteProformaInvoice, isLoading: proformasLoading } = useProformaInvoiceStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<ProformaInvoice | undefined>(undefined);
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const invoiceId = typeof params.id === 'string' ? params.id : undefined;

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

  const handleExportPDF = async () => {
    setExporting(true);
    const invoiceNode = document.getElementById('proforma-invoice-pdf-content');
    if (invoiceNode) {
        try {
            const canvas = await html2canvas(invoiceNode, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            pdf.save(`proforma_${invoice?.id || 'invoice'}.pdf`);
            toast({ title: 'Success', description: 'Proforma invoice exported as PDF.' });
        } catch (error) {
            console.error("PDF Export Error:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to export PDF.' });
        }
    }
    setExporting(false);
  };
  
  const handleDelete = () => {
    if(invoiceId) {
        deleteProformaInvoice(invoiceId);
        toast({ title: "Proforma Invoice Deleted", description: "The proforma invoice has been successfully deleted." });
        router.push('/proforma-invoices');
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
          <Link href="/proforma-invoices">Go to Proforma Invoices</Link>
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
          <Link href="/proforma-invoices">Go to Proforma Invoices</Link>
        </Button>
      </div>
    );
  }


  return (
    <>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-primary">Proforma Invoice Preview</h1>
          <div className="space-x-2 flex flex-wrap">
            <Button variant="outline" onClick={() => router.push(`/proforma-invoices/${invoiceId}/edit`)}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin mr-2"/> : <Download className="w-4 h-4 mr-2" />}
              {exporting ? "Exporting..." : "Export PDF"}
            </Button>
             <Button onClick={() => router.push(`/invoices/new?fromProforma=${invoiceId}`)}>
                <FileCheck className="w-4 h-4 mr-2" /> Create Final Invoice
            </Button>
          </div>
        </div>
        <ProformaInvoiceTemplate invoiceData={invoice} client={client}/>
    </>
  );
}
