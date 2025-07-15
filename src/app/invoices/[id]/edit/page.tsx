
"use client";

import { InvoiceForm } from "@/components/invoices/invoice-form";
import { useParams } from 'next/navigation';

export default function EditInvoicePage() {
    const params = useParams();
    const invoiceId = typeof params.id === 'string' ? params.id : undefined;
    return <InvoiceForm invoiceId={invoiceId} />;
}
