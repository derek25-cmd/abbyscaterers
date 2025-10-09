
"use client";

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { InvoiceForm } from "@/components/invoices/invoice-form";

export function NewInvoicePageComponent() {
    const searchParams = useSearchParams();
    const proformaId = searchParams.get('fromProforma');
    const clientId = searchParams.get('clientId');
    const bookingId = searchParams.get('bookingId');
    
    return <InvoiceForm proformaId={proformaId ?? undefined} clientId={clientId ?? undefined} bookingId={bookingId ?? undefined} />;
}
