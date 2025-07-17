import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, MapPin, Users } from "lucide-react";

export default function Events() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Events</h2>
          <p className="text-muted-foreground">Plan and manage your catering events</p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90 shadow-elegant">
          <Plus className="h-4 w-4 mr-2" />
          Schedule Event
        </Button>
      </div>

      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Event Planning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold mb-2">Event Management</h3>
            <p className="text-muted-foreground mb-4">
              Plan, schedule, and coordinate all your catering events
            </p>
            <div className="flex gap-2 justify-center">
              <Badge variant="outline">Weddings</Badge>
              <Badge variant="outline">Corporate</Badge>
              <Badge variant="outline">Private Parties</Badge>
              <Badge variant="outline">Conferences</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}