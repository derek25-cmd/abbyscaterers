
"use client";

import React from 'react';
import { ProformaInvoiceForm } from "@/components/proforma-invoices/proforma-invoice-form";
import { useSearchParams } from 'next/navigation';

export function NewProformaInvoicePageComponent() {
    const searchParams = useSearchParams();
    const clientId = searchParams.get('clientId');

    return <ProformaInvoiceForm clientId={clientId ?? undefined} />;
}
