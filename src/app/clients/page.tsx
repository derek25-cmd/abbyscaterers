
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const ClientListTable = dynamic(() =>
  import('@/components/clients/client-list-table').then(mod => mod.ClientListTable),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-96 w-full rounded-md border" />
        <div className="flex items-center justify-end space-x-2 py-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    )
  }
);

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
