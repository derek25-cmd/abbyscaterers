
"use client";

import dynamic from 'next/dynamic';
import { LoadingPage } from '@/components/layout/loading-page';

const OrderListTable = dynamic(() =>
  import('@/components/orders/order-list-table').then(mod => mod.OrderListTable),
  {
    ssr: false,
    loading: () => <LoadingPage title="Loading Orders..." message="Organizing all your events and orders." />
  }
);

export function OrdersPageContent() {
  return <OrderListTable />;
}
