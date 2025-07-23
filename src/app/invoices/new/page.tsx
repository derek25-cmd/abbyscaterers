
"use client";

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { InvoiceForm } from "@/components/invoices/invoice-form";

export default function NewInvoicePage() {
    const searchParams = useSearchParams();
    const proformaId = searchParams.get('fromProforma');
    const clientId = searchParams.get('clientId');
    
    // Check if the component has mounted to avoid SSR issues with useSearchParams
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    return <InvoiceForm proformaId={proformaId ?? undefined} clientId={clientId ?? undefined} />;
}
