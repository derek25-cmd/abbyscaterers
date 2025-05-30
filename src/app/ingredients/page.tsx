
import dynamic from 'next/dynamic';
import { ClipboardList } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';

const IngredientListTable = dynamic(() =>
  import('@/components/ingredients/ingredient-list-table').then(mod => mod.IngredientListTable),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>
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

export default function IngredientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
          <ClipboardList className="mr-3 h-8 w-8 text-primary" />
          Ingredient Price List
        </h1>
        <p className="text-muted-foreground">
          View, add, edit, and manage all your ingredient pricing information here.
        </p>
      </div>
      <IngredientListTable />
    </div>
  );
}
