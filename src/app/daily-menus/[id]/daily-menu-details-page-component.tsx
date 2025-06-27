
"use client";

import { DailyMenuDetailsView } from "@/components/daily-menus/daily-menu-details-view";
import { useDailyMenuStorage } from "@/hooks/use-daily-menu-storage";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { DailyMenu } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function DailyMenuDetailsPageComponent() {
  const [isMounted, setIsMounted] = useState(false);
  const params = useParams();
  const { getMenuById, isLoading: storageLoading } = useDailyMenuStorage();
  const [menu, setMenu] = useState<DailyMenu | undefined>(undefined);
  const [componentLoading, setComponentLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const menuId = typeof params.id === 'string' ? params.id : undefined; 

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    if (!menuId) {
      setError("Invalid menu ID provided.");
      setMenu(undefined);
      setComponentLoading(false);
      return;
    }
    
    if (storageLoading) {
      setComponentLoading(true);
      return;
    }

    setComponentLoading(true);
    setError(null);
    try {
      const fetchedMenu = getMenuById(menuId); 
      if (fetchedMenu) {
        setMenu(fetchedMenu);
      } else {
        setMenu(undefined);
        setError("Menu not found. The item may have been deleted or the ID is incorrect.");
      }
    } catch (e) {
      console.error("Error fetching menu details:", e);
      setMenu(undefined);
      setError("An unexpected error occurred while loading menu data.");
    } finally {
      setComponentLoading(false);
    }
  }, [menuId, getMenuById, storageLoading, isMounted]);

  if (!isMounted || componentLoading || storageLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-10 w-48" /> 
        </div>
        <Skeleton className="h-8 w-1/3 mb-2" /> 
        <Skeleton className="h-40 w-full md:col-span-2" />
        <Skeleton className="h-32 w-full md:col-span-2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error Loading Menu</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href="/daily-menus">Go to Menu List</Link>
        </Button>
      </div>
    );
  }
  
  if (!menu || !menu.id) {
     return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Menu Not Found</h2>
        <p className="text-muted-foreground mb-6">The requested menu could not be found. It might have been deleted or the ID is incorrect.</p>
        <Button asChild>
          <Link href="/daily-menus">Go to Menu List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <DailyMenuDetailsView menu={menu} />
    </div>
  );
}
