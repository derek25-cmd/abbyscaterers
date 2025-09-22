

import { DailyMenusPageContent } from '@/app/daily-menus/daily-menus-page-content';

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Orders Management
        </h1>
        <p className="text-muted-foreground">
          View, add, edit, and manage all your event orders here.
        </p>
      </div>
      <DailyMenusPageContent />
    </div>
  );
}

    