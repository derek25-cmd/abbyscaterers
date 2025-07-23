import { DailyMenusPageContent } from './daily-menus-page-content';

export default function DailyMenusPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Daily Bookings
        </h1>
        <p className="text-muted-foreground">
          View, add, edit, and manage all your daily menu bookings here.
        </p>
      </div>
      <DailyMenusPageContent />
    </div>
  );
}
