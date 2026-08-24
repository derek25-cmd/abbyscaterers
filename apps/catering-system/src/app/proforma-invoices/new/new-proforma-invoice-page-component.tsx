
"use client";

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { ProformaInvoiceForm } from "@/components/proforma-invoices/proforma-invoice-form";

export function NewProformaInvoicePageComponent() {
    const searchParams = useSearchParams();
    const clientId = searchParams.get('clientId');
    const fromRfq = searchParams.get('fromRfq');

    return <ProformaInvoiceForm clientId={clientId ?? undefined} fromRfqId={fromRfq ?? undefined} />;
}
