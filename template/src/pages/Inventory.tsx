import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, AlertTriangle } from "lucide-react";

export default function Inventory() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Inventory</h2>
          <p className="text-muted-foreground">Track ingredients and supplies</p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90 shadow-elegant">
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Inventory Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold mb-2">Stock Management</h3>
            <p className="text-muted-foreground mb-4">
              Monitor inventory levels and manage supply chain
            </p>
            <div className="flex gap-2 justify-center">
              <Badge variant="outline">Ingredients</Badge>
              <Badge variant="outline">Equipment</Badge>
              <Badge variant="outline">Supplies</Badge>
              <Badge variant="outline">Low Stock Alerts</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}