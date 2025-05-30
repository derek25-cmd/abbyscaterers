
"use client";

import { EquipmentForm } from '@/components/equipment/equipment-form';
import { useEquipmentStorage } from '@/hooks/use-equipment-storage';
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Equipment } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ChefHat, Edit } from "lucide-react";
import { Button } from '@/components/ui/button';
import Link from "next/link";

export function EquipmentEditPageComponent() {
  const [isMounted, setIsMounted] = useState(false);
  const params = useParams();
  const { getEquipmentById, isLoading: storageLoading } = useEquipmentStorage();
  const [equipment, setEquipment] = useState<Equipment | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const equipmentId = typeof params.id === 'string' ? params.id : undefined;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !equipmentId) {
      if (!equipmentId && isMounted) {
        setError("Invalid equipment ID provided.");
        setIsLoading(false);
      }
      return;
    }
    
    if (!storageLoading) { 
      setIsLoading(true);
      try {
        const fetchedEquipment = getEquipmentById(equipmentId); 
        if (fetchedEquipment) {
          setEquipment(fetchedEquipment);
        } else {
          setError("Equipment not found.");
        }
      } catch (e: unknown) {
        console.error("Error fetching equipment for edit:", e);
        let message = "An unexpected error occurred while loading equipment data for editing.";
        if (e instanceof Error) {
          message = `An unexpected error occurred: ${e.message}`;
        }
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }
  }, [equipmentId, getEquipmentById, storageLoading, isMounted]); 

  if (!isMounted || isLoading || storageLoading) {
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
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error Loading Equipment for Editing</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href="/equipment">Go to Equipment List</Link>
        </Button>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-4">Equipment Data Not Available</h2>
        <p className="text-muted-foreground mb-6">Could not load equipment data for editing. The item might have been deleted.</p>
        <Button asChild>
          <Link href="/equipment">Go to Equipment List</Link>
        </Button>
      </div>
    );
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
