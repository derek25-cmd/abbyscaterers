
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Booking } from '@/types';
import type { BookingFormData } from '@/lib/schemas';
import { 
  getBookings as getAllFromStorage,
  getBookingById as getByIdFromStorage,
  addBooking as addToStorage,
  updateBooking as updateInStorage,
  deleteBooking as deleteFromStorage 
} from '@/services/bookingService';

export function useBookingStorage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshBookings = useCallback(async () => {
    setIsLoading(true);
    const data = await getAllFromStorage();
    setBookings(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshBookings();
  }, [refreshBookings]);

  const addBooking = useCallback(async (bookingData: BookingFormData) => {
    const newBooking = await addToStorage(bookingData);
    if(newBooking) {
      refreshBookings();
    }
    return newBooking;
  }, [refreshBookings]);

  const updateBooking = useCallback(async (id: string, updates: Partial<BookingFormData>) => {
    const success = await updateInStorage(id, updates);
    if (success) {
      refreshBookings();
    }
    return success;
  }, [refreshBookings]);

  const deleteBooking = useCallback(async (id: string) => {
    const success = await deleteFromStorage(id);
    if (success) {
      refreshBookings();
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
