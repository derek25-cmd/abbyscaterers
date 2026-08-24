
"use client";

import dynamic from 'next/dynamic';
import { LoadingPage } from '@/components/layout/loading-page';

const ProformaInvoiceListTable = dynamic(() =>
  import('@/components/proforma-invoices/proforma-invoice-list-table').then(mod => mod.ProformaInvoiceListTable),
  {
    ssr: false,
    loading: () => <LoadingPage title="Loading Proforma Invoices..." message="Fetching your list of proforma invoices." />
  }
);

export function ProformaInvoicesPageContent() {
  return <ProformaInvoiceListTable />;
}
