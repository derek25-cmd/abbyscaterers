
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Order, ClientEvent } from "@/types";
import type { OrderFormData } from "@/lib/schemas";
import {
  getOrders as getAllFromStorage,
  getOrderById as getByIdFromStorage,
  addOrder as addToStorage,
  bulkAddOrders as bulkAddToStorage,
  updateOrder as updateInStorage,
  deleteOrder as deleteFromStorage,
  bulkDeleteOrders as bulkDeleteFromStorage
} from '@/services/orderService';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getErrorDescription } from '@/lib/service-validation';

export function useOrderStorage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const refreshOrders = useCallback(async () => {
    setIsLoading(true);
    const data = await getAllFromStorage();
    setOrders(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  const addOrder = useCallback(async (orderData: OrderFormData) => {
    try {
      const newOrder = await addToStorage(orderData);
      if (newOrder) refreshOrders();
      return newOrder;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to save order', description: getErrorDescription(err) });
      return null;
    }
  }, [refreshOrders, toast]);

  const updateOrder = useCallback(async (originalId: string, updates: OrderFormData) => {
    try {
      const success = await updateInStorage(originalId, updates);
      if (success) refreshOrders();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to update order', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshOrders, toast]);

  const deleteOrder = useCallback(async (id: string) => {
    try {
      const success = await deleteFromStorage(id);
      if (success) refreshOrders();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete order', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshOrders, toast]);

  const bulkDeleteOrders = useCallback(async (ids: string[]) => {
    try {
      const success = await bulkDeleteFromStorage(ids);
      if (success) refreshOrders();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete orders', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshOrders, toast]);

  const bulkAddOrders = useCallback(async (ordersData: Partial<OrderFormData>[]) => {
    try {
      const newOrders = await bulkAddToStorage(ordersData);
      if (newOrders.length > 0) refreshOrders();
      return newOrders;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to import orders', description: getErrorDescription(err) });
      return [];
    }
  }, [refreshOrders, toast]);

  const getOrderById = useCallback((id: string) => {
    return orders.find(o => o.id === id);
  }, [orders]);

  const getOrdersByBookingId = useCallback((bookingId: string) => {
    return orders.filter(o => o.booking_id === bookingId);
  }, [orders]);

  const getEventsForDate = useCallback((date: Date): ClientEvent[] => {
    const targetDateStr = format(date, 'yyyy-MM-dd');
    const allEvents: ClientEvent[] = [];
    orders.forEach(order => {
      order.clientEvents.forEach(event => {
        if (event.date === targetDateStr) allEvents.push(event);
      });
    });
    return allEvents;
  }, [orders]);

  return {
    orders,
    isLoading,
    addOrder,
    updateOrder,
    deleteOrder,
    bulkAddOrders,
    bulkDeleteOrders,
    getOrderById,
    getOrdersByBookingId,
    refreshOrders,
    getEventsForDate
  };
}
