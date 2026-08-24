
"use client";

import { OrderForm } from "@/components/orders/order-form";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Order } from "@/types";
import { Button } from '@/components/ui/button';
import Link from "next/link";
import { LoadingPage } from "@/components/layout/loading-page";

export function OrderEditPageComponent() {
  const [isMounted, setIsMounted] = useState(false);
  const params = useParams();
  const { getOrderById, isLoading: storageLoading } = useOrderStorage();
  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [componentLoading, setComponentLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderId = typeof params.id === 'string' ? params.id : undefined; 

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }
    
    if (!orderId) {
      setError("Invalid order ID provided.");
      setOrder(undefined);
      setComponentLoading(false);
      return;
    }
    
    if (storageLoading) { 
      setComponentLoading(true);
      return;
    }

    setComponentLoading(true);
    setError(null);
    try {
      const fetchedOrder = getOrderById(orderId); 
      if (fetchedOrder) {
        setOrder(fetchedOrder);
      } else {
        setOrder(undefined);
        setError("Order not found. Cannot edit a non-existent item.");
      }
    } catch (e: unknown) {
      console.error("Error fetching order for edit:", e);
      setOrder(undefined);
      let message = "An unexpected error occurred while loading order data for editing.";
      if (e instanceof Error) {
        message = `An unexpected error occurred: ${e.message}`;
      }
      setError(message);
    } finally {
      setComponentLoading(false);
    }
  }, [orderId, getOrderById, storageLoading, isMounted]);

  if (!isMounted || componentLoading || storageLoading) {
    return <LoadingPage title="Loading Order Editor..." message="Getting the form ready for your changes."/>;
  }

  if (error) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error Loading Order for Editing</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href="/orders">Go to Order List</Link>
        </Button>
      </div>
    );
  }

  if (!order || !order.id) { 
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-4">Order Data Not Available for Editing</h2>
        <p className="text-muted-foreground mb-6">Could not load order data for editing. The item might have been deleted or the ID is incorrect.</p>
        <Button asChild>
          <Link href="/orders">Go to Order List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <OrderForm order={order} />
    </div>
  );
}
