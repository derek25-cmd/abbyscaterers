
"use client";

import { supabase } from '@/lib/supabase-client';
import type { Booking } from '@/types';
import type { BookingFormData } from '@/lib/schemas';

export const getBookings = async (): Promise<Booking[]> => {
    try {
        const { data, error } = await supabase.from('bookings').select('*').order('startDate', { ascending: false });
        if (error) throw error;
        return data as Booking[];
    } catch (error) {
        console.error("Error fetching bookings:", JSON.stringify(error, null, 2));
        return [];
    }
};

export const getBookingById = async (id: string): Promise<Booking | null> => {
    try {
        const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single();
        if (error) throw error;
        return data as Booking;
    } catch(error) {
        console.error('Error fetching booking by id:', JSON.stringify(error, null, 2));
        return null;
    }
}

export const addBooking = async (bookingData: Omit<BookingFormData, 'id'>): Promise<Booking | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const now = new Date().toISOString();
        const newBookingData = { 
            ...bookingData, 
            user_id: user.id,
            createdAt: now, 
            updatedAt: now 
        };

        const { data, error } = await supabase.from('bookings').insert([newBookingData]).select();
        if (error) throw error;
        
        return data?.[0] as Booking;
    } catch (error) {
        console.error('Error adding booking:', JSON.stringify(error, null, 2));
        return null;
    }
};


export const updateBooking = async (id: string, updates: Partial<BookingFormData>): Promise<boolean> => {
    try {
        const { error } = await supabase.from('bookings').update({ ...updates, updatedAt: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        return true;
    } catch(error) {
        console.error('Error updating booking:', JSON.stringify(error, null, 2));
        return false;
    }
};

export const deleteBooking = async (id: string): Promise<boolean> => {
    try {
        const { error: dailyOrderError } = await supabase.from('daily_orders').delete().eq('bookingId', id);
        if(dailyOrderError) throw dailyOrderError;

        const { error } = await supabase.from('bookings').delete().eq('id', id);
        if (error) throw error;
        
        return true;
    } catch (error) {
        console.error('Error deleting booking:', JSON.stringify(error, null, 2));
        return false;
    }
};
