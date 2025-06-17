
"use client";

import type { Recipe, Ingredient } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit, ClipboardSignature, Info, CalendarClock, ShoppingBasket, FileText, SquarePen } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { Skeleton } from "@/components/ui/skeleton";

interface RecipeDetailsViewProps {
  recipe: Recipe;
}

export function RecipeDetailsView({ recipe }: RecipeDetailsViewProps) {
  const { getIngredientById, isLoading: ingredientsLoading } = useIngredientStorage();

  const DetailItem = ({ icon: Icon, label, value, className = "" }: { icon: React.ElementType, label: string, value?: string | number | React.ReactNode, className?: string }) => {
    const hasValue = value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== "") && (typeof value !== 'number' || !isNaN(value) );

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

  const formatDateSafe = (dateString?: string, formatString: string = "MMMM d, yyyy 'at' h:mm a") => {
    if (!dateString) return "N/A";
    const parsedDate = parseISO(dateString);
    return isValid(parsedDate) ? format(parsedDate, formatString) : "N/A";
  };

  const getIngredientName = (ingredientId: string): string => {
    if (ingredientsLoading) return "Loading...";
    const ingredient = getIngredientById(ingredientId);
    return ingredient ? ingredient.itemDescription : "Unknown Ingredient";
  };
  
  const handlePdfExport = () => {
    // Placeholder for PDF export functionality
    // In a real app, you would use a library like jsPDF or a backend service.
    alert("PDF export functionality to be implemented. This would typically involve using a library like jsPDF or calling a backend service to generate the PDF.");
  };


  return (
    <Card className="shadow-lg">
      <CardHeader className="border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold text-primary flex items-center">
              <ClipboardSignature className="mr-2 h-7 w-7" /> {recipe.recipeName}
            </CardTitle>
            <CardDescription className="text-md text-accent">
              Recipe No: {recipe.recipeNumber}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePdfExport}>
              <FileText className="mr-2 h-4 w-4" /> Export as PDF
            </Button>
            <Link href={`/recipes/${recipe.recipeNumber}/edit`} passHref>
              <Button variant="outline">
                <SquarePen className="mr-2 h-4 w-4" /> Edit Recipe
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div>
            <h3 className="text-lg font-semibold text-foreground pb-2 flex items-center"><Info className="mr-2 h-5 w-5 text-primary" />Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y md:divide-y-0 md:divide-x">
                <div className="space-y-1 divide-y md:pr-4">
                    <DetailItem icon={ClipboardSignature} label="Recipe No." value={recipe.recipeNumber} />
                </div>
                <div className="space-y-1 divide-y md:pl-4">
                    <DetailItem icon={ClipboardSignature} label="Recipe Name" value={recipe.recipeName} />
                </div>
            </div>
        </div>
        
        <div>
            <h3 className="text-lg font-semibold text-foreground pb-2 flex items-center"><ShoppingBasket className="mr-2 h-5 w-5 text-primary" />Ingredients</h3>
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
                 <ul className="space-y-2 divide-y divide-border border rounded-md p-4 bg-muted/30">
                    {recipe.ingredients.map((item, index) => (
                    <li key={index} className="flex justify-between items-center py-2">
                        <span className="text-sm text-foreground">
                        {ingredientsLoading ? <Skeleton className="h-5 w-32 inline-block" /> : getIngredientName(item.ingredientId)}
                        </span>
                        <span className="text-sm text-muted-foreground">{item.measurement}</span>
                    </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">No ingredients listed for this recipe.</p>
            )}
        </div>

         <div className="space-y-1 divide-y divide-border">
           <h3 className="text-lg font-semibold text-foreground pt-4 pb-3 flex items-center"><CalendarClock className="mr-2 h-5 w-5 text-primary" />Record Timestamps</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div className="divide-y divide-border">
                    <DetailItem 
                      icon={CalendarClock} 
                      label="Created At" 
                      value={formatDateSafe(recipe.createdAt)} 
                    />
                </div>
                <div className="divide-y divide-border">
                    <DetailItem 
                      icon={CalendarClock} 
                      label="Last Updated" 
                      value={formatDateSafe(recipe.updatedAt)} 
                    />
                </div>
            </div>
        </div>

      </CardContent>
      <CardFooter className="border-t pt-6 flex justify-end">
         <Link href="/recipes" passHref>
            <Button variant="ghost">Back to Recipe List</Button>
          </Link>
      </CardFooter>
    </Card>
  );
}
