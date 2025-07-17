
import { ClipboardSignature } from "lucide-react";
import { RecipesPageContent } from './recipes-page-content';

export default function RecipesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Recipe Management
        </h1>
        <p className="text-muted-foreground">
          View, add, edit, and manage all your recipes here.
        </p>
      </div>
      <RecipesPageContent />
    </div>
  );
}
