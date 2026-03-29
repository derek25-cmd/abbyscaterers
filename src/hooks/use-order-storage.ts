
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
  deleteOrder as deleteFromStorage 
} from '@/services/orderService';
import { format } from 'date-fns';

export function useOrderStorage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    const newOrder = await addToStorage(orderData);
    if(newOrder) {
      refreshOrders();
    }
    return newOrder;
  }, [refreshOrders]);

  const updateOrder = useCallback(async (originalId: string, updates: OrderFormData) => {
    const success = await updateInStorage(originalId, updates);
    if (success) {
      refreshOrders();
    }
    return success;
  }, [refreshOrders]);

  const deleteOrder = useCallback(async (id: string) => {
    const success = await deleteFromStorage(id);
    if (success) {
      refreshOrders();
    }
    return success;
  }, [refreshOrders]);
  
  const bulkAddOrders = useCallback(async (ordersData: Partial<OrderFormData>[]) => {
    const newOrders = await bulkAddToStorage(ordersData);
    if (newOrders.length > 0) {
      refreshOrders();
    }
    return newOrders;
  }, [refreshOrders]);
  
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
            if (event.date === targetDateStr) {
                allEvents.push(event);
            }
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
    getOrderById,
    getOrdersByBookingId,
    refreshOrders,
    getEventsForDate
  };
}
