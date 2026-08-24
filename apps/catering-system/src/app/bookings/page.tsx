
import { BookingsPageContent } from './bookings-page-content';

export default function BookingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Bookings & Contracts
        </h1>
        <p className="text-muted-foreground">
          Manage long-term catering contracts and continuous invoices.
        </p>
      </div>
      <BookingsPageContent />
    </div>
  );
}
