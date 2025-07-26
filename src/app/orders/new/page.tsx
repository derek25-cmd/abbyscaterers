
"use client"; 

import { OrderForm } from "@/components/orders/order-form";
import { useSearchParams } from 'next/navigation';
import React from 'react';

export default function NewOrderPage() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');
  
  // Check if component has mounted to avoid SSR issues
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <OrderForm clientId={clientId ?? undefined} />
    </div>
  );
}
