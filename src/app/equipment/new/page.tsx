"use client"; // Make this page a Client Component

import { EquipmentForm } from "@/components/equipment/equipment-form";
import { ChefHat } from "lucide-react";

export default function NewEquipmentPage() {
  return (
    <div className="max-w-4xl mx-auto">
       <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-6 flex items-center">
         <ChefHat className="mr-2 h-7 w-7 text-primary" /> Add New Equipment
        </h1>
      <EquipmentForm />
    </div>
  );
}
