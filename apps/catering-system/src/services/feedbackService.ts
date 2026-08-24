
import { supabase } from '@/lib/supabase-client';
import type { ServiceFeedback } from '@/types';

export const getFeedbackByDate = async (date: string): Promise<ServiceFeedback[]> => {
    const { data, error } = await supabase
        .from('service_feedback')
        .select('*')
        .eq('report_date', date)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching feedback:', error);
        return [];
    }
    return data as ServiceFeedback[];
};

export const addFeedback = async (feedback: Omit<ServiceFeedback, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceFeedback | null> => {
    const { data, error } = await supabase
        .from('service_feedback')
        .insert([feedback])
        .select()
        .single();

    if (error) {
        console.error('Error adding feedback:', error);
        return null;
    }
    return data as ServiceFeedback;
};

export const deleteFeedback = async (id: string): Promise<boolean> => {
    const { error } = await supabase
        .from('service_feedback')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting feedback:', error);
        return false;
    }
    return true;
};
