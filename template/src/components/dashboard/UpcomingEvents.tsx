import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Users } from "lucide-react";

interface Event {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  guests: number;
  type: string;
}

const upcomingEvents: Event[] = [
  {
    id: "EVT-001",
    name: "Annual Gala Dinner",
    date: "Jan 15, 2024",
    time: "7:00 PM",
    location: "Grand Ballroom, Downtown Hotel",
    guests: 200,
    type: "Corporate"
  },
  {
    id: "EVT-002",
    name: "Smith-Johnson Wedding",
    date: "Jan 18, 2024",
    time: "6:00 PM",
    location: "Sunset Gardens",
    guests: 150,
    type: "Wedding"
  },
  {
    id: "EVT-003",
    name: "Product Launch Party",
    date: "Jan 22, 2024",
    time: "5:30 PM",
    location: "Tech Hub Conference Center",
    guests: 80,
    type: "Corporate"
  }
];

export function UpcomingEvents() {
  return (
    <Card className="bg-gradient-card shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Upcoming Events
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {upcomingEvents.map((event) => (
            <div key={event.id} className="p-4 rounded-lg bg-background/50 hover:bg-accent/50 transition-smooth border border-border/50">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-foreground">{event.name}</h4>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  {event.type}
                </span>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {event.date} at {event.time}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {event.location}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {event.guests} guests
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}