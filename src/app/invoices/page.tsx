
import { InvoicesPageContent } from './invoices-page-content';
import { FileText } from 'lucide-react';

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
          <FileText className="mr-3 h-8 w-8 text-primary" />
          Final Invoices
        </h1>
        <p className="text-muted-foreground">
          Create, view, and manage all your final invoices here.
        </p>
      </div>
      <InvoicesPageContent />
    </div>
  );
}
