
import { EquipmentListTable } from "@/components/equipment/equipment-list-table";
import { ChefHat } from "lucide-react";

export default function EquipmentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
          <ChefHat className="mr-3 h-8 w-8 text-primary" />
          Equipment Management
        </h1>
        <p className="text-muted-foreground">
          View, add, edit, and manage all your catering equipment here.
        </p>
      </div>
      <EquipmentListTable />
    </div>
  );
}
