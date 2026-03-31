
import { supabase } from '@/lib/supabase-client';
import { TrainingSession } from '@/types';

export const getTrainingSessions = async (): Promise<TrainingSession[]> => {
    const { data, error } = await supabase.from('positions').select('*');
    if (error) {
        console.error('Error fetching training sessions:', error);
        return [];
    }
    return data as TrainingSession[];
};

export const addTrainingSession = async (session: Omit<TrainingSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<TrainingSession | null> => {
    const { data, error } = await supabase.from('positions').insert([session]).select();
    if (error) {
        console.error('Error adding training session:', error);
        return null;
    }
    return data?.[0] as TrainingSession;
};

export const updateTrainingSession = async (id: string, updatedSession: Partial<TrainingSession>): Promise<boolean> => {
    const { error } = await supabase.from('positions').update(updatedSession).eq('id', id);
    if (error) {
        console.error('Error updating training session:', error);
    }
    return !error;
};

// Participant Management
export const getTrainingParticipants = async (trainingId: string): Promise<any[]> => {
    const { data, error } = await supabase
        .from('training_participants')
        .select(`
            *,
            employees:employee_id (firstName, lastName)
        `)
        .eq('training_id', trainingId);
    
    if (error) {
        console.error('Error fetching training participants:', error);
        return [];
    }
    
    return data.map(p => ({
        ...p,
        employee_name: `${p.employees?.firstName} ${p.employees?.lastName}`
    }));
};

export const addTrainingParticipants = async (trainingId: string, employeeIds: string[]): Promise<boolean> => {
    const records = employeeIds.map(empId => ({
        training_id: trainingId,
        employee_id: empId,
        status: 'Enrolled'
    }));

    const { error } = await supabase.from('training_participants').upsert(records, { onConflict: 'training_id,employee_id' });
    
    if (error) {
        console.error('Error adding training participants:', error);
        return false;
    }

    // Update applicant count in positions table
    const { data: countData } = await supabase
        .from('training_participants')
        .select('id', { count: 'exact' })
        .eq('training_id', trainingId);
    
    await supabase.from('positions').update({ applicants: countData?.length || 0 }).eq('id', trainingId);
    
    return true;
};

export const updateParticipantStatus = async (id: string, updates: any): Promise<boolean> => {
    const { error } = await supabase.from('training_participants').update(updates).eq('id', id);
    if (error) {
        console.error('Error updating participant status:', error);
    }
    return !error;
};

export const deleteParticipant = async (id: string, trainingId: string): Promise<boolean> => {
    const { error } = await supabase.from('training_participants').delete().eq('id', id);
    if (error) {
        console.error('Error deleting participant:', error);
        return false;
    }

    // Update applicant count
    const { data: countData } = await supabase
        .from('training_participants')
        .select('id', { count: 'exact' })
        .eq('training_id', trainingId);
    
    await supabase.from('positions').update({ applicants: countData?.length || 0 }).eq('id', trainingId);

    return true;
};
