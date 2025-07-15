
import { InvoiceForm } from "@/components/invoices/invoice-form";

export async function generateStaticParams() {
  return [];
}

export default function EditInvoicePage() {
    return <InvoiceForm />;
}
