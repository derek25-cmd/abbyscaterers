
import { supabase } from '@/lib/supabase-client';
import type { DeliveryNote } from '@/types';
import type { DeliveryNoteFormData } from '@/lib/schemas';

export const getDeliveryNotes = async (): Promise<DeliveryNote[]> => {
    const { data, error } = await supabase.from('delivery_notes').select('*').order('createdAt', { ascending: false });
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
    const now = new Date().toISOString();
    const newDeliveryNoteData = { ...deliveryNoteData, createdAt: now, updatedAt: now };
    
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
