import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Ingredient {
  id: number;
  name: string;
  unit_of_measure: string;
  unit_price: number;
  stock_quantity_used?: number;
  baseQuantity: number;
  basePrice: number;
  totalCost: number;
}

interface IngredientCostTableProps {
  ingredients: Ingredient[];
}

const IngredientCostTable = ({ ingredients }: IngredientCostTableProps) => {
  const getUnitDisplayName = (unit: string) => {
    switch (unit.toLowerCase()) {
      case 'kg':
        return 'Kilograms';
      case 'grams':
        return 'Grams';
      case 'bunches':
        return 'Bunches';
      case 'items':
        return 'Items';
      default:
        return unit;
    }
  };

  const formatQuantity = (quantity: number, unit: string) => {
    return `${quantity} ${unit}`;
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(3)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>Ingredient Cost Breakdown</span>
          <Badge variant="outline">{ingredients.length} items</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ingredient</TableHead>
              <TableHead>Qty Used</TableHead>
              <TableHead>UOM</TableHead>
              <TableHead>Price/Unit</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.map((ingredient) => (
              <TableRow key={ingredient.id}>
                <TableCell className="font-medium">{ingredient.name}</TableCell>
                <TableCell>
                  {formatQuantity(ingredient.stock_quantity_used || 0, ingredient.unit_of_measure)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {getUnitDisplayName(ingredient.unit_of_measure)}
                  </Badge>
                </TableCell>
                <TableCell>{formatPrice(ingredient.unit_price)}</TableCell>
                <TableCell className="text-right font-medium">
                  <span className="text-destructive">
                    ${ingredient.totalCost.toFixed(2)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2">
              <TableCell colSpan={4} className="font-bold">
                Total Ingredient Cost
              </TableCell>
              <TableCell className="text-right font-bold text-lg text-destructive">
                ${ingredients.reduce((sum, item) => sum + item.totalCost, 0).toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default IngredientCostTable;
