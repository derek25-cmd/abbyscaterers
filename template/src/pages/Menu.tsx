import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter } from "lucide-react";

export default function Menu() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Menu Management</h2>
          <p className="text-muted-foreground">Create and manage your catering menu items</p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90 shadow-elegant">
          <Plus className="h-4 w-4 mr-2" />
          Add Menu Item
        </Button>
      </div>

      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle>Menu Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🍽️</div>
            <h3 className="text-xl font-semibold mb-2">Menu Management</h3>
            <p className="text-muted-foreground mb-4">
              Organize your dishes, set pricing, and manage dietary options
            </p>
            <div className="flex gap-2 justify-center">
              <Badge variant="outline">Appetizers</Badge>
              <Badge variant="outline">Main Courses</Badge>
              <Badge variant="outline">Desserts</Badge>
              <Badge variant="outline">Beverages</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}