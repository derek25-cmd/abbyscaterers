
"use client";

import { ProformaInvoiceForm } from "@/components/proforma-invoices/proforma-invoice-form";
import { useParams } from 'next/navigation';

export default function EditProformaInvoicePage() {
    const params = useParams();
    const invoiceId = typeof params.id === 'string' ? params.id : undefined;
    return <ProformaInvoiceForm invoiceId={invoiceId} />;
}
