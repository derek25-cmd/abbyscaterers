
import { supabase } from '@/lib/supabase-client';
import type { DeliveryNote } from '@/types';
import type { DeliveryNoteFormData } from '@/lib/schemas';

export const getDeliveryNotes = async (): Promise<DeliveryNote[]> => {
    const { data, error } = await supabase.from('delivery_notes').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching delivery notes:', error);
        return [];
    }
    return data as DeliveryNote[];
};

export const getDeliveryNoteById = async (id: string): Promise<DeliveryNote | null> => {
    const { data, error } = await supabase.from('delivery_notes').select('*').eq('id', id).single();
     if (error) {
        console.error('Error fetching delivery note:', error);
        return null;
    }
    return data as DeliveryNote;
}

export const addDeliveryNote = async (deliveryNoteData: DeliveryNoteFormData): Promise<DeliveryNote | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error("User not authenticated to add a delivery note.");
        return null;
    }

    const now = new Date().toISOString();
    
    const newDeliveryNoteData = { 
        id: deliveryNoteData.id,
        order_id: deliveryNoteData.orderId,
        client_id: deliveryNoteData.clientId,
        client_name: deliveryNoteData.clientName,
        delivery_date: deliveryNoteData.deliveryDate,
        delivery_location: deliveryNoteData.deliveryLocation,
        vehicle_reg_no: deliveryNoteData.vehicleRegNo,
        delivered_by: deliveryNoteData.deliveredBy,
        items: deliveryNoteData.items,
        user_id: user.id,
        created_at: now, 
        updated_at: now 
    };
    
    const { data, error } = await supabase.from('delivery_notes').insert([newDeliveryNoteData]).select().single();
    if (error) {
        console.error('Error adding delivery note:', error);
        return null;
    }
    return data as DeliveryNote;
};

export const deleteDeliveryNote = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('delivery_notes').delete().eq('id', id);
    if (error) {
        console.error('Error deleting delivery note:', error);
    }
    return !error;
};
