
import { BookOpen } from "lucide-react";
import { DailyMenusPageContent } from './daily-menus-page-content';

export default function DailyMenusPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
          <BookOpen className="mr-3 h-8 w-8 text-primary" />
          Daily Menu Management
        </h1>
        <p className="text-muted-foreground">
          View, add, edit, and manage all your daily menus here.
        </p>
      </div>
      <DailyMenusPageContent />
    </div>
  );
}
