
"use client";

import React from 'react';
import { ProformaInvoiceForm } from "@/components/proforma-invoices/proforma-invoice-form";
import { useSearchParams } from 'next/navigation';

export default function NewProformaInvoicePage() {
    const searchParams = useSearchParams();
    const clientId = searchParams.get('clientId');

    // Check if component has mounted to avoid SSR issues
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    return <ProformaInvoiceForm clientId={clientId ?? undefined} />;
}
