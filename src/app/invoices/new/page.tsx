
"use client";

import { useSearchParams } from 'next/navigation';
import { InvoiceForm } from "@/components/invoices/invoice-form";

export default function NewInvoicePage() {
    const searchParams = useSearchParams();
    const proformaId = searchParams.get('fromProforma');

    return <InvoiceForm proformaId={proformaId ?? undefined} />;
}
