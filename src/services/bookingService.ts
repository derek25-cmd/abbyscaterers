
"use client";

import { supabase } from '@/lib/supabase-client';
import type { Booking, DailyOrder } from '@/types';
import type { BookingFormData, DailyOrderFormData } from "@/lib/schemas";

// -------- Bookings --------

export const getBookings = async (): Promise<Booking[]> => {
    try {
        const { data, error } = await supabase.from("bookings").select("*");
        if (error) throw error;
        return data as Booking[];
    } catch (error) {
        console.error("Error fetching bookings:", JSON.stringify(error, null, 2));
        return [];
    }
};

export const addBooking = async (bookingData: BookingFormData): Promise<Booking | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error("User must be logged in to create a booking.");
    }
    
    const now = new Date().toISOString();

    const bookingPayload = {
      id: `BK-${Date.now()}`,
      client_id: bookingData.clientId,
      user_id: user.id,
      name: bookingData.name,
      start_date: bookingData.start_date,
      end_date: bookingData.end_date,
      status: bookingData.status,
      created_at: now,
      updated_at: now,
    };

    try {
        const { data, error } = await supabase.from('bookings').insert([bookingPayload]).select();
        if (error) throw error;
        return data?.[0] as Booking;
    } catch (error) {
        console.error("Error adding booking:", JSON.stringify(error, null, 2));
        return null;
    }
};

export const updateBooking = async (id: string, updates: Partial<BookingFormData>): Promise<boolean> => {
    const updatePayload = {
        ...updates,
        client_id: updates.clientId,
        start_date: updates.start_date,
        end_date: updates.end_date,
        updated_at: new Date().toISOString()
    };
    
    // remove camelCase properties
    delete (updatePayload as any).clientId;

    try {
        const { error } = await supabase.from('bookings').update(updatePayload).eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating booking:", JSON.stringify(error, null, 2));
        return false;
    }
};

export const deleteBooking = async (id: string): Promise<boolean> => {
    try {
        const { error } = await supabase.from('bookings').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error deleting booking:", JSON.stringify(error, null, 2));
        return false;
    }
};


// -------- Daily Orders --------

export const getDailyOrders = async (): Promise<DailyOrder[]> => {
    try {
        const { data, error } = await supabase.from("daily_orders").select("*");
        if (error) throw error;
        return data as DailyOrder[];
    } catch (error) {
        console.error("Error fetching daily orders:", JSON.stringify(error, null, 2));
        return [];
    }
};

export const addDailyOrder = async (orderData: DailyOrderFormData): Promise<DailyOrder | null> => {
    const now = new Date().toISOString();
    const orderPayload = {
        booking_id: orderData.bookingId,
        order_date: orderData.orderDate,
        menu: orderData.menu,
        quantity: orderData.quantity,
        unit_price: orderData.unitPrice,
        total: orderData.total,
        created_at: now,
        updated_at: now,
    };
    try {
        const { data, error } = await supabase.from('daily_orders').insert([orderPayload]).select();
        if (error) throw error;
        return data?.[0] as DailyOrder;
    } catch (error) {
        console.error("Error adding daily order:", JSON.stringify(error, null, 2));
        return null;
    }
};

export const updateDailyOrder = async (id: number, updates: Partial<DailyOrderFormData>): Promise<boolean> => {
    const updatePayload = {
        ...updates,
        booking_id: updates.bookingId,
        order_date: updates.orderDate,
        unit_price: updates.unitPrice,
        updated_at: new Date().toISOString(),
    };
     delete (updatePayload as any).bookingId;
     delete (updatePayload as any).orderDate;
     delete (updatePayload as any).unitPrice;
    
    try {
        const { error } = await supabase.from('daily_orders').update(updatePayload).eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating daily order:", JSON.stringify(error, null, 2));
        return false;
    }
};

export const deleteDailyOrder = async (id: number): Promise<boolean> => {
    try {
        const { error } = await supabase.from('daily_orders').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error deleting daily order:", JSON.stringify(error, null, 2));
        return false;
    }
};
