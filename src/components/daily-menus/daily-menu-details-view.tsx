
"use client";
import React from "react";
import type { DailyMenu } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import Link from "next/link";
import { BookOpen, Info, CalendarClock, Utensils, SquarePen } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { Skeleton } from "../ui/skeleton";

interface DailyMenuDetailsViewProps {
  menu: DailyMenu;
}

export function DailyMenuDetailsView({ menu }: DailyMenuDetailsViewProps) {
  const { getRecipeById, isLoading: recipesLoading } = useRecipeStorage();

  const DetailItem = ({ icon: Icon, label, value, className = "" }: { icon: React.ElementType, label: string, value?: string | number | React.ReactNode, className?: string }) => {
    const hasValue = value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== "");

    return (
    <div className={cn("flex items-start space-x-3 py-3", className)}> 
      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
      <div className="flex-grow"> 
        <p className="text-sm font-medium text-foreground">{label}</p>
        {!hasValue ? (
          <p className="text-sm text-muted-foreground">N/A</p> 
        ) : (
          <div className="text-sm text-muted-foreground break-words"> 
            {value}
          </div>
        )}
      </div>
    </div>
    );
  };

  const formatDateSafe = (dateString?: string, formatString: string = "MMMM d, yyyy") => {
    if (!dateString) return "N/A";
    const parsedDate = parseISO(dateString);
    return isValid(parsedDate) ? format(parsedDate, formatString) : "N/A";
  };
  
  const getRecipeName = (recipeId: string): string => {
    if (recipesLoading) return "Loading...";
    const recipe = getRecipeById(recipeId);
    return recipe ? recipe.recipeName : "Unknown Recipe";
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold text-primary flex items-center">
              <BookOpen className="mr-2 h-7 w-7" /> {menu.name}
            </CardTitle>
            <CardDescription className="text-md text-accent">
              Menu ID: {menu.id}
            </CardDescription>
          </div>
          <Link href={`/daily-menus/${menu.id}/edit`} passHref>
              <Button variant="outline">
                <SquarePen className="mr-2 h-4 w-4" /> Edit Menu
              </Button>
            </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div>
            <h3 className="text-lg font-semibold text-foreground pb-2 flex items-center"><Info className="mr-2 h-5 w-5 text-primary" />Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y md:divide-y-0 md:divide-x">
                <div className="space-y-1 divide-y md:pr-4">
                    <DetailItem icon={BookOpen} label="Menu ID" value={menu.id} />
                    <DetailItem icon={BookOpen} label="Menu Name" value={menu.name} />
                </div>
                <div className="space-y-1 divide-y md:pl-4">
                    <DetailItem icon={CalendarClock} label="Menu Date" value={formatDateSafe(menu.date)} />
                </div>
            </div>
        </div>
        
        <div>
            <h3 className="text-lg font-semibold text-foreground pb-2 flex items-center"><Utensils className="mr-2 h-5 w-5 text-primary" />Recipes on this Menu</h3>
            {menu.items && menu.items.length > 0 ? (
                 <ul className="space-y-2 divide-y divide-border border rounded-md p-4 bg-muted/30">
                    {menu.items.map((item, index) => (
                    <li key={index} className="flex justify-between items-center py-2">
                        <span className="text-sm text-foreground">
                          {recipesLoading ? <Skeleton className="h-5 w-32 inline-block" /> : getRecipeName(item.recipeId)}
                        </span>
                    </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">No recipes assigned to this menu.</p>
            )}
        </div>

        <div className="space-y-1 divide-y divide-border">
           <h3 className="text-lg font-semibold text-foreground pt-4 pb-3 flex items-center"><CalendarClock className="mr-2 h-5 w-5 text-primary" />Record Timestamps</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div className="divide-y divide-border">
                    <DetailItem 
                      icon={CalendarClock} 
                      label="Created At" 
                      value={formatDateSafe(menu.createdAt, "MMMM d, yyyy 'at' h:mm a")} 
                    />
                </div>
                <div className="divide-y divide-border">
                    <DetailItem 
                      icon={CalendarClock} 
                      label="Last Updated" 
                      value={formatDateSafe(menu.updatedAt, "MMMM d, yyyy 'at' h:mm a")} 
                    />
                </div>
            </div>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-6 flex justify-end">
         <Link href="/daily-menus" passHref>
            <Button variant="ghost">Back to Menu List</Button>
          </Link>
      </CardFooter>
    </Card>
  );
}
