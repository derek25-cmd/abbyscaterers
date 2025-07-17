
import { ChefHat } from "lucide-react";
import { EquipmentPageContent } from './equipment-page-content';

export default function EquipmentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Inventory Management
        </h1>
        <p className="text-muted-foreground">
          View, add, edit, and manage all your catering equipment and utensils here.
        </p>
      </div>
      <EquipmentPageContent />
    </div>
  );
}
