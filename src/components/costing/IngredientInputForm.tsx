
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { Ingredient } from "@/types";

interface IngredientInputFormProps {
  ingredients: Ingredient[];
  quantities: Record<string, number>;
  onQuantityChange: (itemNumber: string, quantity: number) => void;
  isLoading: boolean;
}

const IngredientInputForm = ({ ingredients, quantities, onQuantityChange, isLoading }: IngredientInputFormProps) => {
  
  if (isLoading) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Ingredient Usage Input</CardTitle>
                <CardDescription>Loading ingredient database...</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingredient Usage Input</CardTitle>
        <CardDescription>
            Enter the quantity of each ingredient used today to calculate costs. The price is based on the first unit available for each item.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingredient Name</TableHead>
                <TableHead>Unit of Measure</TableHead>
                <TableHead>Unit Price ($)</TableHead>
                <TableHead className="w-[150px]">Quantity Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.map((ingredient) => (
                <TableRow key={ingredient.itemNumber}>
                  <TableCell className="font-medium">{ingredient.itemDescription}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ingredient.units[0]?.unit || 'N/A'}</Badge>
                  </TableCell>
                  <TableCell>${(ingredient.units[0]?.price || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="any"
                      value={quantities[ingredient.itemNumber] || ""}
                      onChange={(e) => onQuantityChange(ingredient.itemNumber, parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </TableCell>
                </TableRow>
              ))}
              {ingredients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No ingredients found in the database. Add ingredients in the "Menu / Food Costing" section.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default IngredientInputForm;
