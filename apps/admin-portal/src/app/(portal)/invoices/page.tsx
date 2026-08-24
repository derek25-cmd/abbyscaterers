import Link from 'next/link';
import { InvoiceListTable } from '@/components/invoices/invoice-list-table';

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm text-muted-foreground">All invoices, most recent first.</p>
        </div>
        <Link
          href="/invoices/request"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
        >
          Request an Invoice
        </Link>
      </div>
      <InvoiceListTable />
    </div>
  );
}
