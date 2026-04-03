import { supabase } from '@/lib/supabase-client';
import type { TrainingSession } from '@/types';
import type { TrainingSessionFormData } from '@/lib/schemas';

export const getTrainingSessions = async (): Promise<TrainingSession[]> => {
    const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching training sessions:', error);
        return [];
    }
    return data as TrainingSession[];
};

export const addTrainingSession = async (session: TrainingSessionFormData): Promise<TrainingSession | null> => {
    const now = new Date().toISOString();
    const payload = {
        ...session,
        id: `TRN-${Date.now()}`,
        createdAt: now,
        updatedAt: now
    };

    const { data, error } = await supabase
        .from('training_sessions')
        .insert([payload])
        .select()
        .single();

    if (error) {
        console.error('Error adding training session:', error);
        return null;
    }
    return data as TrainingSession;
};

export const updateTrainingSession = async (id: string, updates: Partial<TrainingSessionFormData>): Promise<boolean> => {
    const { error } = await supabase
        .from('training_sessions')
        .update({ ...updates, updatedAt: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        console.error('Error updating training session:', error);
    }
    return !error;
};

export const deleteTrainingSession = async (id: string): Promise<boolean> => {
    const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting training session:', error);
    }
    return !error;
};
