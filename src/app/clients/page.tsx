import { ClientListTable } from "@/components/clients/client-list-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Client Management</h1>
        <p className="text-muted-foreground">
          View, add, edit, and manage all your client information here.
        </p>
      </div>
      <ClientListTable />
    </div>
  );
}
