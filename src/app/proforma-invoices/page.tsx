
import { ProformaInvoicesPageContent } from './proforma-invoices-page-content';
import { FileText } from 'lucide-react';

export default function ProformaInvoicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
          <FileText className="mr-3 h-8 w-8 text-primary" />
          Proforma Invoices
        </h1>
        <p className="text-muted-foreground">
          Create, view, and manage all your proforma invoices here.
        </p>
      </div>
      <ProformaInvoicesPageContent />
    </div>
  );
}
