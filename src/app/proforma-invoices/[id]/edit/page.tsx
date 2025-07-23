
"use client";

import React from 'react';
import { ProformaInvoiceForm } from "@/components/proforma-invoices/proforma-invoice-form";
import { useParams } from 'next/navigation';

export default function EditProformaInvoicePage() {
    const params = useParams();
    const invoiceId = typeof params.id === 'string' ? params.id : undefined;

    // Check if the component has mounted to avoid SSR issues with useParams
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    return <ProformaInvoiceForm invoiceId={invoiceId} />;
}
