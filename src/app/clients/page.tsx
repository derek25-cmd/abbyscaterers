
import { Users } from "lucide-react";
import { ClientsPageContent } from './clients-page-content';

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
          <Users className="mr-3 h-8 w-8 text-primary" />
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
