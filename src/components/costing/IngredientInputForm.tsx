
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlusCircle, Trash2, ChevronsUpDown, Check } from "lucide-react";
import type { Ingredient } from "@/types";
import { type IngredientUsage } from "@/app/costing/ingredients/page";
import { cn } from "@/lib/utils";

interface IngredientInputFormProps {
  availableIngredients: Ingredient[];
  usedIngredients: IngredientUsage[];
  onUsageChange: (usedIngredients: IngredientUsage[]) => void;
  isLoading: boolean;
}

const IngredientInputForm = ({ availableIngredients, usedIngredients, onUsageChange, isLoading }: IngredientInputFormProps) => {
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  const getIngredientDetails = (itemNumber: string) => {
    return availableIngredients.find(i => i.itemNumber === itemNumber);
  }

  const handleAddIngredient = (itemNumber: string) => {
    if (!usedIngredients.some(i => i.itemNumber === itemNumber)) {
        onUsageChange([...usedIngredients, { itemNumber, quantity: 0 }]);
    }
    setPopoverOpen(false);
  }

  const handleQuantityChange = (itemNumber: string, quantity: number) => {
    const updated = usedIngredients.map(ing => 
      ing.itemNumber === itemNumber ? { ...ing, quantity } : ing
    );
    onUsageChange(updated);
  }

  const handleRemoveIngredient = (itemNumber: string) => {
    onUsageChange(usedIngredients.filter(i => i.itemNumber !== itemNumber));
  }

  if (isLoading) {
    return (
      <Card><CardHeader><CardTitle>Ingredient Usage Input</CardTitle><CardDescription>Loading ingredient database...</CardDescription></CardHeader>
      <CardContent className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></CardContent></Card>
    );
  }
  
  const selectableIngredients = availableIngredients.filter(
      avail => !usedIngredients.some(used => used.itemNumber === avail.itemNumber)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingredient Usage Input</CardTitle>
        <CardDescription>Select ingredients used today and enter the quantity to calculate costs.</CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Ingredient Name</TableHead><TableHead>Unit of Measure</TableHead><TableHead>Unit Price (TSHS)</TableHead><TableHead className="w-[150px]">Quantity Used</TableHead><TableHead className="w-[50px]"></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {usedIngredients.map((usedIng) => {
                const ingredient = getIngredientDetails(usedIng.itemNumber);
                if (!ingredient) return null;
                return (
                  <TableRow key={ingredient.itemNumber}>
                    <TableCell className="font-medium">{ingredient.itemDescription}</TableCell>
                    <TableCell><Badge variant="secondary">{ingredient.units[0]?.unit || 'N/A'}</Badge></TableCell>
                    <TableCell>{(ingredient.units[0]?.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell><Input type="number" step="any" value={usedIng.quantity || ""} onChange={(e) => handleQuantityChange(ingredient.itemNumber, parseFloat(e.target.value) || 0)} placeholder="0"/></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveIngredient(ingredient.itemNumber)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                )
              })}
              {usedIngredients.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No ingredients selected yet. Add ingredients to track usage.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4"/> Add Ingredient</Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                    <Command>
                        <CommandInput placeholder="Search ingredient..." />
                        <CommandList>
                          <CommandEmpty>No ingredients found or all are added.</CommandEmpty>
                          <CommandGroup>
                            {selectableIngredients.map((ing) => (
                              <CommandItem key={ing.itemNumber} value={`${ing.itemDescription} (${ing.itemNumber})`} onSelect={() => handleAddIngredient(ing.itemNumber)}>
                                <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                                {ing.itemDescription}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
      </CardContent>
    </Card>
  );
};

export default IngredientInputForm;
