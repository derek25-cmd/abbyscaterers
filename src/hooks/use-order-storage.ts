
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Order, ClientEvent } from "@/types";
import type { OrderFormData } from "@/lib/schemas";
import { 
  getAllOrders as getAllOrdersFromStorage,
  getOrderById as getOrderByIdFromStorage,
  addOrder as addOrderToStorage,
  updateOrder as updateOrderInStorage,
  deleteOrder as deleteOrderFromStorage 
} from '@/lib/daily-menu-data';
import { format } from 'date-fns';

export function useOrderStorage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrders(getAllOrdersFromStorage());
      setIsLoading(false);
    }
  }, []);

  const refreshOrders = useCallback(() => {
    if (typeof window !== "undefined") {
      setOrders(getAllOrdersFromStorage());
    }
  }, []);

  const addOrder = useCallback((orderData: OrderFormData) => {
    const newOrder = addOrderToStorage(orderData);
    setOrders(prevOrders => [...prevOrders, newOrder]);
    return newOrder;
  }, []);

  const updateOrder = useCallback((originalId: string, updates: OrderFormData) => {
    const updatedItem = updateOrderInStorage(originalId, updates);
    if (updatedItem) {
      setOrders(prevOrders => 
        prevOrders.map(order => order.id === originalId ? updatedItem : order)
      );
      refreshOrders(); // In case the ID changed, refresh the whole list
    }
    return updatedItem;
  }, [refreshOrders]);

  const deleteOrder = useCallback((id: string) => {
    const success = deleteOrderFromStorage(id);
    if (success) {
      setOrders(prevOrders => prevOrders.filter(order => order.id !== id));
    }
    return success;
  }, []);
  
  const getOrderById = useCallback((id: string) => {
    return getOrderByIdFromStorage(id);
  }, []);
  
  const getEventsForDate = useCallback((date: Date): ClientEvent[] => {
    const targetDateStr = format(date, 'yyyy-MM-dd');
    const allEvents: ClientEvent[] = [];
    orders.forEach(order => {
        order.clientEvents.forEach(event => {
            const eventDateStr = format(new Date(event.date), 'yyyy-MM-dd');
            if (eventDateStr === targetDateStr) {
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
    getOrderById,
    refreshOrders,
    getEventsForDate
  };
}
