import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChefHat, Users } from "lucide-react";

export default function Staff() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Staff</h2>
          <p className="text-muted-foreground">Manage your team members and schedules</p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90 shadow-elegant">
          <Plus className="h-4 w-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            Team Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👨‍🍳</div>
            <h3 className="text-xl font-semibold mb-2">Staff Management</h3>
            <p className="text-muted-foreground mb-4">
              Coordinate your team and manage work schedules
            </p>
            <div className="flex gap-2 justify-center">
              <Badge variant="outline">Chefs</Badge>
              <Badge variant="outline">Servers</Badge>
              <Badge variant="outline">Schedules</Badge>
              <Badge variant="outline">Performance</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}