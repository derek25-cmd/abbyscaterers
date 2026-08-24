
"use client";

import { supabase } from '@/lib/supabase-client';
import type { Booking } from '@/types';
// DailyOrder is not yet exported from @/types — use a local shape until it is.
type DailyOrder = Record<string, unknown>;
import { BookingSchema, type BookingFormData, type DailyOrderFormData } from "@/lib/schemas";
import { validate } from '@/lib/service-validation';

// -------- Bookings --------

export const getBookings = async (): Promise<Booking[]> => {
    try {
        const PAGE = 1000;
        const all: Booking[] = [];
        let page = 0;
        while (true) {
            const { data, error } = await supabase
                .from("bookings")
                .select("*")
                .order('created_at', { ascending: false })
                .range(page * PAGE, (page + 1) * PAGE - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            all.push(...(data as Booking[]));
            if (data.length < PAGE) break;
            page++;
        }
        return all;
    } catch (error) {
        console.error("Error fetching bookings:", JSON.stringify(error, null, 2));
        return [];
    }
};

export const addBooking = async (bookingData: BookingFormData): Promise<Booking | null> => {
    const validated = validate(BookingSchema, bookingData);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error("User must be logged in to create a booking.");
    }

    const now = new Date().toISOString();

    const bookingPayload = {
      id: `BK-${Date.now()}`,
      client_id: validated.clientId,
      user_id: user.id,
      name: validated.name,
      start_date: validated.start_date,
      end_date: validated.end_date,
      status: validated.status,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase.from('bookings').insert([bookingPayload]).select();
    if (error) throw new Error(error.message);
    return data?.[0] as Booking;
};

export const updateBooking = async (id: string, updates: Partial<Booking>): Promise<boolean> => {
    const { error } = await supabase.from('bookings').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    return true;
};

export const deleteBooking = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
};


// -------- Daily Orders --------

export const getDailyOrders = async (): Promise<DailyOrder[]> => {
    try {
        const PAGE = 1000;
        const all: DailyOrder[] = [];
        let page = 0;
        while (true) {
            const { data, error } = await supabase
                .from("daily_orders")
                .select("*")
                .order('order_date', { ascending: false })
                .range(page * PAGE, (page + 1) * PAGE - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            all.push(...(data as DailyOrder[]));
            if (data.length < PAGE) break;
            page++;
        }
        return all;
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
