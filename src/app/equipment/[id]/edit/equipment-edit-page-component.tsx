
"use client";

import { EquipmentForm } from "@/components/equipment/equipment-form";
import { useEquipmentStorage } from "@/hooks/use-equipment-storage";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Equipment } from "@/types";
import { Skeleton } from "@/components/ui/skeleton"; 
import { ChefHat, Edit } from "lucide-react";

export function EquipmentEditPageComponent() {
  const params = useParams();
  const router = useRouter();
  const { getEquipmentById, isLoading: storageLoading } = useEquipmentStorage();
  const [equipment, setEquipment] = useState<Equipment | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const equipmentId = typeof params.id === 'string' ? params.id : undefined;

  useEffect(() => {
    if (equipmentId) {
      if (!storageLoading) { 
        const fetchedEquipment = getEquipmentById(equipmentId); 
        if (fetchedEquipment) {
          setEquipment(fetchedEquipment);
        } else {
          setError("Equipment not found.");
        }
        setIsLoading(false);
      }
    } else {
      setError("Invalid equipment ID.");
      setIsLoading(false);
    }
  }, [equipmentId, getEquipmentById, storageLoading, router]);

  if (isLoading || storageLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-12 w-1/4 mb-6" />
        <Skeleton className="h-[700px] w-full" /> 
        <div className="flex justify-end gap-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive text-center py-10">{error}</div>;
  }

  if (!equipment) {
    return <div className="text-center py-10">Equipment data could not be loaded.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-6 flex items-center">
        <Edit className="mr-2 h-6 w-6 text-primary" /> Edit Equipment: <ChefHat className="ml-2 mr-1 h-6 w-6 text-accent" /> {equipment.equipmentName}
      </h1>
      <EquipmentForm equipment={equipment} />
    </div>
  );
}
