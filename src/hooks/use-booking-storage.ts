"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Booking } from "@/types";
import type { BookingFormData } from "@/lib/schemas";
import {
  getBookings as getBookingsFromService,
  addBooking as addBookingToService,
  updateBooking as updateBookingInService,
  deleteBooking as deleteBookingFromService,
} from '@/services/bookingService';

export function useBookingStorage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshBookings = useCallback(async () => {
    setIsLoading(true);
    const bookingsData = await getBookingsFromService();
    setBookings(bookingsData);
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

  return { 
    bookings,
    isLoading, 
    addBooking, 
    updateBooking, 
    deleteBooking, 
    getBookingById,
    refreshBookings 
  };
}
