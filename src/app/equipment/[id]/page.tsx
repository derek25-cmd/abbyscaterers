
"use client";

import { EquipmentDetailsView } from "@/components/equipment/equipment-details-view";
import { useEquipmentStorage } from "@/hooks/use-equipment-storage";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Equipment } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChefHat } from "lucide-react";

export default function EquipmentDetailPage() {
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
          setError("Equipment not found. The item may have been deleted or the ID is incorrect.");
        }
        setIsLoading(false);
      }
    } else {
      setError("Invalid equipment ID provided.");
      setIsLoading(false);
    }
  }, [equipmentId, getEquipmentById, storageLoading, router]);

  if (isLoading || storageLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-10 w-32" /> {/* Adjusted for "Edit Equipment" button */}
        </div>
        <Skeleton className="h-8 w-1/3 mb-2" /> {/* For subtitle like Equipment No */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <Skeleton className="h-48 w-full" /> {/* Placeholder for a section */}
          <Skeleton className="h-48 w-full" /> {/* Placeholder for another section */}
          <Skeleton className="h-40 w-full md:col-span-2" /> {/* Placeholder for a wider section */}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error Loading Equipment</h2>
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
        <h2 className="text-2xl font-semibold text-destructive mb-4">Equipment Not Found</h2>
        <p className="text-muted-foreground mb-6">The requested equipment could not be found. It might have been deleted.</p>
        <Button asChild>
          <Link href="/equipment">Go to Equipment List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <EquipmentDetailsView equipment={equipment} />
    </div>
  );
}
