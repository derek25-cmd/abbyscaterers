
import { IngredientsPageContent } from './ingredients-page-content';

export default function IngredientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Ingredient Price List
        </h1>
        <p className="text-muted-foreground">
          View, add, edit, and manage all your ingredient pricing information here.
        </p>
      </div>
      <IngredientsPageContent />
    </div>
  );
}
