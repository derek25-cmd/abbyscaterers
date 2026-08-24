
"use client";

import dynamic from 'next/dynamic';
import { LoadingPage } from '@/components/layout/loading-page';

const InvoiceListTable = dynamic(() =>
  import('@/components/invoices/invoice-list-table').then(mod => mod.InvoiceListTable),
  {
    ssr: false,
    loading: () => <LoadingPage title="Loading Invoices..." message="Preparing your list of final invoices." />
  }
);

export function InvoicesPageContent() {
  return <InvoiceListTable />;
}
