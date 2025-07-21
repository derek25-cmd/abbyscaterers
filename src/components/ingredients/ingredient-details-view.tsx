

"use client";

import type { Ingredient } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit, PackagePlus, Tag, CalendarClock, Info, DollarSign, ListChecks } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface IngredientDetailsViewProps {
  ingredient: Ingredient;
}

export function IngredientDetailsView({ ingredient }: IngredientDetailsViewProps) {
  
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
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold text-primary flex items-center">
              <PackagePlus className="mr-2 h-7 w-7" /> {ingredient.itemDescription}
            </CardTitle>
            <CardDescription className="text-md text-accent">
              Item No: {ingredient.itemNumber}
            </CardDescription>
          </div>
          <Link href={`/ingredients/${ingredient.itemNumber}/edit`} passHref>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" /> Edit Ingredient
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        
        <div className="space-y-1 divide-y divide-border">
          <h3 className="text-lg font-semibold text-foreground pt-2 pb-3 flex items-center"><Info className="mr-2 h-5 w-5 text-primary" />Basic Information</h3>
          <DetailItem icon={Tag} label="Item No." value={ingredient.itemNumber} />
          <DetailItem icon={Tag} label="Item Description" value={ingredient.itemDescription} />
          <DetailItem 
            icon={ListChecks} 
            label="Item Classification" 
            value={<Badge variant="secondary">{ingredient.itemClassification}</Badge>} 
          />
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground pt-2 flex items-center"><DollarSign className="mr-2 h-5 w-5 text-primary" />Pricing & Units (TSHS)</h3>
          {ingredient.units && ingredient.units.length > 0 ? (
            <div className="space-y-2 divide-y divide-border border rounded-md p-4 bg-muted/30">
              {ingredient.units.map((unitItem, index) => (
                <div key={index} className="flex justify-between items-center pt-2 first:pt-0">
                  <span className="text-sm font-medium text-foreground">{unitItem.unit.toUpperCase()}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(unitItem.price)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground p-4 text-center">No pricing information available.</p>
          )}
        </div>

        <div className="space-y-1 divide-y divide-border md:col-span-2">
           <h3 className="text-lg font-semibold text-foreground pt-4 pb-3 flex items-center"><CalendarClock className="mr-2 h-5 w-5 text-primary" />Record Timestamps</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div className="divide-y divide-border">
                    <DetailItem 
                      icon={CalendarClock} 
                      label="Created At" 
                      value={formatDateSafe(ingredient.createdAt)} 
                    />
                </div>
                <div className="divide-y divide-border">
                    <DetailItem 
                      icon={CalendarClock} 
                      label="Last Updated" 
                      value={formatDateSafe(ingredient.updatedAt)} 
                    />
                </div>
            </div>
        </div>

      </CardContent>
      <CardFooter className="border-t pt-6 flex justify-end">
         <Link href="/ingredients" passHref>
            <Button variant="ghost">Back to Ingredient List</Button>
          </Link>
      </CardFooter>
    </Card>
  );
}
