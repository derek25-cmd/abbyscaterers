
"use client";

import { DailyMenuForm } from "@/components/daily-menus/daily-menu-form";
import { useDailyMenuStorage } from "@/hooks/use-daily-menu-storage";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { DailyMenu } from "@/types";
import { Skeleton } from "@/components/ui/skeleton"; 
import { BookOpen, SquarePen } from "lucide-react";
import { Button } from '@/components/ui/button';
import Link from "next/link";

export function DailyMenuEditPageComponent() {
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
        setError("Menu not found. Cannot edit a non-existent item.");
      }
    } catch (e: unknown) {
      console.error("Error fetching menu for edit:", e);
      setMenu(undefined);
      let message = "An unexpected error occurred while loading menu data for editing.";
      if (e instanceof Error) {
        message = `An unexpected error occurred: ${e.message}`;
      }
      setError(message);
    } finally {
      setComponentLoading(false);
    }
  }, [menuId, getMenuById, storageLoading, isMounted]);

  if (!isMounted || componentLoading || storageLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-12 w-3/4 mb-6" />
        <Skeleton className="h-[500px] w-full" /> 
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
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error Loading Menu for Editing</h2>
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
        <h2 className="text-2xl font-semibold text-muted-foreground mb-4">Menu Data Not Available for Editing</h2>
        <p className="text-muted-foreground mb-6">Could not load menu data for editing. The item might have been deleted or the ID is incorrect.</p>
        <Button asChild>
          <Link href="/daily-menus">Go to Menu List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-6 flex items-center">
        <SquarePen className="mr-2 h-6 w-6 text-primary" /> Edit Menu: <BookOpen className="ml-2 mr-1 h-6 w-6 text-accent" /> {menu.name}
      </h1>
      <DailyMenuForm menu={menu} />
    </div>
  );
}
