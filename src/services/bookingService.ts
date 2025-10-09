
import { supabase } from '@/lib/supabase-client';
import type { Booking } from '@/types';
import type { BookingFormData } from '@/lib/schemas';

export const getBookings = async (): Promise<Booking[]> => {
    const { data, error } = await supabase.from('bookings').select('*').order('startDate', { ascending: false });
    if (error) {
        console.error('Error fetching bookings:', error);
        return [];
    }
    return data as Booking[];
};

export const getBookingById = async (id: string): Promise<Booking | null> => {
    const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single();
    if (error) {
        console.error('Error fetching booking by id:', error);
        return null;
    }
    return data as Booking;
}

export const addBooking = async (bookingData: BookingFormData): Promise<Booking | null> => {
    const now = new Date().toISOString();
    const newBookingData = { ...bookingData, createdAt: now, updatedAt: now };
    const { data, error } = await supabase.from('bookings').insert([newBookingData]).select();
    if (error) {
        console.error('Error adding booking:', error);
        return null;
    }
    return data?.[0] as Booking;
};

export const updateBooking = async (id: string, updates: Partial<BookingFormData>): Promise<boolean> => {
    const { error } = await supabase.from('bookings').update({ ...updates, updatedAt: new Date().toISOString() }).eq('id', id);
    if (error) {
        console.error('Error updating booking:', error);
    }
    return !error;
};

export const deleteBooking = async (id: string): Promise<boolean> => {
    // Also delete associated daily orders
    const { error: dailyOrderError } = await supabase.from('daily_orders').delete().eq('bookingId', id);
    if(dailyOrderError){
        console.error('Error deleting associated daily orders:', dailyOrderError);
        // Decide if you want to stop or continue
    }

    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) {
        console.error('Error deleting booking:', error);
    }
    return !error;
};
