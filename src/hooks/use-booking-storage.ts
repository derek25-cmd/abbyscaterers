
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Booking, DailyOrder } from "@/types";
import type { BookingFormData, DailyOrderFormData } from "@/lib/schemas";
import {
  getBookings as getBookingsFromService,
  addBooking as addBookingToService,
  updateBooking as updateBookingInService,
  deleteBooking as deleteBookingFromService,
  getDailyOrders as getDailyOrdersFromService,
  addDailyOrder as addDailyOrderToService,
  updateDailyOrder as updateDailyOrderInService,
  deleteDailyOrder as deleteDailyOrderFromService
} from '@/services/bookingService';

export function useBookingStorage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dailyOrders, setDailyOrders] = useState<DailyOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshBookings = useCallback(async () => {
    setIsLoading(true);
    const bookingsData = await getBookingsFromService();
    const dailyOrdersData = await getDailyOrdersFromService();
    setBookings(bookingsData);
    setDailyOrders(dailyOrdersData);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshBookings();
  }, [refreshBookings]);

  const addBooking = useCallback(async (bookingData: BookingFormData) => {
    const newBooking = await addBookingToService(bookingData);
    if(newBooking) {
      await refreshBookings();
    }
    return newBooking;
  }, [refreshBookings]);

  const updateBooking = useCallback(async (id: string, updates: Partial<BookingFormData>) => {
    const success = await updateBookingInService(id, updates);
    if (success) {
      await refreshBookings();
    }
    return success;
  }, [refreshBookings]);

  const deleteBooking = useCallback(async (id: string) => {
    const success = await deleteBookingFromService(id);
    if (success) {
      await refreshBookings();
    }
    return success;
  }, [refreshBookings]);
  
  const getBookingById = useCallback((id: string) => {
    return bookings.find(b => b.id === id);
  }, [bookings]);

  const getDailyOrdersByBooking = useCallback((bookingId: string) => {
    return dailyOrders.filter(o => o.booking_id === bookingId);
  }, [dailyOrders]);

  const addDailyOrder = useCallback(async (orderData: DailyOrderFormData) => {
      const newOrder = await addDailyOrderToService(orderData);
      if (newOrder) {
          await refreshBookings();
      }
      return newOrder;
  }, [refreshBookings]);

  const updateDailyOrder = useCallback(async (id: number, updates: Partial<DailyOrderFormData>) => {
      const success = await updateDailyOrderInService(id, updates);
      if (success) {
          await refreshBookings();
      }
      return success;
  }, [refreshBookings]);

  const deleteDailyOrder = useCallback(async (id: number) => {
      const success = await deleteDailyOrderFromService(id);
      if (success) {
          await refreshBookings();
      }
      return success;
  }, [refreshBookings]);

  return { 
    bookings,
    dailyOrders, 
    isLoading, 
    addBooking, 
    updateBooking, 
    deleteBooking, 
    getBookingById,
    getDailyOrdersByBooking,
    addDailyOrder,
    updateDailyOrder,
    deleteDailyOrder,
    refreshBookings 
  };
}
