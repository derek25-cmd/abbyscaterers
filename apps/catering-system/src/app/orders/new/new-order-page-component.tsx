
"use client"; 

import { OrderForm } from "@/components/orders/order-form";
import { useSearchParams } from 'next/navigation';

export function NewOrderPageComponent() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  return (
    <div className="max-w-4xl mx-auto">
      <OrderForm clientId={clientId ?? undefined} />
    </div>
  );
}
