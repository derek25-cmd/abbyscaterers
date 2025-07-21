import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface Ingredient {
  id: number;
  name: string;
  unit_of_measure: string;
  unit_price: number;
  stock_quantity_used?: number;
}

interface IngredientInputFormProps {
  ingredients: Ingredient[];
  onIngredientsChange: (ingredients: Ingredient[]) => void;
}

const IngredientInputForm = ({ ingredients, onIngredientsChange }: IngredientInputFormProps) => {
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    unit_of_measure: "kg",
    unit_price: 0
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();

  const units = ["kg", "grams", "bunches", "items", "liters", "ml"];

  const handleAddIngredient = () => {
    if (!newIngredient.name || newIngredient.unit_price <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid ingredient name and price.",
        variant: "destructive",
      });
      return;
    }

    const ingredient: Ingredient = {
      id: Date.now(), // Simple ID generation
      name: newIngredient.name,
      unit_of_measure: newIngredient.unit_of_measure,
      unit_price: newIngredient.unit_price,
      stock_quantity_used: 0
    };

    onIngredientsChange([...ingredients, ingredient]);
    setNewIngredient({ name: "", unit_of_measure: "kg", unit_price: 0 });
    setShowAddForm(false);
    
    toast({
      title: "Ingredient Added",
      description: `${ingredient.name} has been added to the database.`,
    });
  };

  const handleQuantityChange = (id: number, quantity: number) => {
    const updatedIngredients = ingredients.map(ingredient =>
      ingredient.id === id 
        ? { ...ingredient, stock_quantity_used: quantity }
        : ingredient
    );
    onIngredientsChange(updatedIngredients);
  };

  const handleDeleteIngredient = (id: number) => {
    const updatedIngredients = ingredients.filter(ingredient => ingredient.id !== id);
    onIngredientsChange(updatedIngredients);
    
    toast({
      title: "Ingredient Removed",
      description: "Ingredient has been removed from the database.",
    });
  };

  const calculateCost = (ingredient: Ingredient) => {
    if (!ingredient.stock_quantity_used) return 0;
    
    // Unit conversion logic
    let baseQuantity = ingredient.stock_quantity_used;
    let basePrice = ingredient.unit_price;
    
    if (ingredient.unit_of_measure.toLowerCase() === 'kg') {
      baseQuantity = ingredient.stock_quantity_used * 1000; // Convert to grams
      basePrice = ingredient.unit_price / 1000; // Price per gram
    }
    
    return baseQuantity * basePrice;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Ingredient Cost Input</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter quantities used today to calculate costs
            </p>
          </div>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-gradient-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Ingredient
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Add Ingredient Form */}
        {showAddForm && (
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="name">Ingredient Name</Label>
                  <Input
                    id="name"
                    value={newIngredient.name}
                    onChange={(e) => setNewIngredient({...newIngredient, name: e.target.value})}
                    placeholder="e.g., Chicken Breast"
                  />
                </div>
                
                <div>
                  <Label htmlFor="unit">Unit of Measure</Label>
                  <Select
                    value={newIngredient.unit_of_measure}
                    onValueChange={(value) => setNewIngredient({...newIngredient, unit_of_measure: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="price">Unit Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={newIngredient.unit_price}
                    onChange={(e) => setNewIngredient({...newIngredient, unit_price: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="flex items-end space-x-2">
                  <Button onClick={handleAddIngredient}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ingredients Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingredient Name</TableHead>
                <TableHead>Unit of Measure</TableHead>
                <TableHead>Unit Price ($)</TableHead>
                <TableHead>Quantity Used</TableHead>
                <TableHead>Total Cost ($)</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.map((ingredient) => (
                <TableRow key={ingredient.id}>
                  <TableCell className="font-medium">{ingredient.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ingredient.unit_of_measure}</Badge>
                  </TableCell>
                  <TableCell>${ingredient.unit_price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={ingredient.stock_quantity_used || ""}
                      onChange={(e) => handleQuantityChange(ingredient.id, parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-primary">
                      ${calculateCost(ingredient).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteIngredient(ingredient.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {ingredients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No ingredients added yet. Click "Add Ingredient" to get started.
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
