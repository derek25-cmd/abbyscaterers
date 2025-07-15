
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import type { Invoice, Client } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function InvoiceViewPageComponent() {
  const params = useParams();
  const router = useRouter();
  const { getInvoiceById, isLoading: invoicesLoading } = useInvoiceStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();

  const [invoice, setInvoice] = useState<Invoice | undefined>(undefined);
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

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

  if (!invoice) {
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

  // Convert Invoice to InvoiceFormData for the preview component
  const formData = {
      ...invoice,
  };

  return (
    <InvoicePreview
      formData={formData}
      client={client}
      onDismiss={() => router.push(`/invoices/${invoice.id}/edit`)}
      onSave={() => router.push(`/invoices/${invoice.id}/edit`)} // In view-only, save/edit do same thing
      isSaving={false}
    />
  );
}
