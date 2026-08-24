import { InvoiceDetail } from '@/components/invoices/invoice-detail';

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  return <InvoiceDetail invoiceId={params.id} />;
}
