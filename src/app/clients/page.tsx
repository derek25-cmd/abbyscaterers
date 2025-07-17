
import { Users } from "lucide-react";
import { ClientsPageContent } from './clients-page-content';

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Client Management
        </h1>
        <p className="text-muted-foreground">
          View, add, edit, and manage all your client information here.
        </p>
      </div>
      <ClientsPageContent />
    </div>
  );
}
