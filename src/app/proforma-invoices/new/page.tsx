
"use client";

import { ProformaInvoiceForm } from "@/components/proforma-invoices/proforma-invoice-form";
import { useSearchParams } from 'next/navigation';

export default function NewProformaInvoicePage() {
    const searchParams = useSearchParams();
    const clientId = searchParams.get('clientId');

    return <ProformaInvoiceForm clientId={clientId ?? undefined} />;
}
