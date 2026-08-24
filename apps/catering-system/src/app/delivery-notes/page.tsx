
import { DeliveryNotesPageContent } from './delivery-notes-page-content';

export default function DeliveryNotesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Delivery Notes
        </h1>
        <p className="text-muted-foreground">
          View, create, and manage all your delivery notes here.
        </p>
      </div>
      <DeliveryNotesPageContent />
    </div>
  );
}

    