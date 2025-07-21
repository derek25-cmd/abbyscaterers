
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Ingredient } from "@/types";

interface IngredientCostTableProps {
  ingredients: Ingredient[];
}

const IngredientCostTable = ({ ingredients }: IngredientCostTableProps) => {
  const ingredientsWithUsage = ingredients.filter(ing => (ing as any).quantityUsed > 0);

  const calculateCost = (ingredient: Ingredient) => {
    const quantityUsed = (ingredient as any).quantityUsed || 0;
    if (quantityUsed > 0 && ingredient.units.length > 0) {
      // Simple costing: use the first unit and price defined
      return quantityUsed * ingredient.units[0].price;
    }
    return 0;
  }

  const totalCost = ingredients.reduce((sum, item) => sum + calculateCost(item), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>Ingredient Cost Breakdown</span>
           <Badge variant="outline">{ingredientsWithUsage.length} items used</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ingredient</TableHead>
              <TableHead>Qty Used</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredientsWithUsage.length > 0 ? ingredientsWithUsage.map((ingredient) => (
              <TableRow key={ingredient.itemNumber}>
                <TableCell className="font-medium">{ingredient.itemDescription}</TableCell>
                <TableCell>
                    {(ingredient as any).quantityUsed} {ingredient.units[0].unit}
                </TableCell>
                <TableCell>${ingredient.units[0].price.toFixed(2)} / {ingredient.units[0].unit}</TableCell>
                <TableCell className="text-right font-medium">
                  <span className="text-destructive">
                    ${calculateCost(ingredient).toFixed(2)}
                  </span>
                </TableCell>
              </TableRow>
            )) : (
                <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">No ingredient usage data entered.</TableCell>
                </TableRow>
            )}
            <TableRow className="border-t-2">
              <TableCell colSpan={3} className="font-bold">
                Total Ingredient Cost
              </TableCell>
              <TableCell className="text-right font-bold text-lg text-destructive">
                ${totalCost.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default IngredientCostTable;
