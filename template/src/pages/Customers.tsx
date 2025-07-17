import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Phone, Mail } from "lucide-react";

export default function Customers() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Customers</h2>
          <p className="text-muted-foreground">Manage your client relationships and contacts</p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90 shadow-elegant">
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Customer Database
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-xl font-semibold mb-2">Customer Management</h3>
            <p className="text-muted-foreground mb-4">
              Build and maintain relationships with your valued clients
            </p>
            <div className="flex gap-2 justify-center">
              <Badge variant="outline">Contact Info</Badge>
              <Badge variant="outline">Order History</Badge>
              <Badge variant="outline">Preferences</Badge>
              <Badge variant="outline">Communications</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}