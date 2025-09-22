
import { InvoiceViewPageComponent } from './invoice-view-page-component';

export async function generateStaticParams() {
  return [];
}

export default function ViewInvoicePage() {
  return <InvoiceViewPageComponent />;
}
