import { RequestInvoiceByClient } from '@/components/invoices/request-invoice-by-client';

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Request Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Search a client&apos;s latest proformas and request an invoice from one directly.
        </p>
      </div>
      <RequestInvoiceByClient />
    </div>
  );
}
