
import { BookOpen } from "lucide-react";
import { DailyMenusPageContent } from './daily-menus-page-content';

export default function DailyMenusPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Bookings Management
        </h1>
        <p className="text-muted-foreground">
          View, add, edit, and manage all your event bookings here.
        </p>
      </div>
      <DailyMenusPageContent />
    </div>
  );
}
