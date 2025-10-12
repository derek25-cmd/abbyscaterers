

import { OrdersPageContent } from './orders-page-content';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ListPlus } from 'lucide-react';

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Orders Management
            </h1>
            <p className="text-muted-foreground">
            View, add, edit, and manage all your event orders here.
            </p>
        </div>
        <Button asChild>
            <Link href="/orders/menu-planner">
                <ListPlus className="mr-2 h-5 w-5"/>
                Go to Menu Planner
            </Link>
        </Button>
      </div>
      <OrdersPageContent />
    </div>
  );
}
