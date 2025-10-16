
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

export const createDeliveryNoteFromOrder = async (
    orderId: string, 
    details: { vehicleRegNo: string, deliveredBy: string }
): Promise<DeliveryNote | null> => {
    try {
        const { data, error } = await supabase.functions.invoke('create-delivery-note', {
            body: { 
                orderId,
                vehicleRegNo: details.vehicleRegNo,
                deliveredBy: details.deliveredBy
            },
        });
        if (error) throw error;
        return data as DeliveryNote;
    } catch (error) {
        console.error('Error invoking create-delivery-note function:', error);
        return null;
    }
}

export const deleteDeliveryNote = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('delivery_notes').delete().eq('id', id);
    if (error) {
        console.error('Error deleting delivery note:', error);
    }
    return !error;
};
