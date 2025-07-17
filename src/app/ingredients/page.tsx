
import { ClipboardList } from "lucide-react";
import { IngredientsPageContent } from './ingredients-page-content';

export default function IngredientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
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
