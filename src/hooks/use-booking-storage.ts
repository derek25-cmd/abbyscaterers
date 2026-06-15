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
import { useToast } from '@/hooks/use-toast';
import { getErrorDescription } from '@/lib/service-validation';

export function useBookingStorage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
    try {
      const newBooking = await addBookingToService(bookingData);
      if (newBooking) await refreshBookings();
      return newBooking;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to save booking', description: getErrorDescription(err) });
      return null;
    }
  }, [refreshBookings, toast]);

  const updateBooking = useCallback(async (id: string, updates: Partial<BookingFormData>) => {
    try {
      const success = await updateBookingInService(id, updates);
      if (success) await refreshBookings();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to update booking', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshBookings, toast]);

  const deleteBooking = useCallback(async (id: string) => {
    try {
      const success = await deleteBookingFromService(id);
      if (success) await refreshBookings();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete booking', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshBookings, toast]);

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
